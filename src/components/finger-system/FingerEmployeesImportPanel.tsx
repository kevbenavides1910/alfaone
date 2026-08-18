"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AttEmployeeImportPreview } from "@/modules/finger-system/integrations/att2016/types";

const STATUS_LABEL: Record<string, string> = {
  linked: "Ya vinculado",
  matchable: "Listo para vincular",
  already_linked_other: "Conflicto",
  no_alfa_match: "Sin match en Alfa One",
};

export function FingerEmployeesImportPanel() {
  const queryClient = useQueryClient();
  const previewQuery = useQuery<{ data: AttEmployeeImportPreview }>({
    queryKey: ["finger-att2016-employees-preview"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/att2016/employees/preview", {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al analizar empleados");
      return json;
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/att2016/employees/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyMatchable: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al importar");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-att2016-employees-preview"] });
      queryClient.invalidateQueries({ queryKey: ["finger-system-dashboard"] });
    },
  });

  const preview = previewQuery.data?.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Importar desde ATT2016</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Vincula empleados biométricos con el maestro RRHH por código (Badgenumber ↔ codigoEmpleado).
              Solo lectura sobre ATT2016.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => previewQuery.refetch()}
            disabled={previewQuery.isFetching}
          >
            {previewQuery.isFetching ? "Analizando…" : "Actualizar análisis"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewQuery.isError ? (
            <p className="text-sm text-red-600">
              {(previewQuery.error as Error).message ||
                "No fue posible conectar con ATT2016. Configure credenciales de red en Configuración biométrica."}
            </p>
          ) : null}

          {preview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="En ATT2016" value={preview.attTotal} />
                <Stat label="Vinculables" value={preview.matchable} tone="success" />
                <Stat label="Ya vinculados" value={preview.alreadyLinked} />
                <Stat label="Sin match Alfa" value={preview.noAlfaMatch} tone="warn" />
                <Stat label="Conflictos" value={preview.conflict} tone="danger" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || preview.matchable === 0}
                >
                  {importMutation.isPending
                    ? "Importando…"
                    : `Confirmar importación (${preview.matchable})`}
                </Button>
                {importMutation.isSuccess ? (
                  <p className="text-sm text-emerald-700 self-center">
                    Importados {importMutation.data.rowsInserted}, actualizados{" "}
                    {importMutation.data.rowsUpdated}.
                  </p>
                ) : null}
                {importMutation.isError ? (
                  <p className="text-sm text-red-600 self-center">
                    {(importMutation.error as Error).message}
                  </p>
                ) : null}
              </div>

              <div className="overflow-auto rounded-lg border max-h-80">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Badge</th>
                      <th className="px-3 py-2 text-left font-medium">Nombre ATT</th>
                      <th className="px-3 py-2 text-left font-medium">Empleado Alfa</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.attUserId} className="border-t">
                        <td className="px-3 py-2 font-mono">{row.badgeNumber}</td>
                        <td className="px-3 py-2">{row.name ?? "—"}</td>
                        <td className="px-3 py-2">
                          {row.employeeName ?? "—"}
                          {row.employeeCodigo ? (
                            <span className="text-slate-400 ml-1">({row.employeeCodigo})</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">{STATUS_LABEL[row.matchStatus] ?? row.matchStatus}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : previewQuery.isLoading ? (
            <p className="text-sm text-slate-500">Conectando con ATT2016…</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warn" | "danger";
}) {
  const cls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "danger"
          ? "text-red-700"
          : "text-slate-900";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
