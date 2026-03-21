"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { label: "Dashboard", href: "/" },
  { label: "Almacenes", href: "/almacenes" },
  { label: "Clientes", href: "/clientes" },
  { label: "Productos", href: "/productos" },
  { label: "Inventario", href: "/inventario" },
  { label: "Ventas", href: "/ventas" },
  { label: "Pedidos", href: "/pedidos" },
  { label: "Producción", href: "/produccion" },
  { label: "Caja", href: "/caja" },
  { label: "Usuarios", href: "/usuarios" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-slate-950 text-white lg:flex">
      <div className="border-b border-slate-800 px-6 py-6">
        <h1 className="text-2xl font-black tracking-tight">ERP CALZADO</h1>
        <p className="mt-1 text-sm text-slate-400">Versión 2</p>
      </div>

      <nav className="flex-1 px-4 py-4">
        <div className="space-y-2">
          {menuItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-800 px-6 py-4 text-xs text-slate-400">
        Backend + Prisma + Next.js
      </div>
    </aside>
  );
}