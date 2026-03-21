const express = require("express");

const router = express.Router();

// GET /inventario
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const data = await prisma.inventario.findMany({
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

// GET /inventario/buscar-por-barras/:codigoBarras
router.get("/buscar-por-barras/:codigoBarras", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { codigoBarras } = req.params;
    const { almacenId } = req.query;

    const where = {
      codigoBarras: String(codigoBarras),
    };

    if (almacenId) {
      where.almacenId = String(almacenId);
    }

    const item = await prisma.inventario.findFirst({
      where,
      include: {
        producto: true,
        almacen: true,
      },
    });

    if (!item) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró inventario para ese código de barras",
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

// POST /inventario
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      productoId,
      almacenId,
      codigoBarras,
      sku,
      stock,
    } = req.body;

    if (!productoId || !almacenId || !codigoBarras || !sku) {
      return res.status(400).json({
        ok: false,
        error: "productoId, almacenId, codigoBarras y sku son obligatorios",
      });
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
    });

    if (!producto) {
      return res.status(404).json({
        ok: false,
        error: "Producto no encontrado",
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

    const inventario = await prisma.inventario.create({
      data: {
        productoId,
        almacenId,
        codigoBarras,
        sku,
        stock: Number(stock || 0),
      },
      include: {
        producto: true,
        almacen: true,
      },
    });

    res.status(201).json({
      ok: true,
      data: inventario,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /inventario/movimiento
router.post("/movimiento", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      tipo,
      productoId,
      almacenId,
      cantidad,
      referencia,
      nota,
      usuarioEmail,
    } = req.body;

    if (!tipo || !productoId || !almacenId || cantidad == null) {
      return res.status(400).json({
        ok: false,
        error: "tipo, productoId, almacenId y cantidad son obligatorios",
      });
    }

    const cantidadNum = Number(cantidad);

    if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "cantidad debe ser mayor a 0",
      });
    }

    const inventario = await prisma.inventario.findFirst({
      where: {
        productoId,
        almacenId,
      },
    });

    if (!inventario) {
      return res.status(404).json({
        ok: false,
        error: "Inventario no encontrado para ese producto y almacén",
      });
    }

    const stockAnterior = Number(inventario.stock || 0);
    let stockNuevo = stockAnterior;

    if (tipo === "INGRESO") {
      stockNuevo = stockAnterior + cantidadNum;
    } else if (tipo === "SALIDA") {
      stockNuevo = stockAnterior - cantidadNum;

      if (stockNuevo < 0) {
        return res.status(400).json({
          ok: false,
          error: "Stock insuficiente",
        });
      }
    } else if (tipo === "AJUSTE") {
      stockNuevo = cantidadNum;
    } else {
      return res.status(400).json({
        ok: false,
        error: "Tipo inválido. Usa INGRESO, SALIDA o AJUSTE",
      });
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const inventarioActualizado = await tx.inventario.update({
        where: { id: inventario.id },
        data: {
          stock: stockNuevo,
        },
        include: {
          producto: true,
          almacen: true,
        },
      });

      const movimiento = await tx.movimientoInventario.create({
        data: {
          tipo,
          productoId,
          almacenId,
          codigoBarras: inventario.codigoBarras,
          sku: inventario.sku,
          cantidad: cantidadNum,
          stockAnterior,
          stockNuevo,
          referencia: referencia || null,
          nota: nota || null,
          usuarioEmail: usuarioEmail || null,
        },
        include: {
          producto: true,
          almacen: true,
        },
      });

      return {
        inventarioActualizado,
        movimiento,
      };
    });

    res.status(201).json({
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