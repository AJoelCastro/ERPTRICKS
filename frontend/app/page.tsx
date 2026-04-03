"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
};

type Almacen = {
  id: string;
  codigo?: string;
  nombre?: string;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Cliente = {
  id: string;
  codigo?: string;
  nombres?: string | null;
  apellidos?: string | null;
  razonSocial?: string | null;
  nombreCompleto?: string | null;
  tipoCliente?: "PERSONA_NATURAL" | "PERSONA_JURIDICA";
  estado?: string;
  createdAt?: string;
};

type Producto = {
  id: string;
  codigo?: string;
  modelo?: string;
  color?: string;
  material?: string;
  taco?: string;
  talla?: number;
  estado?: string;
  createdAt?: string;
};

type InventarioItem = {
  id: string;
  stock?: number;
  producto?: Producto;
};

type Pedido = {
  id: string;
  codigo?: string;
  total?: string | number;
  estadoPedido?: string;
  estadoEntrega?: string;
  createdAt?: string;
};

type VentaDetalle = {
  id?: string;
  productoId?: string;
  modelo?: string;
  color?: string;
  talla?: number;
  cantidad?: number;
  subtotal?: string | number;
  precioUnitario?: string | number;
};

type Venta = {
  id: string;
  codigo?: string;
  total?: string | number;
  totalConIgv?: string | number;
  subtotalSinIgv?: string | number;
  descuento?: string | number;
  igv?: string | number;
  adelanto?: string | number;
  saldo?: string | number;
  metodoPago?: string;
  estado?: string;
  tipoComprobante?: string | null;
  createdAt?: string;
  cliente?: Cliente;
  detalles?: VentaDetalle[];
};

type Caja = {
  id: string;
  codigo?: string;
  nombre?: string;
  estado?: "ABIERTA" | "CERRADA";
  saldoActual?: string | number;
  saldoInicial?: string | number;
  createdAt?: string;
};

type MovimientoCaja = {
  id: string;
  cajaId?: string;
  tipo?: "INGRESO" | "EGRESO" | "TRANSFERENCIA" | "AJUSTE";
  subtipo?: string | null;
  monto?: string | number;
  metodoPago?: string | null;
  detalle?: string | null;
  persona?: string | null;
  createdAt?: string;
};

type Produccion = {
  id: string;
  codigo?: string;
  modelo?: string;
  etapaActual?: string;
  estadoGeneral?: string;
  createdAt?: string;
};

type Proveedor = {
  id: string;
};

type Compra = {
  id: string;
  total?: string | number;
  createdAt?: string;
};

async function readJsonSafe<T>(res: Response): Promise<T> {
  const text = await res.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text?.includes("<!DOCTYPE")
        ? "El backend respondió HTML en vez de JSON. Verifica que el backend esté reiniciado."
        : text || "La respuesta del servidor no es JSON válido"
    );
  }
}

function toNumber(v: unknown) {
  return Number(v || 0);
}

function formatMoney(v: unknown) {
  return `S/ ${toNumber(v).toFixed(2)}`;
}

function formatFecha(v?: string) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

function isToday(dateValue?: string) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(dateValue?: string) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hourKey(dateValue?: string) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  return `${`${d.getHours()}`.padStart(2, "0")}:00`;
}

function getClienteNombre(cliente?: Cliente) {
  if (!cliente) return "-";
  if (cliente.tipoCliente === "PERSONA_JURIDICA") {
    return cliente.razonSocial || cliente.nombreCompleto || "-";
  }
  const nombre = `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim();
  return nombre || cliente.nombreCompleto || "-";
}

function getPositiveNegativeClass(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-slate-700";
}

export default function HomePage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [backendStatus, setBackendStatus] = useState("Probando conexión...");
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientosCaja, setMovimientosCaja] = useState<MovimientoCaja[]>([]);
  const [produccion, setProduccion] = useState<Produccion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargarDatos() {
      if (!apiUrl) {
        setBackendStatus("NEXT_PUBLIC_API_URL no configurado");
        return;
      }

      try {
        setLoading(true);

        const healthRes = await fetch(`${apiUrl}/`);
        const healthData = await readJsonSafe<ApiResponse<unknown>>(healthRes);
        setBackendStatus(healthData.ok ? "Conectado" : "Error");
      } catch {
        setBackendStatus("Sin conexión");
      }

      try {
        const [
          almacenesRes,
          clientesRes,
          productosRes,
          inventarioRes,
          pedidosRes,
          ventasRes,
          cajasRes,
          movimientosCajaRes,
          produccionRes,
          proveedoresRes,
          comprasRes,
        ] = await Promise.all([
          fetch(`${apiUrl}/almacenes`),
          fetch(`${apiUrl}/clientes`),
          fetch(`${apiUrl}/productos`),
          fetch(`${apiUrl}/inventario`),
          fetch(`${apiUrl}/pedidos`),
          fetch(`${apiUrl}/ventas`),
          fetch(`${apiUrl}/cajas`),
          fetch(`${apiUrl}/movimientos-caja`),
          fetch(`${apiUrl}/produccion`),
          fetch(`${apiUrl}/proveedores`),
          fetch(`${apiUrl}/compras`),
        ]);

        const [
          almacenesData,
          clientesData,
          productosData,
          inventarioData,
          pedidosData,
          ventasData,
          cajasData,
          movimientosCajaData,
          produccionData,
          proveedoresData,
          comprasData,
        ] = await Promise.all([
          readJsonSafe<ApiResponse<Almacen[]>>(almacenesRes),
          readJsonSafe<ApiResponse<Cliente[]>>(clientesRes),
          readJsonSafe<ApiResponse<Producto[]>>(productosRes),
          readJsonSafe<ApiResponse<InventarioItem[]>>(inventarioRes),
          readJsonSafe<ApiResponse<Pedido[]>>(pedidosRes),
          readJsonSafe<ApiResponse<Venta[]>>(ventasRes),
          readJsonSafe<ApiResponse<Caja[]>>(cajasRes),
          readJsonSafe<ApiResponse<MovimientoCaja[]>>(movimientosCajaRes),
          readJsonSafe<ApiResponse<Produccion[]>>(produccionRes),
          readJsonSafe<ApiResponse<Proveedor[]>>(proveedoresRes),
          readJsonSafe<ApiResponse<Compra[]>>(comprasRes),
        ]);

        setAlmacenes(almacenesData.data || []);
        setClientes(clientesData.data || []);
        setProductos(productosData.data || []);
        setInventario(inventarioData.data || []);
        setPedidos(pedidosData.data || []);
        setVentas(ventasData.data || []);
        setCajas(cajasData.data || []);
        setMovimientosCaja(movimientosCajaData.data || []);
        setProduccion(produccionData.data || []);
        setProveedores(proveedoresData.data || []);
        setCompras(comprasData.data || []);
      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setLoading(false);
      }
    }

    void cargarDatos();
  }, [apiUrl]);

  const ventasHoy = useMemo(
    () => ventas.filter((v) => isToday(v.createdAt)),
    [ventas]
  );

  const movimientosHoy = useMemo(
    () => movimientosCaja.filter((m) => isToday(m.createdAt)),
    [movimientosCaja]
  );

  const ingresosHoy = useMemo(
    () =>
      movimientosHoy
        .filter((m) => m.tipo === "INGRESO")
        .reduce((acc, m) => acc + toNumber(m.monto), 0),
    [movimientosHoy]
  );

  const egresosHoy = useMemo(
    () =>
      movimientosHoy
        .filter((m) => m.tipo === "EGRESO")
        .reduce((acc, m) => acc + toNumber(m.monto), 0),
    [movimientosHoy]
  );

  const cajaNetaHoy = ingresosHoy - egresosHoy;

  const ventasTotalHoy = useMemo(
    () =>
      ventasHoy.reduce(
        (acc, v) => acc + toNumber(v.totalConIgv ?? v.total),
        0
      ),
    [ventasHoy]
  );

  const ticketsHoy = ventasHoy.length;

  const ticketPromedioHoy = ticketsHoy > 0 ? ventasTotalHoy / ticketsHoy : 0;

  const cajasAbiertas = useMemo(
    () => cajas.filter((c) => c.estado === "ABIERTA"),
    [cajas]
  );

  const lineasHoy = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hora: `${`${i}`.padStart(2, "0")}:00`,
      ventas: 0,
      ingresosCaja: 0,
    }));

    for (const venta of ventasHoy) {
      const h = hourKey(venta.createdAt);
      const row = hours.find((x) => x.hora === h);
      if (row) row.ventas += toNumber(venta.totalConIgv ?? venta.total);
    }

    for (const mov of movimientosHoy) {
      if (mov.tipo !== "INGRESO") continue;
      const h = hourKey(mov.createdAt);
      const row = hours.find((x) => x.hora === h);
      if (row) row.ingresosCaja += toNumber(mov.monto);
    }

    return hours;
  }, [ventasHoy, movimientosHoy]);

  const ultimos7Dias = useMemo(() => {
    const base: { dia: string; ventas: number; ingresosCaja: number; egresosCaja: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const label = d.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
      });

      base.push({
        dia: label,
        ventas: 0,
        ingresosCaja: 0,
        egresosCaja: 0,
      });
    }

    const keyToIndex = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      keyToIndex.set(dateKey(d.toISOString()), 6 - i);
    }

    for (const venta of ventas) {
      const key = dateKey(venta.createdAt);
      const idx = keyToIndex.get(key);
      if (idx !== undefined) {
        base[idx].ventas += toNumber(venta.totalConIgv ?? venta.total);
      }
    }

    for (const mov of movimientosCaja) {
      const key = dateKey(mov.createdAt);
      const idx = keyToIndex.get(key);
      if (idx !== undefined) {
        if (mov.tipo === "INGRESO") {
          base[idx].ingresosCaja += toNumber(mov.monto);
        }
        if (mov.tipo === "EGRESO") {
          base[idx].egresosCaja += toNumber(mov.monto);
        }
      }
    }

    return base;
  }, [ventas, movimientosCaja]);

  const metodosPagoHoy = useMemo(() => {
    const map = new Map<string, number>();

    for (const venta of ventasHoy) {
      const key = venta.metodoPago || "SIN_METODO";
      map.set(key, (map.get(key) || 0) + toNumber(venta.totalConIgv ?? venta.total));
    }

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [ventasHoy]);

  const topProductos = useMemo(() => {
    const map = new Map<
      string,
      { nombre: string; cantidad: number; total: number }
    >();

    for (const venta of ventas) {
      for (const det of venta.detalles || []) {
        const key =
          det.productoId ||
          `${det.modelo || "PRODUCTO"}-${det.color || ""}-${det.talla || ""}`;

        const nombre = `${det.modelo || "Producto"} ${det.color || ""} T${det.talla || ""}`.trim();
        const actual = map.get(key) || { nombre, cantidad: 0, total: 0 };

        actual.cantidad += toNumber(det.cantidad);
        actual.total += toNumber(det.subtotal);

        map.set(key, actual);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8)
      .map((x) => ({
        nombre: x.nombre,
        cantidad: x.cantidad,
        total: x.total,
      }));
  }, [ventas]);

  const stockCritico = useMemo(() => {
    return inventario
      .filter((i) => toNumber(i.stock) <= 2)
      .sort((a, b) => toNumber(a.stock) - toNumber(b.stock))
      .slice(0, 8);
  }, [inventario]);

  const pedidosPendientes = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          p.estadoEntrega === "PENDIENTE" || p.estadoEntrega === "EN_PRODUCCION"
      ).length,
    [pedidos]
  );

  const produccionActiva = useMemo(
    () =>
      produccion.filter(
        (p) =>
          p.estadoGeneral !== "FINALIZADO" &&
          p.estadoGeneral !== "CANCELADO"
      ).length,
    [produccion]
  );

  const comprasMes = useMemo(() => {
    const now = new Date();
    return compras
      .filter((c) => {
        if (!c.createdAt) return false;
        const d = new Date(c.createdAt);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((acc, c) => acc + toNumber(c.total), 0);
  }, [compras]);

  const cards = [
    { titulo: "Almacenes", valor: almacenes.length },
    { titulo: "Clientes", valor: clientes.length },
    { titulo: "Productos", valor: productos.length },
    { titulo: "Ventas hoy", valor: ticketsHoy },
    { titulo: "Pedidos pendientes", valor: pedidosPendientes },
    { titulo: "Producción activa", valor: produccionActiva },
    { titulo: "Cajas abiertas", valor: cajasAbiertas.length },
    { titulo: "Proveedores", valor: proveedores.length },
  ];

  const pieColors = ["#0f172a", "#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2"];

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-700 p-4 text-white shadow-lg sm:rounded-3xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">ERP TRICKS S.A.C</h1>
            <p className="mt-2 text-sm text-slate-200">
              Dashboard ejecutivo con métricas estratégicas del negocio
            </p>
          </div>

          <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur self-start lg:self-auto">
            Estado backend: {backendStatus}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Ventas del día</p>
          <p className="mt-2 text-2xl font-black text-slate-900 sm:text-4xl">
            {formatMoney(ventasTotalHoy)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{ticketsHoy} tickets hoy</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Ingresos caja hoy</p>
          <p className="mt-2 text-2xl font-black text-emerald-700 sm:text-4xl">
            {formatMoney(ingresosHoy)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Solo movimientos INGRESO</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Egresos caja hoy</p>
          <p className="mt-2 text-2xl font-black text-red-700 sm:text-4xl">
            {formatMoney(egresosHoy)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Solo movimientos EGRESO</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Caja neta del día</p>
          <p className={`mt-2 text-2xl font-black sm:text-4xl ${getPositiveNegativeClass(cajaNetaHoy)}`}>
            {formatMoney(cajaNetaHoy)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {cajaNetaHoy > 0
              ? "Caja positiva"
              : cajaNetaHoy < 0
              ? "Caja negativa"
              : "Caja equilibrada"}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Ticket promedio</p>
          <p className="mt-2 text-2xl font-black text-slate-900 sm:text-4xl">
            {formatMoney(ticketPromedioHoy)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Compras del mes</p>
          <p className="mt-2 text-2xl font-black text-slate-900 sm:text-4xl">
            {formatMoney(comprasMes)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Pedidos pendientes</p>
          <p className="mt-2 text-2xl font-black text-amber-600 sm:text-4xl">
            {pedidosPendientes}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-semibold text-slate-500">Producción activa</p>
          <p className="mt-2 text-2xl font-black text-blue-700 sm:text-4xl">
            {produccionActiva}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.titulo} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <p className="text-sm font-semibold text-slate-500">{card.titulo}</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{card.valor}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-900 sm:text-xl">
              Ventas vs ingresos en caja del día
            </h3>
            <p className="text-sm text-slate-500">
              Comparación por hora entre lo vendido y lo ingresado a caja
            </p>
          </div>

          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineasHoy}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ventas" strokeWidth={3} name="Ventas" />
                <Line type="monotone" dataKey="ingresosCaja" strokeWidth={3} name="Ingresos caja" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-900 sm:text-xl">
              Tendencia últimos 7 días
            </h3>
            <p className="text-sm text-slate-500">
              Evolución diaria de ventas, ingresos y egresos de caja
            </p>
          </div>

          <div className="h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ultimos7Dias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ventas" strokeWidth={3} name="Ventas" />
                <Line type="monotone" dataKey="ingresosCaja" strokeWidth={3} name="Ingresos caja" />
                <Line type="monotone" dataKey="egresosCaja" strokeWidth={3} name="Egresos caja" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6 xl:col-span-2">
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-900 sm:text-xl">
              Productos más vendidos
            </h3>
            <p className="text-sm text-slate-500">
              Ranking por cantidad vendida
            </p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductos}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="nombre"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={70}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cantidad" name="Cantidad vendida" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-900 sm:text-xl">
              Métodos de pago hoy
            </h3>
            <p className="text-sm text-slate-500">
              Distribución monetaria del día
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metodosPagoHoy}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={95}
                  innerRadius={45}
                  label
                >
                  {metodosPagoHoy.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2">
            {metodosPagoHoy.length === 0 ? (
              <p className="text-sm text-slate-500">No hay ventas hoy.</p>
            ) : (
              metodosPagoHoy.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: pieColors[idx % pieColors.length] }}
                    />
                    <span className="text-slate-700">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(item.value)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-black text-slate-900 sm:text-xl">
            Stock crítico
          </h3>
          <p className="mb-4 text-sm text-slate-500">
            Productos con 2 unidades o menos
          </p>

          <div className="space-y-3">
            {stockCritico.length === 0 ? (
              <p className="text-sm text-slate-500">No hay alertas críticas.</p>
            ) : (
              stockCritico.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-bold text-slate-900">
                    {item.producto?.modelo || "-"} · {item.producto?.color || "-"} · T{item.producto?.talla ?? "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {item.producto?.codigo || "-"}
                  </div>
                  <div
                    className={`mt-2 text-sm font-bold ${
                      toNumber(item.stock) <= 0 ? "text-red-700" : "text-amber-700"
                    }`}
                  >
                    Stock: {toNumber(item.stock)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-black text-slate-900 sm:text-xl">
            Últimas ventas
          </h3>
          <p className="mb-4 text-sm text-slate-500">Movimientos comerciales recientes</p>

          <div className="space-y-3">
            {ventas.length === 0 ? (
              <p className="text-sm text-slate-500">No hay ventas registradas.</p>
            ) : (
              ventas.slice(0, 5).map((venta) => (
                <div key={venta.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">
                        {venta.codigo || "-"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Cliente: {getClienteNombre(venta.cliente)}
                      </div>
                      <div className="text-sm text-slate-600">
                        {formatFecha(venta.createdAt)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-slate-900">
                        {formatMoney(venta.totalConIgv ?? venta.total)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {venta.metodoPago || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-black text-slate-900 sm:text-xl">
            Producción reciente
          </h3>
          <p className="mb-4 text-sm text-slate-500">Seguimiento operativo</p>

          <div className="space-y-3">
            {produccion.length === 0 ? (
              <p className="text-sm text-slate-500">No hay órdenes de producción.</p>
            ) : (
              produccion.slice(0, 5).map((op) => (
                <div key={op.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="font-bold text-slate-900">
                    {op.codigo || "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Modelo: {op.modelo || "-"}
                  </div>
                  <div className="text-sm text-slate-600">
                    Etapa: {op.etapaActual || "-"}
                  </div>
                  <div className="text-sm text-slate-600">
                    Estado: {op.estadoGeneral || "-"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}