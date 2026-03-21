"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PermisosRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/usuarios?tab=permisos");
  }, [router]);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">Redirigiendo a Permisos...</p>
    </div>
  );
}