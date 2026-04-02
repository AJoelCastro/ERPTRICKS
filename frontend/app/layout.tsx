"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Boxes,
  Users,
  ShoppingBag,
  ClipboardList,
  Factory,
  Package,
  Wallet,
  Store,
  Truck,
  Menu,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  LogOut,
  UserCog,
} from "lucide-react";
import "./globals.css";
import { AuthProvider, useAuth } from "./components/auth/AuthProvider";
import ProtectedRoute from "./components/auth/ProtectedRoute";

type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: string[];
};

const COMPANY_NAME = "ERP TRICKS S.A.C";
const COMPANY_SUBTITLE = "Sistema de gestión";
const COMPANY_HEADER_SUBTITLE = "Gestión comercial, producción e inventario";
const COMPANY_LOGO = "/logo-empresa.svg";

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, permissions: ["dashboard.ver"] },
  { label: "Almacenes", href: "/almacenes", icon: Boxes, permissions: ["almacenes.ver"] },
  { label: "Productos", href: "/productos", icon: ShoppingBag, permissions: ["productos.ver"] },
  { label: "Inventario", href: "/inventario", icon: Package, permissions: ["inventario.ver"] },
  { label: "Clientes", href: "/clientes", icon: Users, permissions: ["clientes.ver"] },
  { label: "Pedidos", href: "/pedidos", icon: ClipboardList, permissions: ["pedidos.ver"] },
  { label: "Ventas POS", href: "/ventas", icon: Store, permissions: ["ventas.ver"] },
  { label: "Producción", href: "/produccion", icon: Factory, permissions: ["produccion.ver"] },
  { label: "Caja / Tesorería", href: "/caja", icon: Wallet, permissions: ["caja.ver"] },
  { label: "Proveedores", href: "/proveedores", icon: Truck, permissions: ["proveedores.ver"] },
  { label: "Compras", href: "/compras", icon: Boxes, permissions: ["compras.ver"] },
  { label: "Usuarios", href: "/usuarios", icon: UserCog, permissions: ["usuarios.ver"] },
  { label: "Roles", href: "/roles", icon: ShieldCheck, permissions: ["usuarios.roles"] },
  { label: "Permisos", href: "/permisos", icon: KeyRound, permissions: ["usuarios.permisos", "usuarios.roles"] },
  
];

function CompanyLogo({
  collapsed = false,
  className = "",
}: {
  collapsed?: boolean;
  className?: string;
}) {
  if (collapsed) {
    return (
      <div
        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white ${className}`}
      >
        <Image
          src={COMPANY_LOGO}
          alt="Logo empresa"
          width={36}
          height={36}
          className="h-8 w-8 object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
        <Image
          src={COMPANY_LOGO}
          alt="Logo empresa"
          width={40}
          height={40}
          className="h-full w-full object-contain"
          priority
        />
      </div>

      <div className="min-w-0">
        <div className="truncate text-lg font-black tracking-tight">{COMPANY_NAME}</div>
        <div className="text-xs text-slate-400">{COMPANY_SUBTITLE}</div>
      </div>
    </div>
  );
}

function HeaderCompanyLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
        <Image
          src={COMPANY_LOGO}
          alt="Logo empresa"
          width={36}
          height={36}
          className="h-full w-full object-contain"
          priority
        />
      </div>

      <div>
        <div className="text-lg font-black text-slate-900">{COMPANY_NAME}</div>
        <div className="text-xs text-slate-500">{COMPANY_HEADER_SUBTITLE}</div>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, can, logout, authenticated } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("erp-sidebar-collapsed") === "true";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("erp-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const isLoginPage = pathname === "/login";

  const visibleMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.permissions || item.permissions.length === 0) return true;
      return can(...item.permissions);
    });
  }, [can]);

  const sidebarWidth = useMemo(() => {
    return sidebarCollapsed ? "w-[90px]" : "w-[280px]";
  }, [sidebarCollapsed]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        {mobileOpen && (
          <button
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={[
            "fixed left-0 top-0 z-50 h-screen border-r border-slate-200 bg-slate-950 text-white transition-all duration-300",
            sidebarWidth,
            mobileOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0",
          ].join(" ")}
        >
          <div className="flex h-full flex-col">
            <div
              className={`flex items-center border-b border-white/10 px-4 py-4 ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              }`}
            >
              {!sidebarCollapsed ? (
                <>
                  <CompanyLogo />
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(true)}
                    className="hidden rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 lg:inline-flex"
                    title="Comprimir menú"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <CompanyLogo collapsed />
              )}
            </div>

            {sidebarCollapsed && (
              <div className="hidden border-b border-white/10 px-4 py-3 lg:block">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(false)}
                  className="flex w-full items-center justify-center rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10"
                  title="Expandir menú"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-2">
                {visibleMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname?.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "group flex items-center rounded-2xl px-3 py-3 text-sm font-semibold transition",
                        active
                          ? "bg-blue-600 text-white shadow-lg"
                          : "text-slate-300 hover:bg-white/10 hover:text-white",
                        sidebarCollapsed ? "justify-center" : "gap-3",
                      ].join(" ")}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="border-t border-white/10 p-4">
              {!sidebarCollapsed ? (
                <div className="space-y-3 rounded-2xl bg-white/5 p-3">
                  <div>
                    <div className="text-sm font-bold">{user?.nombre || "Usuario"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {user?.username} · {user?.roles?.join(", ") || "SIN ROL"}
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white p-2">
                    <Image
                      src={COMPANY_LOGO}
                      alt="Logo empresa"
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                    />
                  </div>
                  <button
                    onClick={logout}
                    title="Cerrar sesión"
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-slate-200 transition hover:bg-white/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div
          className={`flex min-h-screen flex-1 flex-col transition-all duration-300 ${
            sidebarCollapsed ? "lg:pl-[90px]" : "lg:pl-[280px]"
          }`}
        >
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex rounded-xl border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <HeaderCompanyLogo />
              </div>

              <div className="hidden items-center gap-3 sm:flex">
                <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                  Sesión activa
                </div>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/usuarios");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Mi acceso
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <AuthProvider>
          <ProtectedRoute>
            <AppShell>{children}</AppShell>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}