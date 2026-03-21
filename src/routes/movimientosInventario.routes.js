const express = require("express");
const router = express.Router();

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

// GET /movimientos-inventario
// Filtros opcionales:
// ?q=texto
// ?tipo=INGRESO|SALIDA|AJUSTE|TRANSFERENCIA
// ?almacenId=...
// ?productoId=...
// ?fechaDesde=2026-03-01
// ?fechaHasta=2026-03-31
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      q,
      tipo,
      almacenId,
      productoId,
      fechaDesde,
      fechaHasta,
    } = req.query;

    const where = {};

    if (tipo) {
      where.tipo = normalizarTexto(tipo);
    }

    if (almacenId) {
      where.almacenId = String(almacenId);
    }

    if (productoId) {
      where.productoId = String(productoId);
    }

    if (fechaDesde || fechaHasta) {
      where.createdAt = {};

      if (fechaDesde) {
        where.createdAt.gte = new Date(`${fechaDesde}T00:00:00.000Z`);
      }

      if (fechaHasta) {
        where.createdAt.lte = new Date(`${fechaHasta}T23:59:59.999Z`);
      }
    }

    if (q) {
      const texto = String(q).trim();

      where.OR = [
        { codigoBarras: { contains: texto, mode: "insensitive" } },
        { sku: { contains: texto, mode: "insensitive" } },
        { referencia: { contains: texto, mode: "insensitive" } },
        { nota: { contains: texto, mode: "insensitive" } },
        { usuarioEmail: { contains: texto, mode: "insensitive" } },
        {
          producto: {
            codigo: { contains: texto, mode: "insensitive" },
          },
        },
        {
          producto: {
            modelo: { contains: texto, mode: "insensitive" },
          },
        },
        {
          producto: {
            color: { contains: texto, mode: "insensitive" },
          },
        },
        {
          producto: {
            material: { contains: texto, mode: "insensitive" },
          },
        },
        {
          almacen: {
            codigo: { contains: texto, mode: "insensitive" },
          },
        },
        {
          almacen: {
            nombre: { contains: texto, mode: "insensitive" },
          },
        },
      ];
    }

    const data = await prisma.movimientoInventario.findMany({
      where,
      include: {
        producto: true,
        almacen: true,
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

// GET /movimientos-inventario/:id
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const item = await prisma.movimientoInventario.findUnique({
      where: { id },
      include: {
        producto: true,
        almacen: true,
      },
    });

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: "Movimiento no encontrado",
      });
    }

    res.json({
      ok: true,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /movimientos-inventario
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      tipo,
      productoId,
      almacenId,
      codigoBarras,
      sku,
      cantidad,
      stockAnterior,
      stockNuevo,
      referencia,
      nota,
      usuarioEmail,
    } = req.body;

    if (
      !tipo ||
      !productoId ||
      !almacenId ||
      cantidad === undefined ||
      stockAnterior === undefined ||
      stockNuevo === undefined
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "tipo, productoId, almacenId, cantidad, stockAnterior y stockNuevo son obligatorios",
      });
    }

    const nuevo = await prisma.movimientoInventario.create({
      data: {
        tipo: normalizarTexto(tipo),
        productoId,
        almacenId,
        codigoBarras: codigoBarras || null,
        sku: sku || null,
        cantidad: Number(cantidad),
        stockAnterior: Number(stockAnterior),
        stockNuevo: Number(stockNuevo),
        referencia: referencia || null,
        nota: nota || null,
        usuarioEmail: usuarioEmail || null,
      },
      include: {
        producto: true,
        almacen: true,
      },
    });

    res.status(201).json({
      ok: true,
      data: nuevo,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;