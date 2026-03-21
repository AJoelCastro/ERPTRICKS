const express = require("express");
const router = express.Router();

const authLib = require("../lib/auth");
const authMiddleware = require("../middlewares/auth.middleware");
const { getPermisosUsuario } = require("../middlewares/permission.middleware");

router.post("/login", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        ok: false,
        error: "login y password son obligatorios",
      });
    }

    const loginValue = String(login).trim().toLowerCase();

    const usuario = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email: loginValue },
          { username: loginValue },
        ],
      },
      include: {
        usuarioRoles: {
          include: {
            rol: {
              include: {
                rolPermisos: {
                  include: {
                    permiso: true,
                  },
                },
              },
            },
          },
        },
        usuarioPermisos: {
          include: {
            permiso: true,
          },
        },
      },
    });

    if (!usuario) {
      return res.status(401).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        ok: false,
        error: "Usuario inactivo",
      });
    }

    if (!usuario.passwordHash) {
      return res.status(401).json({
        ok: false,
        error: "El usuario no tiene contraseña configurada",
      });
    }

    const okPassword = await authLib.comparePassword(password, usuario.passwordHash);

    if (!okPassword) {
      return res.status(401).json({
        ok: false,
        error: "Credenciales inválidas",
      });
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ultimoLogin: new Date(),
      },
    });

    const roles = (usuario.usuarioRoles || [])
      .map((ur) => ur.rol?.codigo)
      .filter(Boolean);

    const permisos = getPermisosUsuario(usuario);

    const token = authLib.signToken({
      id: usuario.id,
      email: usuario.email,
      username: usuario.username,
    });

    res.json({
      ok: true,
      token,
      data: {
        id: usuario.id,
        email: usuario.email,
        username: usuario.username,
        nombre: usuario.nombre,
        activo: usuario.activo,
        roles,
        permisos,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      include: {
        usuarioRoles: {
          include: {
            rol: {
              include: {
                rolPermisos: {
                  include: {
                    permiso: true,
                  },
                },
              },
            },
          },
        },
        usuarioPermisos: {
          include: {
            permiso: true,
          },
        },
      },
    });

    const roles = (usuario.usuarioRoles || [])
      .map((ur) => ur.rol?.codigo)
      .filter(Boolean);

    const permisos = getPermisosUsuario(usuario);

    res.json({
      ok: true,
      data: {
        id: usuario.id,
        email: usuario.email,
        username: usuario.username,
        nombre: usuario.nombre,
        activo: usuario.activo,
        roles,
        permisos,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;