const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const almacenes = await prisma.almacen.findMany({
      orderBy: { createdAt: "asc" },
    });

    res.json({
      ok: true,
      data: almacenes,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        ok: false,
        error: "codigo y nombre son obligatorios",
      });
    }

    const almacen = await prisma.almacen.create({
      data: {
        codigo: String(codigo).trim().toUpperCase(),
        nombre: String(nombre).trim(),
      },
    });

    res.json({
      ok: true,
      data: almacen,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;