const express = require("express");

const router = express.Router();

/**
 * GET /movimientos-caja
 * Lista movimientos de caja
 * Filtros opcionales:
 * - cajaId
 */
router.get("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const { cajaId } = req.query;

    const where = {};

    if (cajaId) {
      where.cajaId = cajaId;
    }

    const movimientos = await prisma.movimientoCaja.findMany({
      where,
      include: {
        caja: {
          include: {
            almacen: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      ok: true,
      data: movimientos,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /movimientos-caja
 * Crear movimiento manual de caja
 */
router.post("/", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;

    const {
      cajaId,
      tipo,
      subtipo,
      monto,
      moneda,
      metodoPago,
      referencia,
      proveedor,
      persona,
      usuarioEmail,
      facturaSiNo,
      numFactura,
      vinculo,
      detalle,
      notas,
    } = req.body;

    if (!cajaId || !tipo || monto === undefined) {
      return res.status(400).json({
        ok: false,
        error: "cajaId, tipo y monto son obligatorios",
      });
    }

    const montoNum = Number(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0",
      });
    }

    const tipoUpper = String(tipo).toUpperCase().trim();
    const tiposValidos = ["INGRESO", "EGRESO", "AJUSTE", "TRANSFERENCIA"];

    if (!tiposValidos.includes(tipoUpper)) {
      return res.status(400).json({
        ok: false,
        error: "Tipo inválido. Usa INGRESO, EGRESO, AJUSTE o TRANSFERENCIA",
      });
    }

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
        error: "Solo se pueden registrar movimientos en una caja ABIERTA",
      });
    }

    const saldoActual = Number(caja.saldoActual);
    let nuevoSaldo = saldoActual;

    if (tipoUpper === "INGRESO") {
      nuevoSaldo = saldoActual + montoNum;
    } else if (tipoUpper === "EGRESO") {
      nuevoSaldo = saldoActual - montoNum;

      if (nuevoSaldo < 0) {
        return res.status(400).json({
          ok: false,
          error: "La caja no tiene saldo suficiente para este egreso",
        });
      }
    } else if (tipoUpper === "AJUSTE") {
      nuevoSaldo = saldoActual + montoNum;
    } else if (tipoUpper === "TRANSFERENCIA") {
      nuevoSaldo = saldoActual - montoNum;

      if (nuevoSaldo < 0) {
        return res.status(400).json({
          ok: false,
          error: "La caja no tiene saldo suficiente para esta transferencia",
        });
      }
    }

    nuevoSaldo = Number(nuevoSaldo.toFixed(2));

    const resultado = await prisma.$transaction(async (tx) => {
      const movimiento = await tx.movimientoCaja.create({
        data: {
          cajaId,
          tipo: tipoUpper,
          subtipo: subtipo || null,
          monto: montoNum,
          moneda: moneda || "PEN",
          metodoPago: metodoPago || null,
          referencia: referencia || null,
          proveedor: proveedor || null,
          persona: persona || null,
          usuarioEmail: usuarioEmail || "admin@erp.com",
          facturaSiNo: facturaSiNo || null,
          numFactura: numFactura || null,
          vinculo: vinculo || null,
          detalle: detalle || null,
          saldoPost: nuevoSaldo,
          notas: notas || null,
        },
        include: {
          caja: {
            include: {
              almacen: true,
            },
          },
        },
      });

      const cajaActualizada = await tx.caja.update({
        where: { id: cajaId },
        data: {
          saldoActual: nuevoSaldo,
        },
        include: {
          almacen: true,
        },
      });

      return {
        movimiento,
        cajaActualizada,
      };
    });

    res.status(201).json({
      ok: true,
      data: resultado,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

module.exports = router;