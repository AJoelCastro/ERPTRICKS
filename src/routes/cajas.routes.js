const express = require("express");

const router = express.Router();

/**
 * GET /cajas
 * Lista todas las cajas con su almacén
 */
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const cajas = await prisma.caja.findMany({
      include: {
        almacen: true,
        movimientos: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      ok: true,
      data: cajas,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * GET /cajas/:id
 * Ver detalle de caja
 */
router.get("/:id", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { id } = req.params;

    const caja = await prisma.caja.findUnique({
      where: { id },
      include: {
        almacen: true,
        movimientos: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!caja) {
      return res.status(404).json({
        ok: false,
        error: "Caja no encontrada",
      });
    }

    res.json({
      ok: true,
      data: caja,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /cajas
 * Crear una nueva caja
 */
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      codigo,
      nombre,
      almacenId,
      saldoInicial,
      responsable,
      notas,
    } = req.body;

    if (!codigo || !nombre || !almacenId) {
      return res.status(400).json({
        ok: false,
        error: "codigo, nombre y almacenId son obligatorios",
      });
    }

    const almacen = await prisma.almacen.findUnique({
      where: { id: almacenId },
    });

    if (!almacen) {
      return res.status(404).json({
        ok: false,
        error: "Almacén no encontrado",
      });
    }

    const caja = await prisma.caja.create({
      data: {
        codigo: String(codigo).trim().toUpperCase(),
        nombre: String(nombre).trim(),
        almacenId,
        saldoInicial: Number(saldoInicial || 0),
        saldoActual: Number(saldoInicial || 0),
        responsable: responsable || null,
        notas: notas || null,
        estado: "CERRADA",
        saldoContado: null,
        diferenciaCierre: null,
        observacionCierre: null,
      },
      include: {
        almacen: true,
      },
    });

    res.status(201).json({
      ok: true,
      data: caja,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /cajas/:id/abrir
 * Abrir una caja
 */
router.post("/:id/abrir", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const cajaId = req.params.id;

    const { saldoInicial, responsable, notas } = req.body;

    const caja = await prisma.caja.findUnique({
      where: { id: cajaId },
    });

    if (!caja) {
      return res.status(404).json({
        ok: false,
        error: "Caja no encontrada",
      });
    }

    if (caja.estado === "ABIERTA") {
      return res.status(400).json({
        ok: false,
        error: "La caja ya está abierta",
      });
    }

    const saldoInicialNum =
      saldoInicial !== undefined ? Number(saldoInicial) : Number(caja.saldoInicial);

    const nuevaCaja = await prisma.caja.update({
      where: { id: cajaId },
      data: {
        estado: "ABIERTA",
        saldoInicial: saldoInicialNum,
        saldoActual: saldoInicialNum,
        fechaApertura: new Date(),
        fechaCierre: null,
        responsable: responsable || caja.responsable || null,
        notas: notas || caja.notas || null,
        saldoContado: null,
        diferenciaCierre: null,
        observacionCierre: null,
      },
      include: {
        almacen: true,
      },
    });

    res.json({
      ok: true,
      data: nuevaCaja,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /cajas/:id/cerrar
 * Cerrar una caja con arqueo
 */
router.post("/:id/cerrar", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const cajaId = req.params.id;

    const { saldoContado, notas, observacionCierre } = req.body;

    const caja = await prisma.caja.findUnique({
      where: { id: cajaId },
      include: {
        almacen: true,
      },
    });

    if (!caja) {
      return res.status(404).json({
        ok: false,
        error: "Caja no encontrada",
      });
    }

    if (caja.estado !== "ABIERTA") {
      return res.status(400).json({
        ok: false,
        error: "Solo se puede cerrar una caja ABIERTA",
      });
    }

    const saldoSistema = Number(caja.saldoActual || 0);
    const saldoContadoNum =
      saldoContado !== undefined ? Number(saldoContado) : saldoSistema;

    if (isNaN(saldoContadoNum) || saldoContadoNum < 0) {
      return res.status(400).json({
        ok: false,
        error: "saldoContado inválido",
      });
    }

    const diferencia = Number((saldoContadoNum - saldoSistema).toFixed(2));

    const cajaActualizada = await prisma.caja.update({
      where: { id: cajaId },
      data: {
        estado: "CERRADA",
        fechaCierre: new Date(),
        notas: notas || caja.notas || null,
        saldoContado: saldoContadoNum,
        diferenciaCierre: diferencia,
        observacionCierre: observacionCierre || null,
      },
      include: {
        almacen: true,
      },
    });

    res.json({
      ok: true,
      data: cajaActualizada,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;