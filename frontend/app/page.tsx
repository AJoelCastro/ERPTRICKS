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
};

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
      try {
        const r = await fetch(`${apiUrl}/`);
        const data = await r.json();

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

        const almacenesData = await almacenesRes.json();
        const clientesData = await clientesRes.json();
        const productosData = await productosRes.json();
        const pedidosData = await pedidosRes.json();
        const ventasData = await ventasRes.json();
        const cajasData = await cajasRes.json();
        const produccionData = await produccionRes.json();
        const proveedoresData = await proveedoresRes.json();
        const comprasData = await comprasRes.json();

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

    cargarDatos();
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

      <section className="grid gap-6 xl:grid-cols-2">
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
                  <div className="font-bold text-slate-900">{pedido.codigo}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Estado pedido: {pedido.estadoPedido}
                  </div>
                  <div className="text-sm text-slate-600">
                    Estado entrega: {pedido.estadoEntrega}
                  </div>
                  <div className="text-sm text-slate-600">
                    Total: S/ {pedido.total}
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
                  <div className="font-bold text-slate-900">{op.codigo}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Modelo: {op.modelo}
                  </div>
                  <div className="text-sm text-slate-600">
                    Etapa actual: {op.etapaActual}
                  </div>
                  <div className="text-sm text-slate-600">
                    Estado: {op.estadoGeneral}
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