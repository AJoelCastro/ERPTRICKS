const express = require("express");
const router = express.Router();

function normalizarBoolean(valor) {
  if (valor === true || valor === "true" || valor === "1" || valor === 1) {
    return true;
  }
  if (valor === false || valor === "false" || valor === "0" || valor === 0) {
    return false;
  }
  return undefined;
}

// LISTAR ALMACENES
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { q, activo } = req.query;

    const where = {};

    const activoNormalizado = normalizarBoolean(activo);
    if (typeof activoNormalizado === "boolean") {
      where.activo = activoNormalizado;
    }

    if (q && String(q).trim()) {
      const texto = String(q).trim();

      where.OR = [
        {
          codigo: {
            contains: texto,
          },
        },
        {
          nombre: {
            contains: texto,
          },
        },
      ];
    }

    const almacenes = await prisma.almacen.findMany({
      where,
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

// OBTENER UN ALMACEN POR ID
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const almacen = await prisma.almacen.findUnique({
      where: { id },
    });

    if (!almacen) {
      return res.status(404).json({
        ok: false,
        error: "Almacén no encontrado",
      });
    }

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

// CREAR ALMACEN
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
        activo: true,
      },
    });

    res.json({
      ok: true,
      data: almacen,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "Ya existe un almacén con ese código",
      });
    }

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// ACTUALIZAR ALMACEN
router.put("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        ok: false,
        error: "codigo y nombre son obligatorios",
      });
    }

    const existe = await prisma.almacen.findUnique({
      where: { id },
    });

    if (!existe) {
      return res.status(404).json({
        ok: false,
        error: "Almacén no encontrado",
      });
    }

    const almacen = await prisma.almacen.update({
      where: { id },
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
    if (error.code === "P2002") {
      return res.status(400).json({
        ok: false,
        error: "Ya existe un almacén con ese código",
      });
    }

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// CAMBIAR ESTADO ACTIVO / INACTIVO
router.patch("/:id/estado", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { activo } = req.body;

    if (typeof activo !== "boolean") {
      return res.status(400).json({
        ok: false,
        error: "activo debe ser boolean",
      });
    }

    const existe = await prisma.almacen.findUnique({
      where: { id },
    });

    if (!existe) {
      return res.status(404).json({
        ok: false,
        error: "Almacén no encontrado",
      });
    }

    const almacen = await prisma.almacen.update({
      where: { id },
      data: {
        activo,
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

// ELIMINAR ALMACEN
router.delete("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const existe = await prisma.almacen.findUnique({
      where: { id },
    });

    if (!existe) {
      return res.status(404).json({
        ok: false,
        error: "Almacén no encontrado",
      });
    }

    await prisma.almacen.delete({
      where: { id },
    });

    res.json({
      ok: true,
      data: true,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;