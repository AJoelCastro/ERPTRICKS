function getPermisosUsuario(usuario) {
  const permisosRol = (usuario.usuarioRoles || [])
    .flatMap((ur) => (ur.rol?.rolPermisos || []))
    .map((rp) => rp.permiso?.codigo)
    .filter(Boolean);

  const permisosDirectos = (usuario.usuarioPermisos || [])
    .map((up) => up.permiso?.codigo)
    .filter(Boolean);

  return Array.from(new Set([...permisosRol, ...permisosDirectos]));
}

function requirePermission(...requiredPermissions) {
  return async (req, res, next) => {
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

      if (!usuario) {
        return res.status(401).json({
          ok: false,
          error: "Usuario no encontrado",
        });
      }

      const permisos = getPermisosUsuario(usuario);
      const autorizado = requiredPermissions.some((p) => permisos.includes(p));

      if (!autorizado) {
        return res.status(403).json({
          ok: false,
          error: "No tienes permisos para esta acci�n",
          requiredPermissions,
        });
      }

      req.permisos = permisos;
      next();
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }
  };
}

module.exports = {
  requirePermission,
  getPermisosUsuario,
};
