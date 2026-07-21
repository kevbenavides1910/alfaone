"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  Link2,
  RefreshCw,
  Search,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import { formatCurrency } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

type DiscrepancyStatus =
  | "sin_vinculo"
  | "coincidencia_exacta"
  | "vinculo_manual"
  | "desincronizado";

type DiscrepancyRow = {
  contratoNaf: string;
  contratoRaw: string | null;
  status: DiscrepancyStatus;
  roleCount: number;
  employeeCount: number;
  nominaLineCount: number;
  netoNomina: number;
  planillas: {
    noCia: string;
    companyLabel: string;
    codPla: string;
    nominaNombre: string | null;
  }[];
  exactContractId: string | null;
  exactLicitacionNo: string | null;
  linkedContractId: string | null;
  linkedLicitacionNo: string | null;
  suggestions: {
    contractId: string;
    licitacionNo: string;
    client: string;
    company: string;
    score: number;
  }[];
};

type ReconciliationData = {
  periodo: {
    ano: number;
    fDesde: string;
    fHasta: string;
    label: string;
    empleados: number;
    empresas: number;
  } | null;
  summary: {
    totalContratosNaf: number;
    sinVinculo: number;
    coincidenciaExactaPendiente: number;
    vinculadosManual: number;
    desincronizados: number;
    netoSinVinculo: number;
  };
  discrepancies: DiscrepancyRow[];
  contracts: {
    id: string;
    licitacionNo: string;
    client: string;
    company: string;
    status: string;
  }[];
};

const STATUS_LABEL: Record<DiscrepancyStatus, string> = {
  sin_vinculo: "Sin vínculo",
  coincidencia_exacta: "Coincidencia exacta",
  vinculo_manual: "Homologado manual",
  desincronizado: "Desincronizado",
};

const STATUS_VARIANT: Record<DiscrepancyStatus, "danger" | "warning" | "secondary" | "success"> = {
  sin_vinculo: "danger",
  coincidencia_exacta: "success",
  vinculo_manual: "warning",
  desincronizado: "warning",
};

function defaultContractId(row: DiscrepancyRow): string {
  if (row.exactContractId) return row.exactContractId;
  if (row.linkedContractId) return row.linkedContractId;
  if (row.suggestions[0]?.contractId) return row.suggestions[0].contractId;
  return "";
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function NafHomologacionPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session ?? null, "empleadosNaf.homologacion", "edit");
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState("");
  const [selectedByRow, setSelectedByRow] = useState<Record<string, string>>({});
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["empleados-naf-homologacion"],
    queryFn: async () => {
      const res = await fetch("/api/empleados-naf/nomina/homologacion");
      if (!res.ok) throw new Error("Error al cargar homologación");
      return (await res.json()) as { data: ReconciliationData };
    },
  });

  const payload = data?.data;

  const filteredDiscrepancies = useMemo(() => {
    const rows = payload?.discrepancies ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.contratoNaf.toLowerCase().includes(q) ||
        (row.contratoRaw ?? "").toLowerCase().includes(q) ||
        row.planillas.some(
          (planilla) =>
            planilla.codPla.toLowerCase().includes(q) ||
            (planilla.nominaNombre ?? "").toLowerCase().includes(q),
        ),
    );
  }, [payload?.discrepancies, filter]);

  const columnDefs = useMemo((): TableColumnFilterDef<DiscrepancyRow>[] => {
    return [
      { key: "contratoNaf", label: "Contrato NAF", getValue: (r) => r.contratoNaf },
      { key: "estado", label: "Estado", getValue: (r) => r.status },
      {
        key: "planillas",
        label: "Planillas",
        getValue: (r) => r.planillas.map((p) => `${p.codPla} ${p.nominaNombre ?? ""}`).join(" "),
      },
      {
        key: "impacto",
        label: "Impacto nómina",
        getValue: (r) => String(r.netoNomina),
      },
      {
        key: "contratoSistema",
        label: "Contrato en presupuestos",
        getValue: (r) => r.exactLicitacionNo ?? r.linkedLicitacionNo ?? "",
      },
      { key: "actions", label: "", filterable: false, getValue: () => "" },
    ];
  }, []);

  const displayedDiscrepancies = useMemo(
    () =>
      filterRowsByColumnFilters(
        filteredDiscrepancies,
        columnFilters,
        columnDefs.map((column) => ({
          key: column.key,
          getValue: column.getValue,
          mode: column.mode,
          filterable: column.filterable,
        })),
      ),
    [filteredDiscrepancies, columnDefs, columnFilters],
  );

  const linkMutation = useMutation({
    mutationFn: async (input: { contratoNaf: string; contractId: string }) => {
      const res = await fetch("/api/empleados-naf/nomina/homologacion/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al homologar");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-homologacion"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina-detalle"] });
      toast.success("Contrato homologado", "La nómina de ese contrato NAF afectará el presupuesto vinculado.");
    },
    onError: (error: Error) => toast.error("Error", error.message),
  });

  const applyExactMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/empleados-naf/nomina/homologacion/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_exact" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      return json.data as { linksCreated: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-homologacion"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina-detalle"] });
      toast.success("Coincidencias exactas aplicadas", `${result.linksCreated} homologación(es).`);
    },
    onError: (error: Error) => toast.error("Error", error.message),
  });

  function getSelection(row: DiscrepancyRow): string {
    return selectedByRow[row.contratoNaf] ?? defaultContractId(row);
  }

  function handleLink(row: DiscrepancyRow) {
    const contractId = getSelection(row);
    if (!contractId) {
      toast.error("Seleccione un contrato", "Elija la licitación de presupuestos a la que homologar.");
      return;
    }
    linkMutation.mutate({ contratoNaf: row.contratoNaf, contractId });
  }

  const summary = payload?.summary;

  const exportDiscrepancies = (rows: DiscrepancyRow[]) => {
    exportRowsToExcel({
      filename: "homologacion_contratos_naf",
      sheetName: "Pendientes",
      rows: rows.map((row) => ({
        "Contrato NAF": row.contratoNaf,
        "Contrato original": row.contratoRaw ?? "",
        Estado: STATUS_LABEL[row.status],
        Planillas: row.planillas
          .map((planilla) => `${planilla.codPla} ${planilla.nominaNombre ?? ""}`.trim())
          .join(" | "),
        "Neto nómina": row.netoNomina,
        "Líneas nómina": row.nominaLineCount,
        Roles: row.roleCount,
        Empleados: row.employeeCount,
        "Licitación sugerida": row.suggestions[0]?.licitacionNo ?? "",
        "Contrato presupuestos": row.exactLicitacionNo ?? row.linkedLicitacionNo ?? "",
      })),
    });
  };

  return (
    <ModulePage wide className="space-y-4">
      <ModulePageHeader
        title="Homologación contratos NAF"
        description="Vincule los números de contrato que Oracle NAF usa en nómina con las licitaciones del módulo de presupuestos, para que la planilla impacte el presupuesto correcto."
        icon={GitMerge}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            {canEdit && (summary?.coincidenciaExactaPendiente ?? 0) > 0 && (
              <Button
                size="sm"
                onClick={() => applyExactMutation.mutate()}
                disabled={applyExactMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Aplicar {summary?.coincidenciaExactaPendiente} coincidencia(s) exacta(s)
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          {payload?.periodo ? (
            <p>
              Mostrando contratos de empleados con nómina en la última quincena:{" "}
              <span className="font-medium text-foreground">{payload.periodo.label}</span> (
              {payload.periodo.empleados} empleados · {payload.periodo.empresas} empresas).
            </p>
          ) : (
            <p>No hay datos de nómina sincronizados para determinar la última quincena.</p>
          )}
          <p className="mt-2">
            Los vínculos se guardan en el catálogo compartido de homologación (mismo que RRHH). Tras
            homologar, vuelva a{" "}
            <Link href="/empleados-naf/nomina" className="text-[var(--app-primary)] hover:underline">
              Nómina NAF
            </Link>{" "}
            y filtre por planilla para verificar el impacto por contrato.
          </p>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Contratos NAF" value={summary.totalContratosNaf} />
          <MetricCard label="Sin vínculo" value={summary.sinVinculo} accent="text-rose-600" />
          <MetricCard
            label="Exactas pendientes"
            value={summary.coincidenciaExactaPendiente}
            accent="text-emerald-600"
          />
          <MetricCard label="Homologados" value={summary.vinculadosManual} accent="text-red-600" />
          <MetricCard label="Desincronizados" value={summary.desincronizados} accent="text-amber-600" />
          <MetricCard
            label="Neto sin vínculo"
            value={formatCurrency(summary.netoSinVinculo)}
            accent="text-rose-600"
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Contratos NAF pendientes de homologar
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={displayedDiscrepancies.length === 0}
            onClick={() => exportDiscrepancies(displayedDiscrepancies)}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Excel ({displayedDiscrepancies.length})
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Filtrar por contrato o planilla…"
              className="pl-9"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Analizando contratos NAF…</p>}
          {isError && (
            <p className="text-sm text-rose-600">No se pudo cargar la homologación de contratos.</p>
          )}
          {!isLoading && !isError && filteredDiscrepancies.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Todos los contratos NAF activos están homologados con presupuestos.
            </div>
          )}

          {displayedDiscrepancies.length > 0 && (
            <>
              {hasActiveColumnFilters(columnFilters) && (
                <div className="flex justify-end px-3 py-1.5 border-b bg-slate-50">
                  <button
                    type="button"
                    className="text-red-600 hover:underline text-xs"
                    onClick={() => setColumnFilters({})}
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
              <div className="overflow-x-auto border rounded-lg">
                <table data-table-id="empleados-naf-homologacion" className="w-full text-sm">
                  <thead>
                    <TableColumnFilterHead
                      tableId="empleados-naf-homologacion"
                      defaultColumnWidths={{
                        contratoNaf: 160,
                        estado: 100,
                        planillas: 100,
                        impacto: 100,
                        contratoSistema: 180,
                        actions: 90,
                      }}
                      columns={columnDefs}
                      rows={filteredDiscrepancies}
                      filters={columnFilters}
                      onFilterChange={(key, value) =>
                        setColumnFilters((prev) => ({ ...prev, [key]: value }))
                      }
                      filterRowClassName="bg-slate-50"
                    />
                  </thead>
                  <tbody>
                    {displayedDiscrepancies.map((row) => {
                      const selection = getSelection(row);
                      return (
                        <tr key={row.contratoNaf} className="border-b align-top">
                          <td className="px-3 py-3">
                            <div className="font-mono text-xs break-all">{row.contratoNaf}</div>
                            {row.contratoRaw && row.contratoRaw !== row.contratoNaf && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {row.contratoRaw}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={STATUS_VARIANT[row.status]}>
                              {STATUS_LABEL[row.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground min-w-[180px]">
                            {row.planillas.length === 0 ? (
                              "—"
                            ) : (
                              <div className="space-y-1">
                                {row.planillas.slice(0, 3).map((planilla) => (
                                  <div key={`${planilla.noCia}|${planilla.codPla}`}>
                                    <span className="font-medium text-foreground">{planilla.codPla}</span>
                                    {planilla.nominaNombre ? ` · ${planilla.nominaNombre}` : ""}
                                    <span className="text-[10px] block">{planilla.companyLabel}</span>
                                  </div>
                                ))}
                                {row.planillas.length > 3 && (
                                  <div className="text-[10px]">+{row.planillas.length - 3} más</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {formatCurrency(row.netoNomina)}
                            <div className="text-[10px]">
                              {row.nominaLineCount} líneas · {row.roleCount} roles · {row.employeeCount}{" "}
                              emp.
                            </div>
                          </td>
                          <td className="px-3 py-3 min-w-[220px]">
                            {canEdit ? (
                              <Select
                                value={selection || undefined}
                                onValueChange={(value) =>
                                  setSelectedByRow((prev) => ({
                                    ...prev,
                                    [row.contratoNaf]: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Seleccionar licitación…" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {(payload?.contracts ?? []).map((contract) => (
                                    <SelectItem key={contract.id} value={contract.id} className="text-xs">
                                      {contract.licitacionNo} · {contract.client} ({contract.company})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">
                                {row.exactLicitacionNo ?? row.linkedLicitacionNo ?? "—"}
                              </span>
                            )}
                            {row.suggestions[0] && (
                              <div className="text-[10px] text-muted-foreground mt-1">
                                Sugerencia: {row.suggestions[0].licitacionNo} ({row.suggestions[0].score}%)
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={linkMutation.isPending}
                                onClick={() => handleLink(row)}
                              >
                                <Link2 className="h-3.5 w-3.5 mr-1" />
                                Homologar
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </ModulePage>
  );
}
