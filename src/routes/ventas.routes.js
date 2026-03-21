const express = require("express");

const router = express.Router();

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizarDoc(v) {
  return String(v || "").trim();
}

function toMoney(v) {
  return Number(Number(v || 0).toFixed(2));
}

function calcularEstadoVenta(total, adelanto) {
  const saldo = toMoney(total - adelanto);

  if (saldo <= 0) {
    return {
      estado: "PAGADO",
      saldo: 0,
    };
  }

  if (adelanto > 0) {
    return {
      estado: "PAGADO_PARCIAL",
      saldo,
    };
  }

  return {
    estado: "PENDIENTE",
    saldo,
  };
}

async function generarCorrelativoComprobante(tx, tipoComprobante) {
  const tipo = normalizarTexto(tipoComprobante || "NOTA_VENTA");

  let serie = "NV001";
  if (tipo === "BOLETA") serie = "B001";
  if (tipo === "FACTURA") serie = "F001";

  const ultimaVenta = await tx.venta.findFirst({
    where: {
      tipoComprobante: tipo,
      serie,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let correlativo = 1;

  if (ultimaVenta?.numero) {
    correlativo = Number(ultimaVenta.numero) + 1;
  }

  return {
    serie,
    numero: String(correlativo).padStart(8, "0"),
  };
}

async function generarCodigoVenta(tx) {
  const ultimaVenta = await tx.venta.findFirst({
    orderBy: {
      createdAt: "desc",
    },
  });

  let correlativo = 1;

  if (ultimaVenta?.codigo) {
    const partes = String(ultimaVenta.codigo).split("-");
    correlativo = Number(partes[1] || 0) + 1;
  }

  return `V-${String(correlativo).padStart(6, "0")}`;
}

/*
  GET /ventas
*/
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const ventas = await prisma.venta.findMany({
      include: {
        cliente: true,
        almacen: true,
        detalles: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      ok: true,
      data: ventas,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  GET /ventas/:id
*/
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        almacen: true,
        detalles: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!venta) {
      return res.status(404).json({
        ok: false,
        error: "Venta no encontrada",
      });
    }

    res.json({
      ok: true,
      data: venta,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  GET /ventas/buscar-por-barras/:codigo
  Para POS con escaneo QR / código de barras
*/
router.get("/buscar-por-barras/:codigo", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { codigo } = req.params;
    const { almacenId } = req.query;

    const whereInventario = {
      codigoBarras: codigo,
    };

    if (almacenId) {
      whereInventario.almacenId = String(almacenId);
    }

    const inventario = await prisma.inventario.findFirst({
      where: whereInventario,
      include: {
        producto: true,
        almacen: true,
      },
    });

    if (!inventario) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró producto con ese código",
      });
    }

    let alertaStock = null;

    if (Number(inventario.stock) <= 0) {
      alertaStock = "SIN_STOCK";
    } else if (Number(inventario.stock) <= 2) {
      alertaStock = "ULTIMOS_PARES";
    }

    res.json({
      ok: true,
      data: {
        ...inventario,
        alertaStock,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  POST /ventas

  body esperado:
  {
    "clienteId": "...",
    "almacenId": "...",
    "tipoComprobante": "BOLETA",
    "metodoPago": "EFECTIVO",
    "adelanto": 0,
    "descuento": 0,
    "fechaEnvio": null,
    "docCliente": "12345678",
    "razonSocial": "JUAN PEREZ",
    "direccionFiscal": "LIMA",
    "detalles": [
      {
        "productoId": "...",
        "cantidad": 2,
        "precioUnitario": 149.90
      }
    ]
  }
*/
router.post("/", async (req, res) => {
  const prisma = req.app.locals.prisma;

  try {
    const {
      clienteId,
      almacenId,
      tipoComprobante = "NOTA_VENTA",
      metodoPago,
      adelanto = 0,
      descuento = 0,
      fechaEnvio = null,
      docCliente = null,
      razonSocial = null,
      direccionFiscal = null,
      detalles = [],
    } = req.body;

    if (!clienteId) {
      return res.status(400).json({
        ok: false,
        error: "clienteId es obligatorio",
      });
    }

    if (!almacenId) {
      return res.status(400).json({
        ok: false,
        error: "almacenId es obligatorio",
      });
    }

    if (!metodoPago) {
      return res.status(400).json({
        ok: false,
        error: "metodoPago es obligatorio",
      });
    }

    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar al menos un detalle",
      });
    }

    const tipoComprobanteN = normalizarTexto(tipoComprobante);

    if (!["BOLETA", "FACTURA", "NOTA_VENTA"].includes(tipoComprobanteN)) {
      return res.status(400).json({
        ok: false,
        error: "tipoComprobante inválido. Usa BOLETA, FACTURA o NOTA_VENTA",
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

    const almacen = await prisma.almacen.findUnique({
      where: { id: almacenId },
    });

    if (!almacen) {
      return res.status(404).json({
        ok: false,
        error: "Almacén no encontrado",
      });
    }

    const ventaCreada = await prisma.$transaction(async (tx) => {
      let totalProductos = 0;
      let totalBrutoConIgv = 0;

      const inventariosProcesados = [];

      for (const item of detalles) {
        if (!item.productoId) {
          throw new Error("Cada detalle debe tener productoId");
        }

        const cantidad = Number(item.cantidad || 0);
        const precioUnitario = Number(item.precioUnitario || 0);

        if (cantidad <= 0) {
          throw new Error("La cantidad debe ser mayor a 0");
        }

        if (precioUnitario < 0) {
          throw new Error("El precioUnitario no puede ser negativo");
        }

        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
        });

        if (!producto) {
          throw new Error(`Producto no encontrado: ${item.productoId}`);
        }

        const inventario = await tx.inventario.findFirst({
          where: {
            productoId: item.productoId,
            almacenId,
          },
        });

        if (!inventario) {
          throw new Error(
            `No existe inventario para el producto ${producto.codigo} en ese almacén`
          );
        }

        if (inventario.stock < cantidad) {
          throw new Error(
            `Stock insuficiente para ${producto.modelo}. Stock actual: ${inventario.stock}`
          );
        }

        totalProductos += cantidad;
        totalBrutoConIgv += cantidad * precioUnitario;

        inventariosProcesados.push({
          producto,
          inventario,
          cantidad,
          precioUnitario,
        });
      }

      const descuentoNum = toMoney(descuento || 0);
      const adelantoNum = toMoney(adelanto || 0);

      let totalConIgv = toMoney(totalBrutoConIgv - descuentoNum);
      if (totalConIgv < 0) totalConIgv = 0;

      const subtotalSinIgv = toMoney(totalConIgv / 1.18);
      const igv = toMoney(totalConIgv - subtotalSinIgv);

      const { estado, saldo } = calcularEstadoVenta(totalConIgv, adelantoNum);

      const codigoVenta = await generarCodigoVenta(tx);
      const { serie, numero } = await generarCorrelativoComprobante(
        tx,
        tipoComprobanteN
      );

      const venta = await tx.venta.create({
        data: {
          codigo: codigoVenta,
          clienteId,
          almacenId,
          totalProductos,
          subtotalSinIgv,
          descuento: descuentoNum,
          igv,
          totalConIgv,
          metodoPago: normalizarTexto(metodoPago),
          adelanto: adelantoNum,
          saldo,
          estado,
          fechaEnvio: fechaEnvio ? new Date(fechaEnvio) : null,
          tipoComprobante: tipoComprobanteN,
          serie,
          numero,
          docCliente: normalizarDoc(docCliente || cliente.dni || ""),
          razonSocial: razonSocial
            ? normalizarTexto(razonSocial)
            : normalizarTexto(`${cliente.nombres} ${cliente.apellidos}`),
          direccionFiscal: direccionFiscal
            ? String(direccionFiscal).trim()
            : cliente.direccion || null,
        },
      });

      for (const item of inventariosProcesados) {
        const subtotal = toMoney(item.cantidad * item.precioUnitario);
        const nuevoStock = Number(item.inventario.stock) - item.cantidad;

        await tx.detalleVenta.create({
          data: {
            ventaId: venta.id,
            productoId: item.producto.id,
            codigoBarras: item.inventario.codigoBarras,
            sku: item.inventario.sku,
            modelo: item.producto.modelo,
            color: item.producto.color,
            material: item.producto.material,
            talla: item.producto.talla,
            taco: item.producto.taco,
            cantidad: item.cantidad,
            precioUnitario: toMoney(item.precioUnitario),
            subtotal,
            fechaEnvio: fechaEnvio ? new Date(fechaEnvio) : null,
          },
        });

        await tx.inventario.update({
          where: {
            id: item.inventario.id,
          },
          data: {
            stock: nuevoStock,
          },
        });

        await tx.movimientoInventario.create({
          data: {
            tipo: "SALIDA",
            productoId: item.producto.id,
            almacenId,
            codigoBarras: item.inventario.codigoBarras,
            sku: item.inventario.sku,
            cantidad: item.cantidad,
            stockAnterior: Number(item.inventario.stock),
            stockNuevo: nuevoStock,
            referencia: venta.codigo,
            nota: "Salida por venta POS",
            usuarioEmail: "admin@erp.com",
          },
        });
      }

      if (adelantoNum > 0) {
        const cajaAbierta = await tx.caja.findFirst({
          where: {
            almacenId,
            estado: "ABIERTA",
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (cajaAbierta) {
          const saldoCajaActual = Number(cajaAbierta.saldoActual || 0);
          const nuevoSaldoCaja = toMoney(saldoCajaActual + adelantoNum);

          await tx.movimientoCaja.create({
            data: {
              cajaId: cajaAbierta.id,
              tipo: "INGRESO",
              subtipo: "PAGO_VENTA",
              monto: adelantoNum,
              moneda: "PEN",
              metodoPago: normalizarTexto(metodoPago),
              referencia: venta.codigo,
              proveedor: null,
              persona: normalizarTexto(`${cliente.nombres} ${cliente.apellidos}`),
              usuarioEmail: "admin@erp.com",
              facturaSiNo: null,
              numFactura: null,
              vinculo: venta.id,
              detalle: `Pago registrado para venta ${venta.codigo}`,
              saldoPost: nuevoSaldoCaja,
              notas: `Adelanto inicial de venta ${venta.codigo}`,
            },
          });

          await tx.caja.update({
            where: { id: cajaAbierta.id },
            data: {
              saldoActual: nuevoSaldoCaja,
            },
          });
        }
      }

      return tx.venta.findUnique({
        where: { id: venta.id },
        include: {
          cliente: true,
          almacen: true,
          detalles: {
            include: {
              producto: true,
            },
          },
        },
      });
    });

    res.status(201).json({
      ok: true,
      data: ventaCreada,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

/*
  POST /ventas/:id/pagos
  Registrar pago posterior / adelanto adicional
*/
router.post("/:id/pagos", async (req, res) => {
  const prisma = req.app.locals.prisma;

  try {
    const { id } = req.params;
    const { monto, metodoPago, nota } = req.body;

    const montoNum = toMoney(monto || 0);

    if (montoNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0",
      });
    }

    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente: true,
        almacen: true,
      },
    });

    if (!venta) {
      return res.status(404).json({
        ok: false,
        error: "Venta no encontrada",
      });
    }

    const adelantoActual = Number(venta.adelanto || 0);
    const totalVenta = Number(venta.totalConIgv || 0);

    let nuevoAdelanto = toMoney(adelantoActual + montoNum);
    if (nuevoAdelanto > totalVenta) {
      nuevoAdelanto = totalVenta;
    }

    const { estado, saldo } = calcularEstadoVenta(totalVenta, nuevoAdelanto);

    const resultado = await prisma.$transaction(async (tx) => {
      const ventaActualizada = await tx.venta.update({
        where: { id },
        data: {
          adelanto: nuevoAdelanto,
          saldo,
          estado,
          metodoPago: metodoPago
            ? normalizarTexto(metodoPago)
            : venta.metodoPago,
        },
      });

      const cajaAbierta = await tx.caja.findFirst({
        where: {
          almacenId: venta.almacenId,
          estado: "ABIERTA",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (cajaAbierta) {
        const saldoCajaActual = Number(cajaAbierta.saldoActual || 0);
        const nuevoSaldoCaja = toMoney(saldoCajaActual + montoNum);

        await tx.movimientoCaja.create({
          data: {
            cajaId: cajaAbierta.id,
            tipo: "INGRESO",
            subtipo: "PAGO_VENTA",
            monto: montoNum,
            moneda: "PEN",
            metodoPago: metodoPago
              ? normalizarTexto(metodoPago)
              : venta.metodoPago,
            referencia: venta.codigo,
            proveedor: null,
            persona: normalizarTexto(
              `${venta.cliente.nombres} ${venta.cliente.apellidos}`
            ),
            usuarioEmail: "admin@erp.com",
            facturaSiNo: null,
            numFactura: null,
            vinculo: venta.id,
            detalle: nota || `Pago adicional registrado para venta ${venta.codigo}`,
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

      return ventaActualizada;
    });

    res.json({
      ok: true,
      data: resultado,
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;