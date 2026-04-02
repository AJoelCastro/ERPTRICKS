"use client";

import { useEffect, useState } from "react";

type SimpleItem = {
  id: string;
  codigo?: string;
  nombre?: string;
  total?: string | number;
  estadoPedido?: string;
  estadoEntrega?: string;
  estadoGeneral?: string;
  etapaActual?: string;
  modelo?: string;
  activo?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  error?: string;
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

function formatFecha(v?: string) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("es-PE");
  } catch {
    return v;
  }
}

function badgeActivo(activo?: boolean) {
  if (activo) {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
        ACTIVO
      </span>
    );
  }

  return (
    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
      INACTIVO
    </span>
  );
}

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState("Probando conexión...");
  const [almacenes, setAlmacenes] = useState<SimpleItem[]>([]);
  const [clientes, setClientes] = useState<SimpleItem[]>([]);
  const [productos, setProductos] = useState<SimpleItem[]>([]);
  const [pedidos, setPedidos] = useState<SimpleItem[]>([]);
  const [ventas, setVentas] = useState<SimpleItem[]>([]);
  const [cajas, setCajas] = useState<SimpleItem[]>([]);
  const [produccion, setProduccion] = useState<SimpleItem[]>([]);
  const [proveedores, setProveedores] = useState<SimpleItem[]>([]);
  const [compras, setCompras] = useState<SimpleItem[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    async function cargarDatos() {
      if (!apiUrl) {
        setBackendStatus("NEXT_PUBLIC_API_URL no configurado");
        return;
      }

      try {
        const r = await fetch(`${apiUrl}/`);
        const data = await readJsonSafe<ApiResponse<unknown>>(r);

        if (data.ok) {
          setBackendStatus("Conectado");
        } else {
          setBackendStatus("Error");
        }
      } catch {
        setBackendStatus("Sin conexión");
      }

      try {
        const [
          almacenesRes,
          clientesRes,
          productosRes,
          pedidosRes,
          ventasRes,
          cajasRes,
          produccionRes,
          proveedoresRes,
          comprasRes,
        ] = await Promise.all([
          fetch(`${apiUrl}/almacenes`),
          fetch(`${apiUrl}/clientes`),
          fetch(`${apiUrl}/productos`),
          fetch(`${apiUrl}/pedidos`),
          fetch(`${apiUrl}/ventas`),
          fetch(`${apiUrl}/cajas`),
          fetch(`${apiUrl}/produccion`),
          fetch(`${apiUrl}/proveedores`),
          fetch(`${apiUrl}/compras`),
        ]);

        const almacenesData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(almacenesRes);
        const clientesData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(clientesRes);
        const productosData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(productosRes);
        const pedidosData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(pedidosRes);
        const ventasData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(ventasRes);
        const cajasData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(cajasRes);
        const produccionData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(produccionRes);
        const proveedoresData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(proveedoresRes);
        const comprasData =
          await readJsonSafe<ApiResponse<SimpleItem[]>>(comprasRes);

        setAlmacenes(almacenesData.data || []);
        setClientes(clientesData.data || []);
        setProductos(productosData.data || []);
        setPedidos(pedidosData.data || []);
        setVentas(ventasData.data || []);
        setCajas(cajasData.data || []);
        setProduccion(produccionData.data || []);
        setProveedores(proveedoresData.data || []);
        setCompras(comprasData.data || []);
      } catch (error) {
        console.error("Error cargando datos:", error);
      }
    }

    void cargarDatos();
  }, [apiUrl]);

  const cards = [
    { titulo: "Almacenes", valor: almacenes.length },
    { titulo: "Clientes", valor: clientes.length },
    { titulo: "Productos", valor: productos.length },
    { titulo: "Pedidos", valor: pedidos.length },
    { titulo: "Ventas", valor: ventas.length },
    { titulo: "Cajas", valor: cajas.length },
    { titulo: "Producción", valor: produccion.length },
    { titulo: "Proveedores", valor: proveedores.length },
    { titulo: "Compras", valor: compras.length },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-slate-900 to-blue-700 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">ERP TRICKS S.A.C</h1>
            <p className="mt-2 text-sm text-slate-200">
              Panel general del sistema
            </p>
          </div>

          <div className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
            Estado backend: {backendStatus}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.titulo} className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">{card.titulo}</p>
            <p className="mt-2 text-4xl font-black text-slate-900">
              {card.valor}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">
            Últimos almacenes
          </h3>

          <div className="mt-4 space-y-3">
            {almacenes.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay almacenes registrados.
              </p>
            ) : (
              almacenes.slice(0, 5).map((almacen) => (
                <div
                  key={almacen.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">
                        {almacen.codigo || "-"}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        Nombre: {almacen.nombre || "-"}
                      </div>
                      <div className="text-sm text-slate-600">
                        Creado: {formatFecha(almacen.createdAt)}
                      </div>
                    </div>

                    <div>{badgeActivo(almacen.activo)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">Últimos pedidos</h3>

          <div className="mt-4 space-y-3">
            {pedidos.length === 0 ? (
              <p className="text-sm text-slate-500">No hay pedidos aún.</p>
            ) : (
              pedidos.slice(0, 5).map((pedido) => (
                <div
                  key={pedido.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="font-bold text-slate-900">
                    {pedido.codigo || "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Estado pedido: {pedido.estadoPedido || "-"}
                  </div>
                  <div className="text-sm text-slate-600">
                    Estado entrega: {pedido.estadoEntrega || "-"}
                  </div>
                  <div className="text-sm text-slate-600">
                    Total: S/ {pedido.total ?? 0}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">
            Últimas órdenes de producción
          </h3>

          <div className="mt-4 space-y-3">
            {produccion.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay órdenes de producción aún.
              </p>
            ) : (
              produccion.slice(0, 5).map((op) => (
                <div
                  key={op.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="font-bold text-slate-900">
                    {op.codigo || "-"}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Modelo: {op.modelo || "-"}
                  </div>
                  <div className="text-sm text-slate-600">
                    Etapa actual: {op.etapaActual || "-"}
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