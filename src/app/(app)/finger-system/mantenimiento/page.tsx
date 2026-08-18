"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { FingerDiagnosticPanel } from "@/components/finger-system/FingerDiagnosticPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FingerMantenimientoPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["finger-system-diagnostic"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/diagnostic", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar diagnóstico");
      return json.data as Awaited<
        ReturnType<typeof import("@/modules/finger-system/services/finger-dashboard").getFingerSystemDiagnostic>
      >;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/sync/run", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error en sincronización");
      return json.data;
    },
    onSuccess: () => refetch(),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Mantenimiento</h1>
        <p className="mt-1 text-sm text-slate-600">
          Verificación de base de datos, ATT2016, dispositivos y sincronización.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Sincronización manual</CardTitle>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? "Sincronizando…" : "Ejecutar sync ahora"}
          </Button>
        </CardHeader>
        <CardContent>
          {syncMutation.isSuccess ? (
            <p className="text-sm text-emerald-700">
              Sync completada. Dispositivos en línea:{" "}
              {(syncMutation.data.steps?.devices as { online?: number })?.online ?? "—"}.
            </p>
          ) : null}
          {syncMutation.isError ? (
            <p className="text-sm text-red-600">{(syncMutation.error as Error).message}</p>
          ) : null}
          <p className="text-xs text-slate-500 mt-2">
            Verifica dispositivos e importa marcas ATT2016 de los últimos 3 días. La sync automática usa{" "}
            <code className="text-xs">/api/cron/finger-sync</code>.
          </p>
        </CardContent>
      </Card>

      {isLoading ? <p className="text-slate-500">Ejecutando diagnóstico…</p> : null}
      {isError ? (
        <p className="text-red-600">No fue posible ejecutar el diagnóstico del sistema.</p>
      ) : null}
      {data ? <FingerDiagnosticPanel items={data} /> : null}
    </div>
  );
}
