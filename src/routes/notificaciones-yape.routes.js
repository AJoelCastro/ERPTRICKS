const express = require("express");

const router = express.Router();

function sanitizeBigInt(data) {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

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
        payloadJson: payloadJson
          ? JSON.stringify(payloadJson)
          : null,
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

// GET /notificaciones-yape
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const data = await prisma.notificacionYape.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
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

module.exports = router;