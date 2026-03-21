const authLib = require("../lib/auth");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        error: "Token no enviado",
      });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const decoded = authLib.verifyToken(token);

    const prisma = req.app.locals.prisma;

    const usuario = await prisma.usuario.findUnique({
      where: { id: decoded.id },
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
        error: "Usuario no encontrado",
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        ok: false,
        error: "Usuario inactivo",
      });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "Token inv�lido o expirado",
    });
  }
}

module.exports = authMiddleware;
