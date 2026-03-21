const express = require("express");
const router = express.Router();

const authLib = require("../lib/auth");
const authMiddleware = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/permission.middleware");

function normalizarTexto(v) {
  return String(v || "").trim();
}

router.get("/", authMiddleware, requirePermission("usuarios.ver"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const usuarios = await prisma.usuario.findMany({
      include: {
        usuarioRoles: {
          include: {
            rol: true,
          },
        },
        usuarioPermisos: {
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
      data: usuarios,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.post("/", authMiddleware, requirePermission("usuarios.crear"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const { email, username, password, nombre, activo } = req.body;

    if (!email || !username || !password || !nombre) {
      return res.status(400).json({
        ok: false,
        error: "email, username, password y nombre son obligatorios",
      });
    }

    const emailNormalizado = String(email).trim().toLowerCase();
    const usernameNormalizado = String(username).trim().toLowerCase();

    const existeEmail = await prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });

    if (existeEmail) {
      return res.status(400).json({
        ok: false,
        error: "El email ya existe",
      });
    }

    const existeUsername = await prisma.usuario.findUnique({
      where: { username: usernameNormalizado },
    });

    if (existeUsername) {
      return res.status(400).json({
        ok: false,
        error: "El username ya existe",
      });
    }

    const passwordHash = await authLib.hashPassword(password);

    const usuario = await prisma.usuario.create({
      data: {
        email: emailNormalizado,
        username: usernameNormalizado,
        passwordHash,
        nombre: normalizarTexto(nombre),
        activo: activo !== undefined ? Boolean(activo) : true,
      },
    });

    res.status(201).json({
      ok: true,
      data: usuario,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.put("/:id", authMiddleware, requirePermission("usuarios.editar"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { email, username, nombre, activo } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no encontrado",
      });
    }

    const actualizado = await prisma.usuario.update({
      where: { id },
      data: {
        email: email !== undefined ? String(email).trim().toLowerCase() : usuario.email,
        username: username !== undefined ? String(username).trim().toLowerCase() : usuario.username,
        nombre: nombre !== undefined ? normalizarTexto(nombre) : usuario.nombre,
        activo: activo !== undefined ? Boolean(activo) : usuario.activo,
      },
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

router.patch("/:id/password", authMiddleware, requirePermission("usuarios.editar"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        ok: false,
        error: "password es obligatorio",
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no encontrado",
      });
    }

    const passwordHash = await authLib.hashPassword(password);

    await prisma.usuario.update({
      where: { id },
      data: {
        passwordHash,
      },
    });

    res.json({
      ok: true,
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.put("/:id/roles", authMiddleware, requirePermission("usuarios.roles"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { roles = [] } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no encontrado",
      });
    }

    const rolesEncontrados = await prisma.rol.findMany({
      where: {
        id: { in: roles },
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.usuarioRol.deleteMany({
        where: { usuarioId: id },
      });

      if (rolesEncontrados.length > 0) {
        await tx.usuarioRol.createMany({
          data: rolesEncontrados.map((rol) => ({
            usuarioId: id,
            rolId: rol.id,
          })),
        });
      }
    });

    res.json({
      ok: true,
      message: "Roles actualizados correctamente",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.put("/:id/permisos", authMiddleware, requirePermission("usuarios.permisos"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { permisos = [] } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { id },
    });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        error: "Usuario no encontrado",
      });
    }

    const permisosEncontrados = await prisma.permiso.findMany({
      where: {
        id: { in: permisos },
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.usuarioPermiso.deleteMany({
        where: { usuarioId: id },
      });

      if (permisosEncontrados.length > 0) {
        await tx.usuarioPermiso.createMany({
          data: permisosEncontrados.map((permiso) => ({
            usuarioId: id,
            permisoId: permiso.id,
          })),
        });
      }
    });

    res.json({
      ok: true,
      message: "Permisos directos actualizados correctamente",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;