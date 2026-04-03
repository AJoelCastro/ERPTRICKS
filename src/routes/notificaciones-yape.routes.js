const express = require("express");

const router = express.Router();

function sanitizeBigInt(data) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

// GET /notificaciones-yape
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { q, estado } = req.query;

    const where = {};

    if (estado) {
      where.estado = String(estado).trim().toUpperCase();
    }

    if (q) {
      const texto = String(q).trim();
      where.OR = [
        { appOrigen: { contains: texto, mode: "insensitive" } },
        { titulo: { contains: texto, mode: "insensitive" } },
        { mensaje: { contains: texto, mode: "insensitive" } },
        { fechaHoraTexto: { contains: texto, mode: "insensitive" } },
        { numerosDestino: { contains: texto, mode: "insensitive" } },
        { detalleSms: { contains: texto, mode: "insensitive" } },
      ];
    }

    const data = await prisma.notificacionYape.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    res.json({
      ok: true,
      data: sanitizeBigInt(data),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// GET /notificaciones-yape/:id
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const data = await prisma.notificacionYape.findUnique({
      where: { id },
    });

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "Pago Yape no encontrado",
      });
    }

    res.json({
      ok: true,
      data: sanitizeBigInt(data),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// POST /notificaciones-yape
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      appOrigen,
      titulo,
      mensaje,
      fechaHoraTexto,
      timestampMs,
      numerosDestino,
      estadoSms,
      detalleSms,
      payloadJson,
    } = req.body;

    const creado = await prisma.notificacionYape.create({
      data: {
        appOrigen: appOrigen || null,
        titulo: titulo || null,
        mensaje: mensaje || null,
        fechaHoraTexto: fechaHoraTexto || null,
        timestampMs:
          timestampMs !== undefined && timestampMs !== null
            ? BigInt(timestampMs)
            : null,
        numerosDestino: Array.isArray(numerosDestino)
          ? numerosDestino.join(",")
          : numerosDestino || null,
        estadoSms: estadoSms || null,
        detalleSms: detalleSms || null,
        payloadJson: payloadJson ? JSON.stringify(payloadJson) : null,
        estado: "POR_VALIDAR",
      },
    });

    res.status(201).json({
      ok: true,
      data: sanitizeBigInt(creado),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// PATCH /notificaciones-yape/:id/estado
router.patch("/:id/estado", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;
    const { estado, observacion } = req.body;

    const estadoNormalizado = String(estado || "")
      .trim()
      .toUpperCase();

    if (!["POR_VALIDAR", "CONFIRMADO"].includes(estadoNormalizado)) {
      return res.status(400).json({
        ok: false,
        error: "Estado inválido",
      });
    }

    const existe = await prisma.notificacionYape.findUnique({
      where: { id },
    });

    if (!existe) {
      return res.status(404).json({
        ok: false,
        error: "Pago Yape no encontrado",
      });
    }

    const actualizado = await prisma.notificacionYape.update({
      where: { id },
      data: {
        estado: estadoNormalizado,
        observacion: observacion || null,
      },
    });

    res.json({
      ok: true,
      data: sanitizeBigInt(actualizado),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;