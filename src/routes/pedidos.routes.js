const express = require("express");

const router = express.Router();

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

function calcularTotalesDesdeDetalle(detallePreparado, adelanto = 0) {
  const total = Number(
    detallePreparado.reduce((acc, item) => acc + Number(item.subtotal || 0), 0).toFixed(2)
  );

  const subtotal = Number((total / 1.18).toFixed(2));
  const igv = Number((total - subtotal).toFixed(2));
  const adelantoNum = Number(adelanto || 0);
  const saldo = Number((total - adelantoNum).toFixed(2));

  let estadoPedido = "CONFIRMADO";
  if (adelantoNum > 0 && saldo > 0) estadoPedido = "PAGADO_PARCIAL";
  if (saldo <= 0) estadoPedido = "PAGADO";

  return {
    subtotal,
    descuento: 0,
    igv,
    total,
    adelanto: adelantoNum,
    saldo: saldo < 0 ? 0 : saldo,
    estadoPedido,
  };
}

/**
 * GET /pedidos
 */
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      q,
      estadoPedido,
      estadoEntrega,
      clienteId,
      fechaDesde,
      fechaHasta,
    } = req.query;

    const where = {};

    if (estadoPedido) {
      where.estadoPedido = normalizarTexto(estadoPedido);
    }

    if (estadoEntrega) {
      where.estadoEntrega = normalizarTexto(estadoEntrega);
    }

    if (clienteId) {
      where.clienteId = String(clienteId);
    }

    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) where.createdAt.gte = new Date(`${fechaDesde}T00:00:00.000Z`);
      if (fechaHasta) where.createdAt.lte = new Date(`${fechaHasta}T23:59:59.999Z`);
    }

    if (q && String(q).trim()) {
      const texto = String(q).trim();

      where.OR = [
        { codigo: { contains: texto, mode: "insensitive" } },
        { tipoPedido: { contains: texto, mode: "insensitive" } },
        { prioridad: { contains: texto, mode: "insensitive" } },
        { metodoPago: { contains: texto, mode: "insensitive" } },
        { observaciones: { contains: texto, mode: "insensitive" } },
        { cliente: { codigo: { contains: texto, mode: "insensitive" } } },
        { cliente: { dni: { contains: texto, mode: "insensitive" } } },
        { cliente: { nombres: { contains: texto, mode: "insensitive" } } },
        { cliente: { apellidos: { contains: texto, mode: "insensitive" } } },
      ];
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        cliente: true,
        almacenSolicitado: true,
        almacenAtendido: true,
        detalles: {
          include: {
            producto: true,
          },
        },
        historial: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      ok: true,
      data: pedidos,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * GET /pedidos/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = req.params.id;

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: true,
        almacenSolicitado: true,
        almacenAtendido: true,
        detalles: {
          include: {
            producto: true,
          },
        },
        historial: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    res.json({
      ok: true,
      data: pedido,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /pedidos
 */
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      clienteId,
      modalidad,
      tipoPedido,
      almacenSolicitadoId,
      almacenAtendidoId,
      fechaCompromiso,
      prioridad,
      metodoPago,
      adelanto,
      origenAtencion,
      observaciones,
      usuarioEmail,
      detalle,
    } = req.body;

    if (!clienteId || !almacenSolicitadoId || !almacenAtendidoId) {
      return res.status(400).json({
        ok: false,
        error: "clienteId, almacenSolicitadoId y almacenAtendidoId son obligatorios",
      });
    }

    if (!Array.isArray(detalle) || detalle.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar al menos una línea en detalle",
      });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        error: "Cliente no encontrado",
      });
    }

    const almacenSolicitado = await prisma.almacen.findUnique({
      where: { id: almacenSolicitadoId },
    });

    const almacenAtendido = await prisma.almacen.findUnique({
      where: { id: almacenAtendidoId },
    });

    if (!almacenSolicitado || !almacenAtendido) {
      return res.status(404).json({
        ok: false,
        error: "Almacén solicitado o atendido no encontrado",
      });
    }

    const detallePreparado = [];

    for (const item of detalle) {
      const {
        productoId,
        cantidad,
        tipoAtencion,
        observaciones: obsLinea,
      } = item;

      if (!productoId || !cantidad) {
        return res.status(400).json({
          ok: false,
          error: "Cada línea debe tener productoId y cantidad",
        });
      }

      const cantidadNum = Number(cantidad);

      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).json({
          ok: false,
          error: "La cantidad debe ser mayor a 0",
        });
      }

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
      });

      if (!producto) {
        return res.status(404).json({
          ok: false,
          error: `Producto no encontrado: ${productoId}`,
        });
      }

      const precio = Number(producto.precio);
      const subtotal = Number((precio * cantidadNum).toFixed(2));

      detallePreparado.push({
        productoId: producto.id,
        modelo: producto.modelo,
        color: producto.color,
        material: producto.material,
        talla: producto.talla,
        taco: producto.taco,
        cantidad: cantidadNum,
        precioUnitario: precio,
        subtotal,
        stockActualAlmacen: 0,
        stockOtrosAlmacenes: null,
        tipoAtencion: tipoAtencion || "PRODUCCION",
        codigoBarras: null,
        estadoLinea: "PENDIENTE",
        observaciones: obsLinea || null,
      });
    }

    const totales = calcularTotalesDesdeDetalle(detallePreparado, adelanto);

    const count = await prisma.pedido.count();
    const codigo = `P-${String(count + 1).padStart(6, "0")}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: {
          codigo,
          clienteId,
          modalidad: modalidad || "MINORISTA",
          tipoPedido: tipoPedido || "SIN_STOCK",
          almacenSolicitadoId,
          almacenAtendidoId,
          fechaCompromiso: fechaCompromiso ? new Date(fechaCompromiso) : null,
          prioridad: prioridad || "MEDIA",
          subtotal: totales.subtotal,
          descuento: totales.descuento,
          igv: totales.igv,
          total: totales.total,
          adelanto: totales.adelanto,
          saldo: totales.saldo,
          metodoPago: metodoPago || null,
          estadoPedido: totales.estadoPedido,
          estadoEntrega: "PENDIENTE",
          origenAtencion: origenAtencion || "PRODUCCION",
          observaciones: observaciones || null,
        },
      });

      await tx.detallePedido.createMany({
        data: detallePreparado.map((d) => ({
          pedidoId: pedido.id,
          ...d,
        })),
      });

      await tx.historialPedido.create({
        data: {
          pedidoId: pedido.id,
          tipoEvento: "CREACION",
          estadoAnterior: null,
          estadoNuevo: `${totales.estadoPedido} / PENDIENTE`,
          detalle: "Pedido creado",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return pedido;
    });

    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id: resultado.id },
      include: {
        cliente: true,
        almacenSolicitado: true,
        almacenAtendido: true,
        detalles: {
          include: {
            producto: true,
          },
        },
        historial: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    res.status(201).json({
      ok: true,
      data: pedidoCompleto,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * PUT /pedidos/:id
 * Editar cabecera y reemplazar detalle completo
 */
router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.id;

    const {
      fechaCompromiso,
      prioridad,
      metodoPago,
      adelanto,
      origenAtencion,
      observaciones,
      detalle,
      usuarioEmail,
    } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        detalles: true,
      },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    if (pedido.estadoEntrega === "ENTREGADO" || pedido.estadoPedido === "CANCELADO") {
      return res.status(400).json({
        ok: false,
        error: "No se puede editar un pedido entregado o cancelado",
      });
    }

    if (!Array.isArray(detalle) || detalle.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar al menos una línea válida",
      });
    }

    const detallePreparado = [];

    for (const item of detalle) {
      const {
        productoId,
        cantidad,
        tipoAtencion,
        observaciones: obsLinea,
      } = item;

      if (!productoId || !cantidad) {
        return res.status(400).json({
          ok: false,
          error: "Cada línea debe tener productoId y cantidad",
        });
      }

      const cantidadNum = Number(cantidad);

      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).json({
          ok: false,
          error: "La cantidad debe ser mayor a 0",
        });
      }

      const producto = await prisma.producto.findUnique({
        where: { id: productoId },
      });

      if (!producto) {
        return res.status(404).json({
          ok: false,
          error: `Producto no encontrado: ${productoId}`,
        });
      }

      const precio = Number(producto.precio);
      const subtotal = Number((precio * cantidadNum).toFixed(2));

      detallePreparado.push({
        productoId: producto.id,
        modelo: producto.modelo,
        color: producto.color,
        material: producto.material,
        talla: producto.talla,
        taco: producto.taco,
        cantidad: cantidadNum,
        precioUnitario: precio,
        subtotal,
        stockActualAlmacen: 0,
        stockOtrosAlmacenes: null,
        tipoAtencion: tipoAtencion || pedido.origenAtencion || "PRODUCCION",
        codigoBarras: null,
        estadoLinea: "PENDIENTE",
        observaciones: obsLinea || null,
      });
    }

    const adelantoFinal = adelanto !== undefined ? adelanto : pedido.adelanto;
    const totales = calcularTotalesDesdeDetalle(detallePreparado, adelantoFinal);

    const actualizado = await prisma.$transaction(async (tx) => {
      await tx.detallePedido.deleteMany({
        where: { pedidoId },
      });

      await tx.detallePedido.createMany({
        data: detallePreparado.map((d) => ({
          pedidoId,
          ...d,
        })),
      });

      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          fechaCompromiso: fechaCompromiso ? new Date(fechaCompromiso) : null,
          prioridad: prioridad || pedido.prioridad,
          metodoPago: metodoPago || pedido.metodoPago,
          adelanto: totales.adelanto,
          saldo: totales.saldo,
          subtotal: totales.subtotal,
          descuento: totales.descuento,
          igv: totales.igv,
          total: totales.total,
          estadoPedido: totales.estadoPedido,
          origenAtencion: origenAtencion || pedido.origenAtencion,
          observaciones: observaciones !== undefined ? observaciones : pedido.observaciones,
        },
      });

      await tx.historialPedido.create({
        data: {
          pedidoId,
          tipoEvento: "EDICION",
          estadoAnterior: `${pedido.estadoPedido} / ${pedido.estadoEntrega}`,
          estadoNuevo: `${totales.estadoPedido} / ${pedido.estadoEntrega}`,
          detalle: "Pedido editado y recalculado",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return pedidoActualizado;
    });

    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id: actualizado.id },
      include: {
        cliente: true,
        almacenSolicitado: true,
        almacenAtendido: true,
        detalles: {
          include: {
            producto: true,
          },
        },
        historial: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    res.json({
      ok: true,
      data: pedidoCompleto,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /pedidos/:id/pagos
 */
router.post("/:id/pagos", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.id;

    const {
      monto,
      metodoPago,
      nota,
      usuarioEmail,
    } = req.body;

    const montoNum = Number(monto);

    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0",
      });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        cliente: true,
        almacenSolicitado: true,
      },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    const total = Number(pedido.total);
    const adelantoActual = Number(pedido.adelanto);

    let nuevoAdelanto = adelantoActual + montoNum;
    if (nuevoAdelanto > total) {
      nuevoAdelanto = total;
    }

    const nuevoSaldo = Number((total - nuevoAdelanto).toFixed(2));

    let nuevoEstadoPedido = "PAGADO_PARCIAL";
    if (nuevoSaldo <= 0) {
      nuevoEstadoPedido = "PAGADO";
    } else if (nuevoAdelanto <= 0) {
      nuevoEstadoPedido = "CONFIRMADO";
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          adelanto: nuevoAdelanto,
          saldo: nuevoSaldo,
          estadoPedido: nuevoEstadoPedido,
          metodoPago: metodoPago || pedido.metodoPago || null,
        },
      });

      const historial = await tx.historialPedido.create({
        data: {
          pedidoId: pedido.id,
          tipoEvento: "PAGO",
          estadoAnterior: pedido.estadoPedido,
          estadoNuevo: nuevoEstadoPedido,
          detalle: nota || `Pago registrado por ${montoNum}`,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      let movimientoCaja = null;

      const cajaAbierta = await tx.caja.findFirst({
        where: {
          almacenId: pedido.almacenSolicitadoId,
          estado: "ABIERTA",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (cajaAbierta) {
        const saldoActualCaja = Number(cajaAbierta.saldoActual);
        const nuevoSaldoCaja = Number((saldoActualCaja + montoNum).toFixed(2));

        movimientoCaja = await tx.movimientoCaja.create({
          data: {
            cajaId: cajaAbierta.id,
            tipo: "INGRESO",
            subtipo: "PAGO_PEDIDO",
            monto: montoNum,
            moneda: "PEN",
            metodoPago: metodoPago || pedido.metodoPago || null,
            referencia: pedido.codigo,
            proveedor: null,
            persona: `${pedido.cliente.nombres} ${pedido.cliente.apellidos}`,
            usuarioEmail: usuarioEmail || "admin@erp.com",
            facturaSiNo: null,
            numFactura: null,
            vinculo: pedido.id,
            detalle: `Pago registrado para pedido ${pedido.codigo}`,
            saldoPost: nuevoSaldoCaja,
            notas: nota || null,
          },
        });

        await tx.caja.update({
          where: { id: cajaAbierta.id },
          data: {
            saldoActual: nuevoSaldoCaja,
          },
        });
      }

      return {
        pedidoActualizado,
        historial,
        movimientoCaja,
      };
    });

    res.status(201).json({
      ok: true,
      message: "Pago de pedido registrado correctamente",
      data: resultado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /pedidos/:id/estado
 */
router.post("/:id/estado", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.id;

    const {
      estadoPedido,
      estadoEntrega,
      detalle,
      usuarioEmail,
    } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    const nuevoEstadoPedido = estadoPedido || pedido.estadoPedido;
    const nuevoEstadoEntrega = estadoEntrega || pedido.estadoEntrega;

    const pedidoActualizado = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estadoPedido: nuevoEstadoPedido,
          estadoEntrega: nuevoEstadoEntrega,
        },
      });

      await tx.historialPedido.create({
        data: {
          pedidoId: pedido.id,
          tipoEvento: "CAMBIO_ESTADO",
          estadoAnterior: `${pedido.estadoPedido} / ${pedido.estadoEntrega}`,
          estadoNuevo: `${nuevoEstadoPedido} / ${nuevoEstadoEntrega}`,
          detalle: detalle || "Cambio manual de estado",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return actualizado;
    });

    res.json({
      ok: true,
      data: pedidoActualizado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/:id/marcar-listo", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.id;
    const { usuarioEmail } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estadoEntrega: "LISTO",
        },
      });

      await tx.historialPedido.create({
        data: {
          pedidoId,
          tipoEvento: "CAMBIO_ESTADO",
          estadoAnterior: `${pedido.estadoPedido} / ${pedido.estadoEntrega}`,
          estadoNuevo: `${pedido.estadoPedido} / LISTO`,
          detalle: "Pedido marcado como listo",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return pedidoActualizado;
    });

    res.json({
      ok: true,
      data: actualizado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/:id/marcar-entregado", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.id;
    const { usuarioEmail } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estadoEntrega: "ENTREGADO",
        },
      });

      await tx.historialPedido.create({
        data: {
          pedidoId,
          tipoEvento: "CAMBIO_ESTADO",
          estadoAnterior: `${pedido.estadoPedido} / ${pedido.estadoEntrega}`,
          estadoNuevo: `${pedido.estadoPedido} / ENTREGADO`,
          detalle: "Pedido marcado como entregado",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return pedidoActualizado;
    });

    res.json({
      ok: true,
      data: actualizado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/:id/cancelar", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.id;
    const { detalle, usuarioEmail } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        error: "Pedido no encontrado",
      });
    }

    const actualizado = await prisma.$transaction(async (tx) => {
      const pedidoActualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estadoPedido: "CANCELADO",
          estadoEntrega: "CANCELADO",
        },
      });

      await tx.historialPedido.create({
        data: {
          pedidoId,
          tipoEvento: "CAMBIO_ESTADO",
          estadoAnterior: `${pedido.estadoPedido} / ${pedido.estadoEntrega}`,
          estadoNuevo: `CANCELADO / CANCELADO`,
          detalle: detalle || "Pedido cancelado",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return pedidoActualizado;
    });

    res.json({
      ok: true,
      data: actualizado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;