require("dotenv").config();

const express = require("express");
const cors = require("cors");

// ROUTES
const almacenesRoutes = require("./routes/almacenes.routes");
const usuariosRoutes = require("./routes/usuarios.routes");
const clientesRoutes = require("./routes/clientes.routes");
const productosRoutes = require("./routes/productos.routes");
const inventarioRoutes = require("./routes/inventario.routes");
const movimientosInventarioRoutes = require("./routes/movimientosInventario.routes");
const ventasRoutes = require("./routes/ventas.routes");
const pagosVentaRoutes = require("./routes/pagos-venta.routes");
const cajasRoutes = require("./routes/cajas.routes");
const movimientosCajaRoutes = require("./routes/movimientos-caja.routes");
const pedidosRoutes = require("./routes/pedidos.routes");
const produccionRoutes = require("./routes/produccion.routes");
const proveedoresRoutes = require("./routes/proveedores.routes");
const comprasRoutes = require("./routes/compras.routes");
const materialesRoutes = require("./routes/materiales.routes");
const insumosRoutes = require("./routes/insumos.routes");


// AUTH / SEGURIDAD
const authRoutes = require("./routes/auth.routes");
const rolesRoutes = require("./routes/roles.routes");
const permisosRoutes = require("./routes/permisos.routes");

// PRISMA
const prisma = require("./lib/prisma");

const app = express();

app.use(cors({
  origin: [
    "https://erptricks.tricks.pe",
    "https://www.tricks.pe",
  ],
  credentials: true
}));
app.use(express.json());

app.locals.prisma = prisma;

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "ERP TRICKS S.A.C funcionandoooo en nube 🚀",
  });
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    res.json({
      ok: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// AUTH
app.use("/auth", authRoutes);
app.use("/usuarios", usuariosRoutes);
app.use("/roles", rolesRoutes);
app.use("/permisos", permisosRoutes);

// MÓDULOS
app.use("/almacenes", almacenesRoutes);
app.use("/clientes", clientesRoutes);
app.use("/productos", productosRoutes);
app.use("/inventario", inventarioRoutes);
app.use("/movimientos-inventario", movimientosInventarioRoutes);
app.use("/ventas", ventasRoutes);
app.use("/ventas", pagosVentaRoutes);
app.use("/cajas", cajasRoutes);
app.use("/movimientos-caja", movimientosCajaRoutes);
app.use("/pedidos", pedidosRoutes);
app.use("/produccion", produccionRoutes);
app.use("/proveedores", proveedoresRoutes);
app.use("/compras", comprasRoutes);
app.use("/materiales", materialesRoutes);
app.use("/insumos", insumosRoutes);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});