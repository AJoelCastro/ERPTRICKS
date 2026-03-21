"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Resumen general del ERP",
  },
  "/almacenes": {
    title: "Almacenes",
    subtitle: "Gestión de almacenes",
  },
  "/clientes": {
    title: "Clientes",
    subtitle: "Gestión de clientes",
  },
  "/productos": {
    title: "Productos",
    subtitle: "Catálogo de productos",
  },
  "/inventario": {
    title: "Inventario",
    subtitle: "Control de stock",
  },
  "/ventas": {
    title: "Ventas",
    subtitle: "Registro de ventas",
  },
  "/pedidos": {
    title: "Pedidos",
    subtitle: "Gestión de pedidos",
  },
  "/produccion": {
    title: "Producción",
    subtitle: "Órdenes y etapas de producción",
  },
  "/caja": {
    title: "Caja",
    subtitle: "Movimientos de caja",
  },
  "/usuarios": {
    title: "Usuarios",
    subtitle: "Administración de usuarios",
  },
};

export default function Header() {
  const pathname = usePathname();

  const current = titles[pathname] || {
    title: "ERP Calzado V2",
    subtitle: "Sistema ERP",
  };

  const today = new Date().toLocaleDateString("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h2 className="text-2xl font-black text-slate-900">{current.title}</h2>
        <p className="text-sm text-slate-500">{current.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
          {today}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          AC
        </div>
      </div>
    </header>
  );
}