"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Eye, RefreshCw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDateTime } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions/check";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  NAF_REPORT_COLUMNS,
  formatNafReportCell,
  nafReportRowToExcel,
  type NafEmployeeReportRow,
} from "@/modules/empleados-naf/business/report-fields";

interface NafEmployeeRow extends NafEmployeeReportRow {
  id: string;
  sourceKey: string;
  estado: string | null;
  area: string | null;
  depto: string | null;
  telefono: string | null;
  tipoEmp: string | null;
  indOficial: string | null;
  fEgreso: string | null;
  syncedAt: string;
}

interface ListResponse {
  data: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    rows: NafEmployeeRow[];
    lastSync: {
      status: string;
      startedAt: string;
      finishedAt: string | null;
      rowsFetched: number;
      rowsUpserted: number;
      errorMessage: string | null;
    } | null;
    resumenEstado: Record<string, number>;
  };
}

function estadoBadge(estado: string | null) {
  if (!estado) return <Badge variant="secondary">—</Badge>;
  const code = estado.toUpperCase();
  if (code === "A") {
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Activo</Badge>;
  }
  if (code === "I") {
    return <Badge variant="secondary">Inactivo</Badge>;
  }
  if (code === "B") {
    return <Badge variant="outline">Baja</Badge>;
  }
  return <Badge variant="outline">{estado}</Badge>;
}

export default function EmpleadosNafPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canSync = hasPermission(session ?? null, "empleadosNaf.sync", "edit");

  const [filters, setFilters] = useState({ q: "", noCia: "", estado: "" });
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (filters.q.trim()) sp.set("q", filters.q.trim());
    if (filters.noCia.trim()) sp.set("noCia", filters.noCia.trim());
    if (filters.estado.trim()) sp.set("estado", filters.estado.trim());
    return sp.toString();
  }, [filters, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["empleados-naf", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/empleados-naf?${queryParams}`);
      if (!res.ok) throw new Error("Error al cargar empleados NAF");
      return (await res.json()) as ListResponse;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/empleados-naf/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Error al sincronizar");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf"] });
    },
  });

  const rows = data?.data.rows ?? [];
  const meta = data?.data;
  const lastSync = meta?.lastSync;
  const resumen = meta?.resumenEstado ?? {};
  const tableColumns = [
    ...NAF_REPORT_COLUMNS,
    { key: "estado" as const, label: "Estado" },
  ];

  return (
    <ModulePage wide className="space-y-4">
      <ModulePageHeader
        title="Empleados NAF"
        description={`Réplica del maestro Oracle · reporte «Empleados y Cuentas Bancarias» · ${meta?.total ?? 0} registros`}
        icon={Users}
        actions={
          canSync ? (
            <Button
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              Sincronizar ahora
            </Button>
          ) : undefined
        }
      />

      {(Object.keys(resumen).length > 0 || lastSync) && (
        <Card>
          <CardContent className="pt-6 flex items-start gap-3">
            <div className="rounded-lg bg-red-500/10 p-2 ring-1 ring-red-500/20">
              <Database className="h-5 w-5 text-[var(--app-primary)]" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {Object.keys(resumen).length > 0 && (
                <p>
                  Activos: {resumen.A ?? 0} · Inactivos: {resumen.I ?? 0}
                  {resumen.B != null ? ` · Baja: ${resumen.B}` : ""}
                </p>
              )}
              {lastSync && (
                <p>
                  Última sync: {formatDateTime(lastSync.finishedAt ?? lastSync.startedAt)} ·{" "}
                  {lastSync.status === "success"
                    ? `${lastSync.rowsUpserted} actualizados`
                    : lastSync.status === "error"
                      ? `Error: ${lastSync.errorMessage ?? "desconocido"}`
                      : "En curso…"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

        {syncMutation.isError && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md p-3">
            {(syncMutation.error as Error).message}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por código, nombre, cédula, correo…"
              className="pl-9"
              value={filters.q}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, q: e.target.value }));
              }}
            />
          </div>
          <Input
            placeholder="Compañía (NO_CIA)"
            className="lg:w-36"
            value={filters.noCia}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, noCia: e.target.value }));
            }}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm lg:w-40"
            value={filters.estado}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, estado: e.target.value }));
            }}
          >
            <option value="">Todos los estados</option>
            <option value="A">Activos</option>
            <option value="I">Inactivos</option>
            <option value="B">Baja</option>
          </select>
          <Button
            variant="outline"
            onClick={() =>
              exportRowsToExcel({
                filename: "empleados_naf_cuentas_bancarias",
                rows: rows.map((r) => ({
                  ...nafReportRowToExcel(r),
                  Estado: r.estado ?? "",
                })),
              })
            }
            disabled={!rows.length}
          >
            Exportar Excel
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Use Shift + scroll del mouse para desplazarse horizontalmente por el reporte.
        </p>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="premium-table w-full text-sm min-w-[3600px]">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-slate-600">
                  {tableColumns.map((col) => (
                    <th key={col.key} className="p-3 font-medium whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                  <th className="p-3 font-medium w-20 sticky right-0 bg-slate-50" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="p-8 text-center text-slate-500">
                      Cargando empleados NAF…
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="p-8 text-center text-slate-500">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No hay empleados. Ejecute la sincronización con Oracle NAF.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50/80">
                    {NAF_REPORT_COLUMNS.map((col) => (
                      <td key={col.key} className="p-3 whitespace-nowrap">
                        {col.key === "noEmple" ? (
                          <span className="font-mono text-xs">
                            {formatNafReportCell(row, col.key)}
                          </span>
                        ) : (
                          formatNafReportCell(row, col.key)
                        )}
                      </td>
                    ))}
                    <td className="p-3">{estadoBadge(row.estado)}</td>
                    <td className="p-3 sticky right-0 bg-white">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/empleados-naf/${encodeURIComponent(row.sourceKey)}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>
              Página {meta.page} de {meta.totalPages} · {meta.total} registros
              {isFetching && !isLoading ? " · actualizando…" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
    </ModulePage>
  );
}
