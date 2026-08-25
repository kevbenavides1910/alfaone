"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AttPunchImportPreview } from "@/modules/finger-system/integrations/att2016/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FingerPunchesImportPanel() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [runPreview, setRunPreview] = useState(false);

  const previewQuery = useQuery<{ data: AttPunchImportPreview }>({
    queryKey: ["finger-att2016-punches-preview", from, to],
    queryFn: async () => {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(`/api/finger-system/att2016/punches/preview?${qs}`, {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al analizar marcas");
      return json;
    },
    enabled: runPreview && Boolean(from && to),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/att2016/punches/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al importar marcas");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-att2016-punches-preview"] });
      queryClient.invalidateQueries({ queryKey: ["finger-system-dashboard"] });
    },
  });

  const preview = previewQuery.data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importar marcas desde ATT2016</CardTitle>
        <p className="text-sm text-slate-500">
          Descarga marcas del rango indicado a PostgreSQL (solo lectura sobre ATT2016). Importe por día o semana
          para mejor rendimiento.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRunPreview(true);
              previewQuery.refetch();
            }}
            disabled={previewQuery.isFetching}
          >
            {previewQuery.isFetching ? "Analizando…" : "Vista previa"}
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || !from || !to}
          >
            {importMutation.isPending ? "Importando…" : "Confirmar importación"}
          </Button>
        </div>

        {previewQuery.isError ? (
          <p className="text-sm text-red-600">{(previewQuery.error as Error).message}</p>
        ) : null}

        {preview ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat label="Marcas en rango" value={preview.rowsInRange} />
              <MiniStat label="Nuevas" value={preview.newRows} />
              <MiniStat label="Ya importadas" value={preview.alreadyImported} />
              <MiniStat label="Sin empleado vinculado" value={preview.unlinkedPunches} />
            </div>
            {preview.sample.length > 0 ? (
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Hora</th>
                      <th className="px-3 py-2 text-left">Empleado</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-left">Dispositivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{new Date(row.checkTime).toLocaleString("es-CR")}</td>
                        <td className="px-3 py-2">{row.employeeName ?? row.badgeNumber ?? "—"}</td>
                        <td className="px-3 py-2">{row.checkType ?? "—"}</td>
                        <td className="px-3 py-2">{row.deviceSn ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {importMutation.isSuccess ? (
          <p className="text-sm text-emerald-700">
            Importadas {importMutation.data.rowsInserted} marcas nuevas (
            {importMutation.data.rowsSkipped} omitidas por duplicado).
          </p>
        ) : null}
        {importMutation.isError ? (
          <p className="text-sm text-red-600">{(importMutation.error as Error).message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
