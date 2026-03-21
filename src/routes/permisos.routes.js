const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/permission.middleware");

router.get("/", authMiddleware, requirePermission("usuarios.permisos", "usuarios.roles"), async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const permisos = await prisma.permiso.findMany({
      orderBy: [
        { modulo: "asc" },
        { codigo: "asc" },
      ],
    });

    res.json({
      ok: true,
      data: permisos,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;