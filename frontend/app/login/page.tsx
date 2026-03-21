"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth/AuthProvider";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, authenticated, loading } = useAuth();

  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!loading && authenticated) {
      router.replace("/");
    }
  }, [authenticated, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    try {
      setSubmitting(true);
      await login(loginValue, password);
      router.replace("/");
    } catch (error: unknown) {
      setErrorMsg(getErrorMessage(error, "No se pudo iniciar sesión"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl lg:grid-cols-2">
        <div className="hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-700 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold">
              ERP TRICKS S.A.C
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight">
              Plataforma integral de gestión para calzado
            </h1>
            <p className="mt-4 max-w-md text-sm text-slate-200">
              Controla productos, inventario, ventas POS, pedidos,
              producción, compras, proveedores, caja y usuarios desde un
              solo lugar.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm font-bold">Acceso seguro</div>
            <div className="mt-2 text-sm text-slate-300">
              Inicia sesión con tu usuario o correo y tu contraseña para
              entrar al sistema.
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mx-auto max-w-md">
            <div className="mb-8">
              <div className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
                Bienvenido
              </div>
              <h2 className="mt-3 text-3xl font-black text-slate-900">
                Iniciar sesión
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Ingresa con tu usuario o email y tu contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Usuario o correo
                </label>
                <input
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  placeholder="admin o admin@erp.com"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              {errorMsg ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {errorMsg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            {/* <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="font-bold text-slate-800">Acceso inicial</div>
              <div className="mt-1">Usuario: admin</div>
              <div>Contraseña: Admin123*</div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}