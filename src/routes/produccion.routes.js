const express = require("express");

const router = express.Router();

async function enriquecerOrdenConInventario(prisma, orden) {
  if (!orden) return null;

  const tallas = Object.keys(orden.corridaJson || {}).map((t) => String(t));

  const inventarios = await prisma.inventario.findMany({
    where: {
      almacenId: orden.almacenDestinoId,
      producto: {
        modelo: orden.modelo,
        color: orden.color,
        material: orden.material || null,
        taco: orden.taco || null,
        talla: {
          in: tallas.map((t) => Number(t)).filter((n) => !Number.isNaN(n)),
        },
      },
    },
    include: {
      producto: true,
      almacen: true,
    },
  });

  const codigoBarrasPorTalla = {};
  const skuPorTalla = {};

  for (const inv of inventarios) {
    const tallaKey = String(inv.producto?.talla ?? "");
    if (!tallaKey) continue;

    codigoBarrasPorTalla[tallaKey] = inv.codigoBarras || null;
    skuPorTalla[tallaKey] = inv.sku || null;
  }

  const tallaBaseKey = String(orden.productoBase?.talla ?? "");
  const codigoBarrasBase =
    (tallaBaseKey && codigoBarrasPorTalla[tallaBaseKey]) || null;
  const skuBase = (tallaBaseKey && skuPorTalla[tallaBaseKey]) || null;

  return {
    ...orden,
    productoBase: orden.productoBase
      ? {
          ...orden.productoBase,
          codigoBarras: codigoBarrasBase,
          sku: skuBase,
        }
      : orden.productoBase,
    codigoBarrasPorTalla,
    skuPorTalla,
  };
}

async function enriquecerOrdenesConInventario(prisma, ordenes) {
  if (!Array.isArray(ordenes) || !ordenes.length) return [];

  const resultado = [];
  for (const orden of ordenes) {
    const enriquecida = await enriquecerOrdenConInventario(prisma, orden);
    resultado.push(enriquecida);
  }

  return resultado;
}

/**
 * GET /produccion
 * Lista órdenes de producción
 */
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const ordenes = await prisma.ordenProduccion.findMany({
      include: {
        productoBase: true,
        almacenDestino: true,
        etapas: true,
        movimientos: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const ordenesEnriquecidas = await enriquecerOrdenesConInventario(prisma, ordenes);

    res.json({
      ok: true,
      data: ordenesEnriquecidas,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * GET /produccion/:id
 * Ver una OP por id
 */
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const id = req.params.id;

    const orden = await prisma.ordenProduccion.findUnique({
      where: { id },
      include: {
        productoBase: true,
        almacenDestino: true,
        etapas: {
          orderBy: {
            ordenEtapa: "asc",
          },
        },
        movimientos: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!orden) {
      return res.status(404).json({
        ok: false,
        error: "Orden de producción no encontrada",
      });
    }

    const ordenEnriquecida = await enriquecerOrdenConInventario(prisma, orden);

    res.json({
      ok: true,
      data: ordenEnriquecida,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /produccion
 * Crear orden de producción manual
 */
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      productoBaseId,
      almacenDestinoId,
      prioridad,
      fechaInicio,
      fechaCompromiso,
      observaciones,
      usuarioEmail,
      corrida,
    } = req.body;

    if (!productoBaseId || !almacenDestinoId) {
      return res.status(400).json({
        ok: false,
        error: "productoBaseId y almacenDestinoId son obligatorios",
      });
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoBaseId },
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto base no encontrado",
      });
    }

    const almacen = await prisma.almacen.findUnique({
      where: { id: almacenDestinoId },
    });

    if (!almacen) {
      return res.status(404).json({
        ok: false,
        error: "Almacén destino no encontrado",
      });
    }

    const corridaJson = corrida || { [String(producto.talla)]: 1 };

    const cantidadPares = Object.values(corridaJson).reduce(
      (acc, val) => acc + Number(val || 0),
      0
    );

    if (cantidadPares <= 0) {
      return res.status(400).json({
        ok: false,
        error: "La corrida debe tener al menos 1 par",
      });
    }

    const count = await prisma.ordenProduccion.count();
    const codigo = `OP-${String(count + 1).padStart(6, "0")}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.create({
        data: {
          codigo,
          productoBaseId,
          modelo: producto.modelo,
          color: producto.color,
          material: producto.material,
          taco: producto.taco,
          coleccion: producto.coleccion,
          cantidadPares,
          corridaJson,
          almacenDestinoId,
          prioridad: prioridad || "MEDIA",
          fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
          fechaCompromiso: fechaCompromiso ? new Date(fechaCompromiso) : null,
          estadoGeneral: "LIBERADA",
          etapaActual: "CORTADO",
          paresComprometidos: 0,
          paresLibres: cantidadPares,
          observaciones: observaciones || null,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      const etapasBase = [
        { etapa: "CORTADO", ordenEtapa: 1 },
        { etapa: "PERFILADO", ordenEtapa: 2 },
        { etapa: "ARMADO", ordenEtapa: 3 },
        { etapa: "ALISTADO", ordenEtapa: 4 },
        { etapa: "TERMINADO", ordenEtapa: 5 },
        { etapa: "INGRESO_ALMACEN", ordenEtapa: 6 },
      ];

      for (const e of etapasBase) {
        await tx.etapaProduccion.create({
          data: {
            ordenProduccionId: orden.id,
            etapa: e.etapa,
            ordenEtapa: e.ordenEtapa,
            cantidadRecibida: e.ordenEtapa === 1 ? cantidadPares : 0,
            cantidadProcesada: 0,
            cantidadObservada: 0,
            costoManoObra: 0,
            estadoEtapa: e.ordenEtapa === 1 ? "PENDIENTE" : "ESPERA",
            usuarioEmail: usuarioEmail || "admin@erp.com",
          },
        });
      }

      return orden;
    });

    const ordenCompleta = await prisma.ordenProduccion.findUnique({
      where: { id: resultado.id },
      include: {
        productoBase: true,
        almacenDestino: true,
        etapas: {
          orderBy: {
            ordenEtapa: "asc",
          },
        },
      },
    });

    const ordenEnriquecida = await enriquecerOrdenConInventario(prisma, ordenCompleta);

    res.status(201).json({
      ok: true,
      data: ordenEnriquecida,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /produccion/desde-pedido/:pedidoId
 * Crear orden de producción desde un pedido
 */
router.post("/desde-pedido/:pedidoId", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const pedidoId = req.params.pedidoId;
    const { usuarioEmail } = req.body;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        detalles: {
          include: {
            producto: true,
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

    if (!pedido.detalles.length) {
      return res.status(400).json({
        ok: false,
        error: "El pedido no tiene detalles",
      });
    }

    const primerDetalle = pedido.detalles[0];
    const producto = primerDetalle.producto;

    const corrida = {};
    for (const d of pedido.detalles) {
      const talla = String(d.talla);
      corrida[talla] = (corrida[talla] || 0) + Number(d.cantidad || 0);
    }

    const cantidadPares = Object.values(corrida).reduce(
      (acc, val) => acc + Number(val || 0),
      0
    );

    const count = await prisma.ordenProduccion.count();
    const codigo = `OP-${String(count + 1).padStart(6, "0")}`;

    const resultado = await prisma.$transaction(async (tx) => {
      const orden = await tx.ordenProduccion.create({
        data: {
          codigo,
          productoBaseId: producto.id,
          modelo: producto.modelo,
          color: producto.color,
          material: producto.material,
          taco: producto.taco,
          coleccion: producto.coleccion,
          cantidadPares,
          corridaJson: corrida,
          almacenDestinoId: pedido.almacenSolicitadoId,
          prioridad: pedido.prioridad || "MEDIA",
          fechaInicio: null,
          fechaCompromiso: pedido.fechaCompromiso,
          estadoGeneral: "LIBERADA",
          etapaActual: "CORTADO",
          paresComprometidos: cantidadPares,
          paresLibres: 0,
          observaciones: `Generada desde pedido ${pedido.codigo}`,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      const etapasBase = [
        { etapa: "CORTADO", ordenEtapa: 1 },
        { etapa: "PERFILADO", ordenEtapa: 2 },
        { etapa: "ARMADO", ordenEtapa: 3 },
        { etapa: "ALISTADO", ordenEtapa: 4 },
        { etapa: "TERMINADO", ordenEtapa: 5 },
        { etapa: "INGRESO_ALMACEN", ordenEtapa: 6 },
      ];

      for (const e of etapasBase) {
        await tx.etapaProduccion.create({
          data: {
            ordenProduccionId: orden.id,
            etapa: e.etapa,
            ordenEtapa: e.ordenEtapa,
            cantidadRecibida: e.ordenEtapa === 1 ? cantidadPares : 0,
            cantidadProcesada: 0,
            cantidadObservada: 0,
            costoManoObra: 0,
            estadoEtapa: e.ordenEtapa === 1 ? "PENDIENTE" : "ESPERA",
            usuarioEmail: usuarioEmail || "admin@erp.com",
          },
        });
      }

      await tx.historialPedido.create({
        data: {
          pedidoId: pedido.id,
          tipoEvento: "ASOCIACION_OP",
          estadoAnterior: `${pedido.estadoPedido} / ${pedido.estadoEntrega}`,
          estadoNuevo: `${pedido.estadoPedido} / EN_PRODUCCION`,
          detalle: `Se generó OP ${codigo} desde pedido`,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      await tx.pedido.update({
        where: { id: pedido.id },
        data: {
          estadoEntrega: "EN_PRODUCCION",
        },
      });

      return orden;
    });

    const ordenCompleta = await prisma.ordenProduccion.findUnique({
      where: { id: resultado.id },
      include: {
        productoBase: true,
        almacenDestino: true,
        etapas: {
          orderBy: {
            ordenEtapa: "asc",
          },
        },
      },
    });

    const ordenEnriquecida = await enriquecerOrdenConInventario(prisma, ordenCompleta);

    res.status(201).json({
      ok: true,
      data: ordenEnriquecida,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /produccion/:id/etapas/:etapa/iniciar
 * Iniciar una etapa de producción
 */
router.post("/:id/etapas/:etapa/iniciar", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const ordenId = req.params.id;
    const etapaNombre = req.params.etapa;

    const {
      responsableId,
      responsableNombre,
      fechaCompromiso,
      observaciones,
      costoManoObra,
      usuarioEmail,
    } = req.body;

    const orden = await prisma.ordenProduccion.findUnique({
      where: { id: ordenId },
      include: {
        etapas: {
          orderBy: { ordenEtapa: "asc" },
        },
      },
    });

    if (!orden) {
      return res.status(404).json({
        ok: false,
        error: "Orden de producción no encontrada",
      });
    }

    const etapa = orden.etapas.find(
      (e) => e.etapa.toUpperCase() === etapaNombre.toUpperCase()
    );

    if (!etapa) {
      return res.status(404).json({
        ok: false,
        error: "Etapa no encontrada",
      });
    }

    if (etapa.estadoEtapa === "TERMINADA") {
      return res.status(400).json({
        ok: false,
        error: "La etapa ya está terminada",
      });
    }

    const etapaActualizada = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.etapaProduccion.update({
        where: { id: etapa.id },
        data: {
          responsableId: responsableId || null,
          responsableNombre: responsableNombre || null,
          fechaInicio: new Date(),
          fechaCompromiso: fechaCompromiso ? new Date(fechaCompromiso) : null,
          observaciones: observaciones || null,
          costoManoObra: Number(costoManoObra || 0),
          estadoEtapa: "EN_PROCESO",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      await tx.ordenProduccion.update({
        where: { id: orden.id },
        data: {
          estadoGeneral: "EN_PROCESO",
          etapaActual: etapa.etapa,
        },
      });

      return actualizada;
    });

    res.json({
      ok: true,
      data: etapaActualizada,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /produccion/:id/etapas/:etapa/finalizar
 * Finalizar etapa y mover a la siguiente
 */
router.post("/:id/etapas/:etapa/finalizar", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const ordenId = req.params.id;
    const etapaNombre = req.params.etapa;

    const {
      cantidadProcesada,
      cantidadObservada,
      observaciones,
      usuarioEmail,
    } = req.body;

    const cantProc = Number(cantidadProcesada || 0);
    const cantObs = Number(cantidadObservada || 0);

    if (cantProc < 0 || cantObs < 0) {
      return res.status(400).json({
        ok: false,
        error: "Las cantidades no pueden ser negativas",
      });
    }

    const orden = await prisma.ordenProduccion.findUnique({
      where: { id: ordenId },
      include: {
        productoBase: true,
        almacenDestino: true,
        etapas: {
          orderBy: { ordenEtapa: "asc" },
        },
      },
    });

    if (!orden) {
      return res.status(404).json({
        ok: false,
        error: "Orden de producción no encontrada",
      });
    }

    const etapaActual = orden.etapas.find(
      (e) => e.etapa.toUpperCase() === etapaNombre.toUpperCase()
    );

    if (!etapaActual) {
      return res.status(404).json({
        ok: false,
        error: "Etapa no encontrada",
      });
    }

    const siguienteEtapa = orden.etapas.find(
      (e) => e.ordenEtapa === etapaActual.ordenEtapa + 1
    );

    const esIngresoAlmacen =
      etapaActual.etapa.toUpperCase() === "INGRESO_ALMACEN";

    const resultado = await prisma.$transaction(async (tx) => {
      const etapaTerminada = await tx.etapaProduccion.update({
        where: { id: etapaActual.id },
        data: {
          fechaFin: new Date(),
          cantidadProcesada: cantProc,
          cantidadObservada: cantObs,
          observaciones: observaciones || null,
          estadoEtapa: cantObs > 0 ? "OBSERVADA" : "TERMINADA",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      let etapaSiguienteActualizada = null;
      let movimientoProduccion = null;
      let ordenActualizada = null;
      let inventarioActualizado = null;
      let movimientoInventario = null;

      if (esIngresoAlmacen) {
        const inventarioExistente = await tx.inventario.findFirst({
          where: {
            productoId: orden.productoBaseId,
            almacenId: orden.almacenDestinoId,
          },
        });

        let stockAnterior = 0;
        let stockNuevo = cantProc;

        if (inventarioExistente) {
          stockAnterior = Number(inventarioExistente.stock || 0);
          stockNuevo = stockAnterior + cantProc;

          inventarioActualizado = await tx.inventario.update({
            where: { id: inventarioExistente.id },
            data: {
              stock: stockNuevo,
            },
            include: {
              producto: true,
              almacen: true,
            },
          });
        } else {
          const codigoBarrasBase =
            `PROD-${orden.productoBase.codigo}-${orden.almacenDestino.codigo}`
              .replace(/\s+/g, "-")
              .toUpperCase();

          const skuBase =
            `${orden.productoBase.modelo}-${orden.productoBase.color}-${orden.productoBase.talla}-${orden.almacenDestino.codigo}`
              .replace(/\s+/g, "-")
              .toUpperCase();

          inventarioActualizado = await tx.inventario.create({
            data: {
              productoId: orden.productoBaseId,
              almacenId: orden.almacenDestinoId,
              codigoBarras: codigoBarrasBase,
              sku: skuBase,
              stock: stockNuevo,
            },
            include: {
              producto: true,
              almacen: true,
            },
          });
        }

        movimientoInventario = await tx.movimientoInventario.create({
          data: {
            tipo: "INGRESO",
            productoId: orden.productoBaseId,
            almacenId: orden.almacenDestinoId,
            codigoBarras: inventarioActualizado.codigoBarras,
            sku: inventarioActualizado.sku,
            cantidad: cantProc,
            stockAnterior,
            stockNuevo,
            referencia: orden.codigo,
            nota:
              observaciones ||
              `Ingreso a almacén desde producción ${orden.codigo}`,
            usuarioEmail: usuarioEmail || "admin@erp.com",
          },
          include: {
            producto: true,
            almacen: true,
          },
        });

        ordenActualizada = await tx.ordenProduccion.update({
          where: { id: orden.id },
          data: {
            estadoGeneral: "TERMINADA",
            etapaActual: "INGRESO_ALMACEN",
            fechaEntregaReal: new Date(),
            observaciones: observaciones || orden.observaciones,
          },
        });
      } else if (siguienteEtapa) {
        etapaSiguienteActualizada = await tx.etapaProduccion.update({
          where: { id: siguienteEtapa.id },
          data: {
            cantidadRecibida: Number(siguienteEtapa.cantidadRecibida || 0) + cantProc,
            estadoEtapa: "PENDIENTE",
            usuarioEmail: usuarioEmail || "admin@erp.com",
          },
        });

        movimientoProduccion = await tx.movimientoProduccion.create({
          data: {
            ordenProduccionId: orden.id,
            etapaOrigen: etapaActual.etapa,
            etapaDestino: siguienteEtapa.etapa,
            responsableSale: etapaActual.responsableNombre || null,
            responsableEntra: null,
            cantidad: cantProc,
            observaciones: observaciones || null,
            usuarioEmail: usuarioEmail || "admin@erp.com",
          },
        });

        ordenActualizada = await tx.ordenProduccion.update({
          where: { id: orden.id },
          data: {
            estadoGeneral: "EN_PROCESO",
            etapaActual: siguienteEtapa.etapa,
          },
        });
      } else {
        ordenActualizada = await tx.ordenProduccion.update({
          where: { id: orden.id },
          data: {
            estadoGeneral: "TERMINADA",
            etapaActual: etapaActual.etapa,
            fechaEntregaReal: new Date(),
          },
        });
      }

      return {
        etapaTerminada,
        etapaSiguienteActualizada,
        movimientoProduccion,
        inventarioActualizado,
        movimientoInventario,
        ordenActualizada,
      };
    });

    res.json({
      ok: true,
      data: resultado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;