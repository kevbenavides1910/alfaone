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
  Unlink,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
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
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import { canReconcileEmployeeContractsSession } from "@/modules/core/permissions";

type DiscrepancyStatus =
  | "sin_vinculo"
  | "coincidencia_exacta"
  | "vinculo_manual"
  | "desincronizado";

interface DiscrepancyRow {
  contratoRrhh: string;
  contratoRaw: string | null;
  status: DiscrepancyStatus;
  placementCount: number;
  employeeCount: number;
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
}

interface ReconciliationData {
  summary: {
    totalRrhhContratos: number;
    sinVinculo: number;
    coincidenciaExactaPendiente: number;
    vinculadosManual: number;
    desincronizados: number;
    contratosSinEmpleados: number;
  };
  discrepancies: DiscrepancyRow[];
  contractsWithoutEmployees: {
    contractId: string;
    licitacionNo: string;
    client: string;
    company: string;
    status: string;
  }[];
  contracts: {
    id: string;
    licitacionNo: string;
    client: string;
    company: string;
    status: string;
  }[];
}

const STATUS_LABEL: Record<DiscrepancyStatus, string> = {
  sin_vinculo: "Sin vínculo",
  coincidencia_exacta: "Coincidencia exacta",
  vinculo_manual: "Vínculo pendiente de aplicar",
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

export default function EmpleadosContratosPage() {
  const { data: session } = useSession();
  const canEdit = canReconcileEmployeeContractsSession(session ?? null);
  const canConsolidate = hasPermission(session, "presupuestos.contracts", "edit");
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState("");
  const [selectedByRow, setSelectedByRow] = useState<Record<string, string>>({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["empleados-contratos-discrepancias"],
    queryFn: async () => {
      const res = await fetch("/api/empleados/contratos/discrepancias");
      if (!res.ok) throw new Error("Error al cargar discrepancias");
      return (await res.json()) as { data: ReconciliationData };
    },
  });

  const payload = data?.data;

  const filteredDiscrepancies = useMemo(() => {
    const rows = payload?.discrepancies ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.contratoRrhh.toLowerCase().includes(q) ||
        (r.contratoRaw ?? "").toLowerCase().includes(q) ||
        (r.exactLicitacionNo ?? "").toLowerCase().includes(q) ||
        (r.linkedLicitacionNo ?? "").toLowerCase().includes(q),
    );
  }, [payload?.discrepancies, filter]);

  const linkMutation = useMutation({
    mutationFn: async (input: {
      contratoRrhh: string;
      contractId: string;
      consolidate?: boolean;
    }) => {
      const res = await fetch("/api/empleados/contratos/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al vincular");
      return json.data;
    },
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ["empleados-contratos-discrepancias"] });
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
      const msg = vars.consolidate
        ? `Licitación unificada. ${result.placementsUpdated} asignación(es) actualizadas.`
        : `${result.placementsUpdated} asignación(es) vinculadas.`;
      toast.success("Contrato consolidado", msg);
    },
    onError: (e: Error) => toast.error("Error", e.message),
  });

  const applyExactMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/empleados/contratos/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_exact" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error");
      return json.data as { linksCreated: number; placementsUpdated: number };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["empleados-contratos-discrepancias"] });
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
      toast.success(
        "Coincidencias exactas aplicadas",
        `${result.linksCreated} vínculo(s), ${result.placementsUpdated} asignación(es).`,
      );
    },
    onError: (e: Error) => toast.error("Error", e.message),
  });

  function getSelection(row: DiscrepancyRow): string {
    return selectedByRow[row.contratoRrhh] ?? defaultContractId(row);
  }

  function handleLink(row: DiscrepancyRow, consolidate: boolean) {
    const contractId = getSelection(row);
    if (!contractId) {
      toast.error("Seleccione un contrato", "Elija el contrato del módulo de contratos al que vincular.");
      return;
    }
    linkMutation.mutate({
      contratoRrhh: row.contratoRrhh,
      contractId,
      consolidate,
    });
  }

  const summary = payload?.summary;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Topbar title="Empleados · Conciliación de contratos" />
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <GitMerge className="h-6 w-6 text-indigo-600" />
              Conciliación de contratos
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Compare los números de contrato del registro RRHH con las licitaciones del módulo de
              contratos. Vincule o unifique para consolidar empleados bajo el contrato correcto.
            </p>
          </div>
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
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Contratos RRHH" value={summary.totalRrhhContratos} />
            <MetricCard label="Sin vínculo" value={summary.sinVinculo} accent="text-rose-600" />
            <MetricCard
              label="Exactas pendientes"
              value={summary.coincidenciaExactaPendiente}
              accent="text-emerald-600"
            />
            <MetricCard label="Vinculados" value={summary.vinculadosManual} accent="text-indigo-600" />
            <MetricCard label="Desincronizados" value={summary.desincronizados} accent="text-amber-600" />
            <MetricCard
              label="Contratos sin empleados"
              value={summary.contratosSinEmpleados}
              accent="text-slate-600"
            />
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Unlink className="h-4 w-4" />
              Discrepancias por vincular
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Filtrar por número de contrato…"
                className="pl-9"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            {isLoading && <p className="text-sm text-slate-500">Analizando discrepancias…</p>}
            {isError && (
              <p className="text-sm text-rose-600">No se pudo cargar el análisis de contratos.</p>
            )}
            {!isLoading && !isError && filteredDiscrepancies.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                No hay discrepancias pendientes. Todos los contratos RRHH están vinculados al módulo de
                contratos.
              </div>
            )}

            {filteredDiscrepancies.length > 0 && (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2">Contrato RRHH</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Empleados</th>
                      <th className="px-3 py-2">Contrato en sistema</th>
                      <th className="px-3 py-2">Sugerencias</th>
                      {canEdit && <th className="px-3 py-2 text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiscrepancies.map((row) => {
                      const selection = getSelection(row);
                      return (
                        <tr key={row.contratoRrhh} className="border-b align-top">
                          <td className="px-3 py-3">
                            <div className="font-mono text-xs text-slate-900 break-all">
                              {row.contratoRrhh}
                            </div>
                            {row.contratoRaw && row.contratoRaw !== row.contratoRrhh && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{row.contratoRaw}</div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant={STATUS_VARIANT[row.status]}>
                              {STATUS_LABEL[row.status]}
                            </Badge>
                            {row.exactLicitacionNo && row.status === "coincidencia_exacta" && (
                              <div className="text-[10px] text-emerald-700 mt-1">
                                = {row.exactLicitacionNo}
                              </div>
                            )}
                            {row.linkedLicitacionNo && row.status === "desincronizado" && (
                              <div className="text-[10px] text-amber-700 mt-1">
                                Vinculado a: {row.linkedLicitacionNo}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {row.employeeCount} emp.
                            <div className="text-[10px] text-slate-400">
                              {row.placementCount} asign.
                            </div>
                          </td>
                          <td className="px-3 py-3 min-w-[220px]">
                            {canEdit ? (
                              <Select
                                value={selection || undefined}
                                onValueChange={(v) =>
                                  setSelectedByRow((prev) => ({
                                    ...prev,
                                    [row.contratoRrhh]: v,
                                  }))
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Seleccionar contrato…" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64">
                                  {(payload?.contracts ?? []).map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">
                                      {c.licitacionNo} · {c.client} ({c.company})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-slate-500">
                                {row.exactLicitacionNo ?? row.linkedLicitacionNo ?? "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {row.suggestions.length === 0 ? (
                              <span className="text-slate-400 text-xs">Sin sugerencias</span>
                            ) : (
                              <ul className="space-y-1">
                                {row.suggestions.slice(0, 3).map((s) => (
                                  <li key={s.contractId} className="text-[11px] text-slate-600">
                                    <button
                                      type="button"
                                      className="text-left hover:text-indigo-600 underline-offset-2 hover:underline"
                                      onClick={() =>
                                        setSelectedByRow((prev) => ({
                                          ...prev,
                                          [row.contratoRrhh]: s.contractId,
                                        }))
                                      }
                                    >
                                      {s.score}% · {s.licitacionNo}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          {canEdit && (
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <div className="flex flex-col gap-1 items-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={linkMutation.isPending || !selection}
                                  onClick={() => handleLink(row, false)}
                                >
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Vincular
                                </Button>
                                {canConsolidate && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={linkMutation.isPending || !selection}
                                    onClick={() => handleLink(row, true)}
                                    title="Renombra la licitación del contrato al número RRHH y vincula empleados"
                                  >
                                    <GitMerge className="h-3 w-3 mr-1" />
                                    Unificar licitación
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {(payload?.contractsWithoutEmployees.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Contratos del sistema sin empleados asignados ({payload!.contractsWithoutEmployees.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b text-left text-xs uppercase text-slate-500">
                      <th className="px-4 py-2">Licitación</th>
                      <th className="px-4 py-2">Cliente</th>
                      <th className="px-4 py-2">Empresa</th>
                      <th className="px-4 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload!.contractsWithoutEmployees.map((c) => (
                      <tr key={c.contractId} className="border-b">
                        <td className="px-4 py-2">
                          <Link
                            href={`/contracts/${c.contractId}`}
                            className="text-indigo-600 hover:underline font-mono text-xs"
                          >
                            {c.licitacionNo}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-slate-700">{c.client}</td>
                        <td className="px-4 py-2 text-slate-600">{c.company}</td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary">{c.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = "text-slate-900",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}
