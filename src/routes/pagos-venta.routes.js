const express = require("express");

const router = express.Router();

/**
 * GET /ventas/:id/pagos
 * Lista pagos de una venta
 */
router.get("/:id/pagos", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const ventaId = req.params.id;

    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
    });

    if (!venta) {
      return res.status(404).json({
        ok: false,
        error: "Venta no encontrada",
      });
    }

    const pagos = await prisma.pagoVenta.findMany({
      where: { ventaId },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      ok: true,
      data: pagos,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/**
 * POST /ventas/:id/pagos
 * Registra pago de venta + actualiza venta + registra movimiento en caja
 */
router.post("/:id/pagos", async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    const ventaId = req.params.id;

    const { monto, metodoPago, nota, usuarioEmail } = req.body;

    const montoNum = Number(monto);

    if (!montoNum || montoNum <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0",
      });
    }

    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        cliente: true,
        almacen: true,
      },
    });

    if (!venta) {
      return res.status(404).json({
        ok: false,
        error: "Venta no encontrada",
      });
    }

    const totalConIgv = Number(venta.totalConIgv);
    const adelantoActual = Number(venta.adelanto);

    let nuevoAdelanto = adelantoActual + montoNum;
    if (nuevoAdelanto > totalConIgv) {
      nuevoAdelanto = totalConIgv;
    }

    const nuevoSaldo = Number((totalConIgv - nuevoAdelanto).toFixed(2));
    const nuevoEstado = nuevoSaldo <= 0 ? "PAGADO" : "PENDIENTE";

    const resultado = await prisma.$transaction(async (tx) => {
      const pago = await tx.pagoVenta.create({
        data: {
          ventaId: venta.id,
          monto: montoNum,
          metodoPago: metodoPago || venta.metodoPago || null,
          nota: nota || null,
          usuarioEmail: usuarioEmail || "admin@erp.com",
        },
      });

      const ventaActualizada = await tx.venta.update({
        where: { id: venta.id },
        data: {
          adelanto: nuevoAdelanto,
          saldo: nuevoSaldo,
          estado: nuevoEstado,
        },
      });

      // Buscar caja ABIERTA del mismo almacén
      const cajaAbierta = await tx.caja.findFirst({
        where: {
          almacenId: venta.almacenId,
          estado: "ABIERTA",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      let movimientoCaja = null;

      if (cajaAbierta) {
        const saldoActualCaja = Number(cajaAbierta.saldoActual);
        const nuevoSaldoCaja = Number((saldoActualCaja + montoNum).toFixed(2));

        movimientoCaja = await tx.movimientoCaja.create({
          data: {
            cajaId: cajaAbierta.id,
            tipo: "INGRESO",
            subtipo: "PAGO_VENTA",
            monto: montoNum,
            moneda: "PEN",
            metodoPago: metodoPago || venta.metodoPago || null,
            referencia: venta.codigo,
            proveedor: null,
            persona: `${venta.cliente.nombres} ${venta.cliente.apellidos}`,
            usuarioEmail: usuarioEmail || "admin@erp.com",
            facturaSiNo: null,
            numFactura: null,
            vinculo: venta.id,
            detalle: `Pago registrado para venta ${venta.codigo}`,
            saldoPost: nuevoSaldoCaja,
            notas: nota || null,
          },
        });

        await tx.caja.update({
          where: { id: cajaAbierta.id },
          data: {
            saldoActual: nuevoSaldoCaja,
          },
        });
      }

      return {
        pago,
        ventaActualizada,
        movimientoCaja,
      };
    });

    res.status(201).json({
      ok: true,
      message: "Pago registrado correctamente",
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