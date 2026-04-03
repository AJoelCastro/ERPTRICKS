const express = require("express");

const router = express.Router();

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

function slugTexto(v) {
  return normalizarTexto(v).replace(/\s+/g, "-");
}

function generarSkuDesdeProducto(producto) {
  return [
    slugTexto(producto.modelo),
    slugTexto(producto.color),
    slugTexto(producto.material),
    slugTexto(producto.taco),
    String(producto.talla),
  ].join("-");
}

async function generarCodigoCompra(prisma) {
  const total = await prisma.compra.count();
  return `C-${String(total + 1).padStart(6, "0")}`;
}

async function generarCodigoBarrasUnico(prisma) {
  while (true) {
    const candidato = `775${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`.slice(0, 13);

    const existe = await prisma.inventario.findFirst({
      where: { codigoBarras: candidato },
    });

    if (!existe) return candidato;
  }
}

function mapProductoCatalogo(producto) {
  const descripcion = [
    producto.modelo,
    producto.color,
    producto.material,
    producto.taco,
    `T${producto.talla}`,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    tipoItem: "PRODUCTO",
    itemId: producto.id,
    productoId: producto.id,
    codigo: producto.codigo,
    nombre: producto.modelo || producto.codigo,
    descripcion,
    unidadMedida: "PAR",
    costoReferencial: Number(producto.costo || 0),
    precioReferencial: Number(producto.precio || 0),
    estado: producto.estado,
    raw: producto,
  };
}

function mapSimpleCatalogo(tipoItem, item) {
  return {
    tipoItem,
    itemId: item.id,
    productoId: null,
    codigo: item.codigo,
    nombre: item.nombre,
    descripcion: item.descripcion || item.nombre || item.codigo,
    unidadMedida: item.unidadMedida || "UND",
    costoReferencial: Number(item.costoReferencial || 0),
    precioReferencial: null,
    estado: item.estado,
    raw: item,
  };
}

async function obtenerCatalogoCompra(prisma) {
  const promesas = [
    prisma.producto.findMany({
      where: { estado: "ACTIVO" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.material?.findMany
      ? prisma.material.findMany({
          where: { estado: "ACTIVO" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.insumo?.findMany
      ? prisma.insumo.findMany({
          where: { estado: "ACTIVO" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ];

  const [productos, materiales, insumos] = await Promise.all(promesas);

  return [
    ...(productos || []).map(mapProductoCatalogo),
    ...(materiales || []).map((x) => mapSimpleCatalogo("MATERIAL", x)),
    ...(insumos || []).map((x) => mapSimpleCatalogo("INSUMO", x)),
  ];
}

// GET /compras/catalogo-items
router.get("/catalogo-items", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const data = await obtenerCatalogoCompra(prisma);

    res.json({
      ok: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /compras
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { q, proveedorId, almacenId, estadoCompra, estadoRecepcion } = req.query;

    const where = {};

    if (proveedorId) where.proveedorId = String(proveedorId);
    if (almacenId) where.almacenId = String(almacenId);
    if (estadoCompra) where.estadoCompra = normalizarTexto(estadoCompra);
    if (estadoRecepcion) where.estadoRecepcion = normalizarTexto(estadoRecepcion);

    if (q) {
      const texto = String(q).trim();

      where.OR = [
        { codigo: { contains: texto, mode: "insensitive" } },
        {
          proveedor: {
            codigo: { contains: texto, mode: "insensitive" },
          },
        },
        {
          proveedor: {
            dni: { contains: texto, mode: "insensitive" },
          },
        },
        {
          proveedor: {
            ruc: { contains: texto, mode: "insensitive" },
          },
        },
        {
          proveedor: {
            nombres: { contains: texto, mode: "insensitive" },
          },
        },
        {
          proveedor: {
            apellidos: { contains: texto, mode: "insensitive" },
          },
        },
        {
          proveedor: {
            razonSocial: { contains: texto, mode: "insensitive" },
          },
        },
        {
          detalles: {
            some: {
              codigoItem: { contains: texto, mode: "insensitive" },
            },
          },
        },
        {
          detalles: {
            some: {
              descripcionItem: { contains: texto, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const data = await prisma.compra.findMany({
      where,
      include: {
        proveedor: true,
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
      data,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /compras/:id
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const compra = await prisma.compra.findUnique({
      where: { id },
      include: {
        proveedor: true,
        almacen: true,
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

    if (!compra) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada",
      });
    }

    res.json({
      ok: true,
      data: compra,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /compras
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      proveedorId,
      almacenId,
      fechaCompra,
      fechaRecepcion,
      metodoPago,
      adelanto,
      descuento,
      observaciones,
      usuarioEmail,
      detalle,
    } = req.body;

    if (!proveedorId || !almacenId) {
      return res.status(400).json({
        ok: false,
        error: "proveedorId y almacenId son obligatorios",
      });
    }

    if (!Array.isArray(detalle) || detalle.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Debes enviar al menos una línea en detalle",
      });
    }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id: proveedorId },
    });

    if (!proveedor) {
      return res.status(404).json({
        ok: false,
        error: "Proveedor no encontrado",
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

    const detallePreparado = [];
    let subtotalBruto = 0;

    for (const item of detalle) {
      const {
        tipoItem,
        itemId,
        productoId,
        codigoItem,
        descripcionItem,
        unidadMedida,
        cantidad,
        costoUnitario,
        observaciones: obsLinea,
      } = item;

      if (
        !tipoItem ||
        !itemId ||
        !codigoItem ||
        !descripcionItem ||
        !cantidad ||
        costoUnitario === undefined
      ) {
        return res.status(400).json({
          ok: false,
          error:
            "Cada línea debe tener tipoItem, itemId, codigoItem, descripcionItem, cantidad y costoUnitario",
        });
      }

      const tipoNormalizado = normalizarTexto(tipoItem);
      const cantidadNum = Number(cantidad);
      const costoNum = Number(costoUnitario);

      if (!["PRODUCTO", "MATERIAL", "INSUMO"].includes(tipoNormalizado)) {
        return res.status(400).json({
          ok: false,
          error: `Tipo de ítem inválido: ${tipoItem}`,
        });
      }

      if (isNaN(cantidadNum) || cantidadNum <= 0) {
        return res.status(400).json({
          ok: false,
          error: "La cantidad debe ser mayor a 0",
        });
      }

      if (isNaN(costoNum) || costoNum < 0) {
        return res.status(400).json({
          ok: false,
          error: "El costoUnitario debe ser válido",
        });
      }

      let productoRelacionado = null;

      if (tipoNormalizado === "PRODUCTO") {
        const producto = await prisma.producto.findUnique({
          where: { id: productoId || itemId },
        });

        if (!producto) {
          return res.status(404).json({
            ok: false,
            error: `Producto no encontrado: ${productoId || itemId}`,
          });
        }

        productoRelacionado = producto;
      } else if (tipoNormalizado === "MATERIAL") {
        if (prisma.material?.findUnique) {
          const material = await prisma.material.findUnique({
            where: { id: itemId },
          });

          if (!material) {
            return res.status(404).json({
              ok: false,
              error: `Material no encontrado: ${itemId}`,
            });
          }
        }
      } else if (tipoNormalizado === "INSUMO") {
        if (prisma.insumo?.findUnique) {
          const insumo = await prisma.insumo.findUnique({
            where: { id: itemId },
          });

          if (!insumo) {
            return res.status(404).json({
              ok: false,
              error: `Insumo no encontrado: ${itemId}`,
            });
          }
        }
      }

      const subtotalLinea = Number((cantidadNum * costoNum).toFixed(2));
      subtotalBruto += subtotalLinea;

      detallePreparado.push({
        tipoItem: tipoNormalizado,
        itemId,
        productoId: tipoNormalizado === "PRODUCTO" ? productoRelacionado.id : null,
        codigoItem,
        descripcionItem,
        unidadMedida: unidadMedida || "UND",
        cantidad: cantidadNum,
        costoUnitario: costoNum,
        subtotal: subtotalLinea,
        observaciones: obsLinea || null,
      });
    }

    const descuentoNum = Number(descuento || 0);
    let total = subtotalBruto - descuentoNum;
    if (total < 0) total = 0;

    const subtotalSinIgv = Number((total / 1.18).toFixed(2));
    const igv = Number((total - subtotalSinIgv).toFixed(2));
    const adelantoNum = Number(adelanto || 0);
    const saldo = Number(Math.max(0, total - adelantoNum).toFixed(2));

    let estadoCompra = "REGISTRADA";
    if (adelantoNum > 0 && saldo > 0) estadoCompra = "PAGADO_PARCIAL";
    if (saldo <= 0) estadoCompra = "PAGADA";

    const codigo = await generarCodigoCompra(prisma);

    const resultado = await prisma.$transaction(async (tx) => {
      const compra = await tx.compra.create({
        data: {
          codigo,
          proveedorId,
          almacenId,
          fechaCompra: fechaCompra ? new Date(fechaCompra) : new Date(),
          fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : null,
          subtotal: subtotalSinIgv,
          descuento: descuentoNum,
          igv,
          total,
          adelanto: adelantoNum,
          saldo,
          metodoPago: metodoPago || null,
          estadoCompra,
          estadoRecepcion: "PENDIENTE",
          observaciones: observaciones || null,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      await tx.detalleCompra.createMany({
        data: detallePreparado.map((d) => ({
          compraId: compra.id,
          ...d,
        })),
      });

      await tx.historialCompra.create({
        data: {
          compraId: compra.id,
          tipoEvento: "CREACION",
          estadoAnterior: null,
          estadoNuevo: `${estadoCompra} / PENDIENTE`,
          detalle: "Compra registrada",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return compra;
    });

    const compraCompleta = await prisma.compra.findUnique({
      where: { id: resultado.id },
      include: {
        proveedor: true,
        almacen: true,
        detalles: {
          include: {
            producto: true,
          },
        },
        historial: true,
      },
    });

    res.status(201).json({
      ok: true,
      data: compraCompleta,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /compras/:id/pagos
router.post("/:id/pagos", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const compraId = req.params.id;

    const { monto, metodoPago, nota, usuarioEmail } = req.body;

    const montoNum = Number(monto);

    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0",
      });
    }

    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
      include: {
        proveedor: true,
        almacen: true,
      },
    });

    if (!compra) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada",
      });
    }

    if (compra.estadoCompra === "CANCELADA") {
      return res.status(400).json({
        ok: false,
        error: "No puedes pagar una compra cancelada",
      });
    }

    const total = Number(compra.total);
    const adelantoActual = Number(compra.adelanto);

    let nuevoAdelanto = adelantoActual + montoNum;
    if (nuevoAdelanto > total) {
      nuevoAdelanto = total;
    }

    const nuevoSaldo = Number((total - nuevoAdelanto).toFixed(2));

    let nuevoEstadoCompra = "PAGADO_PARCIAL";
    if (nuevoSaldo <= 0) nuevoEstadoCompra = "PAGADA";
    else if (nuevoAdelanto <= 0) nuevoEstadoCompra = "REGISTRADA";

    const resultado = await prisma.$transaction(async (tx) => {
      const compraActualizada = await tx.compra.update({
        where: { id: compraId },
        data: {
          adelanto: nuevoAdelanto,
          saldo: nuevoSaldo,
          estadoCompra: nuevoEstadoCompra,
          metodoPago: metodoPago || compra.metodoPago || null,
        },
      });

      await tx.historialCompra.create({
        data: {
          compraId: compra.id,
          tipoEvento: "PAGO",
          estadoAnterior: compra.estadoCompra,
          estadoNuevo: nuevoEstadoCompra,
          detalle: nota || `Pago registrado por ${montoNum}`,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      const cajaAbierta = await tx.caja.findFirst({
        where: {
          almacenId: compra.almacenId,
          estado: "ABIERTA",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      let movimientoCaja = null;

      if (cajaAbierta) {
        const saldoActualCaja = Number(cajaAbierta.saldoActual);
        const nuevoSaldoCaja = Number((saldoActualCaja - montoNum).toFixed(2));

        if (nuevoSaldoCaja < 0) {
          throw new Error("La caja no tiene saldo suficiente para registrar este pago");
        }

        movimientoCaja = await tx.movimientoCaja.create({
          data: {
            cajaId: cajaAbierta.id,
            tipo: "EGRESO",
            subtipo: "PAGO_COMPRA",
            monto: montoNum,
            moneda: "PEN",
            metodoPago: metodoPago || compra.metodoPago || null,
            referencia: compra.codigo,
            proveedor:
              compra.proveedor.tipoProveedor === "PERSONA_JURIDICA"
                ? compra.proveedor.razonSocial
                : null,
            persona:
              compra.proveedor.tipoProveedor === "PERSONA_NATURAL"
                ? `${compra.proveedor.nombres || ""} ${compra.proveedor.apellidos || ""}`.trim()
                : compra.proveedor.razonSocial,
            usuarioEmail: usuarioEmail || "admin@erp.com",
            facturaSiNo: null,
            numFactura: null,
            vinculo: compra.id,
            detalle: `Pago registrado para compra ${compra.codigo}`,
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
        compraActualizada,
        movimientoCaja,
      };
    });

    res.status(201).json({
      ok: true,
      message: "Pago de compra registrado correctamente",
      data: resultado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /compras/:id/ingresar-inventario
router.post("/:id/ingresar-inventario", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const compraId = req.params.id;
    const { usuarioEmail, nota } = req.body;

    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
      include: {
        proveedor: true,
        almacen: true,
        detalles: {
          include: {
            producto: true,
          },
        },
      },
    });

    if (!compra) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada",
      });
    }

    if (compra.estadoCompra === "CANCELADA") {
      return res.status(400).json({
        ok: false,
        error: "No puedes ingresar inventario de una compra cancelada",
      });
    }

    if (compra.estadoRecepcion === "INGRESADA") {
      return res.status(400).json({
        ok: false,
        error: "La compra ya fue ingresada al inventario",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const movimientos = [];
      let productosProcesados = 0;
      let itemsNoInventariables = 0;

      for (const d of compra.detalles) {
        const cantidadNum = Number(d.cantidad);

        if (d.tipoItem !== "PRODUCTO" || !d.productoId || !d.producto) {
          itemsNoInventariables += 1;
          continue;
        }

        let inventario = await tx.inventario.findFirst({
          where: {
            productoId: d.productoId,
            almacenId: compra.almacenId,
          },
        });

        let stockAnterior = 0;
        let stockNuevo = cantidadNum;

        if (inventario) {
          stockAnterior = Number(inventario.stock || 0);
          stockNuevo = stockAnterior + cantidadNum;

          inventario = await tx.inventario.update({
            where: { id: inventario.id },
            data: {
              stock: stockNuevo,
              sku: inventario.sku || generarSkuDesdeProducto(d.producto),
            },
          });
        } else {
          const sku = generarSkuDesdeProducto(d.producto);
          const codigoBarras = await generarCodigoBarrasUnico(tx);

          inventario = await tx.inventario.create({
            data: {
              productoId: d.productoId,
              almacenId: compra.almacenId,
              codigoBarras,
              sku,
              stock: stockNuevo,
            },
          });
        }

        const movimiento = await tx.movimientoInventario.create({
          data: {
            tipo: "INGRESO",
            productoId: d.productoId,
            almacenId: compra.almacenId,
            codigoBarras: inventario.codigoBarras,
            sku: inventario.sku,
            cantidad: cantidadNum,
            stockAnterior,
            stockNuevo,
            referencia: compra.codigo,
            nota: nota || `Ingreso por compra ${compra.codigo}`,
            usuarioEmail: usuarioEmail || "admin@erp.com",
          },
        });

        movimientos.push(movimiento);
        productosProcesados += 1;
      }

      const compraActualizada = await tx.compra.update({
        where: { id: compra.id },
        data: {
          estadoRecepcion: "INGRESADA",
          fechaRecepcion: new Date(),
        },
      });

      const detalleHistorial = [
        productosProcesados > 0
          ? `${productosProcesados} línea(s) de producto ingresadas a inventario`
          : null,
        itemsNoInventariables > 0
          ? `${itemsNoInventariables} línea(s) de material/insumo marcadas como recibidas`
          : null,
      ]
        .filter(Boolean)
        .join(". ");

      await tx.historialCompra.create({
        data: {
          compraId: compra.id,
          tipoEvento: "INGRESO_INVENTARIO",
          estadoAnterior: compra.estadoRecepcion,
          estadoNuevo: "INGRESADA",
          detalle:
            nota ||
            detalleHistorial ||
            "Compra recibida correctamente",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return {
        compraActualizada,
        movimientos,
        productosProcesados,
        itemsNoInventariables,
      };
    });

    res.json({
      ok: true,
      message: "Compra procesada correctamente",
      data: resultado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /compras/:id/cancelar
router.post("/:id/cancelar", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const compraId = req.params.id;
    const { detalle, usuarioEmail } = req.body;

    const compra = await prisma.compra.findUnique({
      where: { id: compraId },
    });

    if (!compra) {
      return res.status(404).json({
        ok: false,
        error: "Compra no encontrada",
      });
    }

    if (compra.estadoRecepcion === "INGRESADA") {
      return res.status(400).json({
        ok: false,
        error: "No puedes cancelar una compra ya ingresada a inventario",
      });
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      const compraActualizada = await tx.compra.update({
        where: { id: compraId },
        data: {
          estadoCompra: "CANCELADA",
          estadoRecepcion: "CANCELADA",
        },
      });

      await tx.historialCompra.create({
        data: {
          compraId,
          tipoEvento: "CANCELACION",
          estadoAnterior: `${compra.estadoCompra} / ${compra.estadoRecepcion}`,
          estadoNuevo: "CANCELADA / CANCELADA",
          detalle: detalle || "Compra cancelada",
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      return compraActualizada;
    });

    res.json({
      ok: true,
      data: actualizada,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;