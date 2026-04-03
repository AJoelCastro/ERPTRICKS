const express = require("express");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const data = await prisma.material.findMany({
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

router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      codigo,
      nombre,
      descripcion,
      unidadMedida,
      costoReferencial,
      estado,
    } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        ok: false,
        error: "codigo y nombre son obligatorios",
      });
    }

    const existe = await prisma.material.findUnique({
      where: {
        codigo: String(codigo).trim().toUpperCase(),
      },
    });

    if (existe) {
      return res.status(400).json({
        ok: false,
        error: "Ya existe un material con ese código",
      });
    }

    const nuevo = await prisma.material.create({
      data: {
        codigo: String(codigo).trim().toUpperCase(),
        nombre: String(nombre).trim(),
        descripcion: descripcion
          ? String(descripcion).trim()
          : String(nombre).trim(),
        unidadMedida: unidadMedida
          ? String(unidadMedida).trim().toUpperCase()
          : "UND",
        costoReferencial: Number(costoReferencial || 0),
        estado: estado || "ACTIVO",
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