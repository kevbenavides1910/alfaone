"use client";

import { useQuery } from "@tanstack/react-query";
import { FingerDashboardView } from "@/components/finger-system/FingerDashboardView";

export default function FingerSystemDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["finger-system-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/dashboard", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar dashboard");
      return json.data;
    },
  });

  if (isLoading) {
    return <div className="p-6 text-slate-500">Cargando dashboard…</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-6 text-red-600">
        No fue posible cargar el dashboard de Finger System. Verifique permisos o contacte al administrador.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <FingerDashboardView stats={data} />
    </div>
  );
}
