"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RolesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/usuarios?tab=roles");
  }, [router]);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">Redirigiendo a Roles...</p>
    </div>
  );
}