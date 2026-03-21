const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/permission.middleware");

function normalizarTexto(v) {
  return String(v || "").trim().toUpperCase();
}

router.get("/", authMiddleware, requirePermission("usuarios.roles"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const roles = await prisma.rol.findMany({
      include: {
        rolPermisos: {
          include: {
            permiso: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      ok: true,
      data: roles,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/", authMiddleware, requirePermission("usuarios.roles"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { codigo, nombre, descripcion, activo } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        ok: false,
        error: "codigo y nombre son obligatorios",
      });
    }

    const rol = await prisma.rol.create({
      data: {
        codigo: normalizarTexto(codigo),
        nombre: String(nombre).trim(),
        descripcion: descripcion ? String(descripcion).trim() : null,
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    res.status(201).json({
      ok: true,
      data: rol,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.put("/:id/permisos", authMiddleware, requirePermission("usuarios.roles"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { permisos = [] } = req.body;

    const rol = await prisma.rol.findUnique({
      where: { id },
    });

    if (!rol) {
      return res.status(404).json({
        ok: false,
        error: "Rol no encontrado",
      });
    }

    const permisosEncontrados = await prisma.permiso.findMany({
      where: {
        id: { in: permisos },
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.rolPermiso.deleteMany({
        where: { rolId: id },
      });

      if (permisosEncontrados.length > 0) {
        await tx.rolPermiso.createMany({
          data: permisosEncontrados.map((permiso) => ({
            rolId: id,
            permisoId: permiso.id,
          })),
        });
      }
    });

    res.json({
      ok: true,
      message: "Permisos del rol actualizados correctamente",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;