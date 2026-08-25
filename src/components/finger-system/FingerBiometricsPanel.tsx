"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AttTemplateSyncPreview } from "@/modules/finger-system/integrations/att2016/types";
import { fingerLabel } from "@/modules/finger-system/config/finger-biometrics.client";

type BiometricListResponse = {
  items: {
    linkId: string;
    attUserId: number | null;
    badgeNumber: string | null;
    employeeName: string;
    employeeCodigo: string;
    fingerprintCount: number;
    lastSyncAt: string | null;
    status: "registered" | "pending" | "unlinked";
  }[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const STATUS_LABEL = {
  registered: "Con huellas",
  pending: "Sin huellas",
  unlinked: "Sin USERID ATT",
};

export function FingerBiometricsPanel() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const listQuery = useQuery<{ data: BiometricListResponse }>({
    queryKey: ["finger-biometrics", q, page],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/finger-system/biometrics?${qs}`, { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar");
      return json;
    },
  });

  const previewQuery = useQuery<{ data: AttTemplateSyncPreview }>({
    queryKey: ["finger-biometrics-preview"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/biometrics/preview", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al analizar ATT2016");
      return json;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/biometrics/sync", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al sincronizar");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-biometrics"] });
      queryClient.invalidateQueries({ queryKey: ["finger-biometrics-preview"] });
    },
  });

  const list = listQuery.data?.data;
  const preview = previewQuery.data?.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Sincronizar desde ATT2016</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Lee metadatos de la tabla TEMPLATE (USERID + dedo). Los blobs biométricos permanecen en ATT2016.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => previewQuery.refetch()} disabled={previewQuery.isFetching}>
            Actualizar análisis
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {previewQuery.isError ? (
            <p className="text-sm text-red-600">{(previewQuery.error as Error).message}</p>
          ) : null}
          {preview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Filas TEMPLATE" value={preview.attTemplateRows} />
                <MiniStat label="Empleados vinculados" value={preview.linkedEmployees} />
                <MiniStat label="Con huellas" value={preview.withFingerprints} tone="success" />
                <MiniStat label="Sin huellas" value={preview.withoutFingerprints} tone="warn" />
                <MiniStat label="ATT sin vínculo" value={preview.unlinkedAttUsers} />
              </div>
              {preview.attTemplateRows === 0 ? (
                <p className="text-sm text-amber-700 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  TEMPLATE está vacío en ATT2016. Las huellas pueden existir solo en los relojes físicos; use
                  verificación de dispositivos (Fase 4) hasta habilitar descarga directa en Fase 5.1.
                </p>
              ) : null}
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? "Sincronizando…" : "Actualizar contadores locales"}
              </Button>
              {syncMutation.isSuccess ? (
                <p className="text-sm text-emerald-700">
                  Actualizados {syncMutation.data.rowsUpdated} registros.
                </p>
              ) : null}
            </>
          ) : previewQuery.isLoading ? (
            <p className="text-sm text-slate-500">Analizando ATT2016…</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado por empleado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar empleado…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />

          {listQuery.isError ? (
            <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
          ) : null}

          {list ? (
            <>
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Empleado</th>
                      <th className="px-3 py-2 text-left font-medium">Huellas</th>
                      <th className="px-3 py-2 text-left font-medium">Dedos (ATT)</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.items.map((row) => {
                      const previewRow = preview?.rows.find((p) => p.linkId === row.linkId);
                      return (
                        <tr key={row.linkId} className="border-t">
                          <td className="px-3 py-2">
                            <div>{row.employeeName}</div>
                            <div className="text-xs text-slate-500">{row.employeeCodigo}</div>
                          </td>
                          <td className="px-3 py-2 font-mono">{row.fingerprintCount}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {previewRow?.fingerIds.length
                              ? previewRow.fingerIds.map((id) => fingerLabel(id)).join(", ")
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary">{STATUS_LABEL[row.status]}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {list.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No hay empleados vinculados. Importe vínculos en Empleados primero.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {list.totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-600">
                    Página {list.page} de {list.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= list.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              ) : null}
            </>
          ) : listQuery.isLoading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warn";
}) {
  const cls =
    tone === "success" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
