"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isLogin = pathname === "/login";

    if (!authenticated && !isLogin) {
      router.replace("/login");
      return;
    }

    if (authenticated && isLogin) {
      router.replace("/");
    }
  }, [authenticated, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-700 shadow-sm">
          Cargando sesión...
        </div>
      </div>
    );
  }

  if (!authenticated && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}