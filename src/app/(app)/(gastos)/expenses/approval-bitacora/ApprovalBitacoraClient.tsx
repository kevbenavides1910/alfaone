"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/format";
import { companyDisplayName } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import type { ExpenseApprovalDecision, ExpenseApprovalStatus, ExpenseType } from "@prisma/client";

type BitacoraMode = "decisions" | "submissions";

type ApproverOpt = { id: string; name: string; email: string | null };

type DecisionRow = {
  kind: "decision";
  id: string;
  stepOrder: number;
  decision: ExpenseApprovalDecision;
  comment: string | null;
  decidedAt: string;
  approver: ApproverOpt;
  expense: {
    id: string;
    sequentialNo: number;
    description: string;
    type: ExpenseType;
    company: string | null;
    amount: number;
    approvalStatus: ExpenseApprovalStatus;
    requiredApprovalSteps: number;
    currentApprovalStep: number | null;
    createdAt: string;
    createdBy: ApproverOpt;
  };
};

type SubmissionRow = {
  kind: "submission";
  id: string;
  submittedAt: string;
  submittedBy: ApproverOpt;
  expense: {
    id: string;
    sequentialNo: number;
    description: string;
    type: ExpenseType;
    company: string | null;
    amount: number;
    approvalStatus: ExpenseApprovalStatus;
    requiredApprovalSteps: number;
    currentApprovalStep: number | null;
  };
};

type BitacoraResponse =
  | {
      mode: "decisions";
      data: DecisionRow[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    }
  | {
      mode: "submissions";
      data: SubmissionRow[];
      meta: { page: number; pageSize: number; total: number; totalPages: number };
    };

const TYPE_LABELS: Partial<Record<ExpenseType, string>> = {
  APERTURA: "Apertura",
  UNIFORMS: "Uniformes",
  AUDIT: "Auditoría",
  ADMIN: "Administrativo",
  TRANSPORT: "Transporte",
  FUEL: "Combustible",
  PHONES: "Teléfonos",
  PLANILLA: "Planilla",
  OTHER: "Otros",
};

function statusLabel(s: ExpenseApprovalStatus): string {
  switch (s) {
    case "PENDING_APPROVAL":
      return "Pendiente";
    case "PARTIALLY_APPROVED":
      return "Parcial";
    case "APPROVED":
      return "Aprobado";
    case "REJECTED":
      return "Rechazado";
    default:
      return s;
  }
}

function buildQuery(sp: URLSearchParams): string {
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export default function ApprovalBitacoraClient() {
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const [mode, setMode] = useState<BitacoraMode>("decisions");
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [company, setCompany] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [approverUserId, setApproverUserId] = useState<string>("all");
  const [decision, setDecision] = useState<string>("all");
  const [approvalStatus, setApprovalStatus] = useState<string>("all");

  const listUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("mode", mode);
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (qDebounced.trim()) sp.set("q", qDebounced.trim());
    if (company !== "all") sp.set("company", company);
    if (type !== "all") sp.set("type", type);
    if (mode === "decisions") {
      if (approverUserId !== "all") sp.set("approverUserId", approverUserId);
      if (decision !== "all") sp.set("decision", decision);
    } else {
      if (approvalStatus !== "all") sp.set("approvalStatus", approvalStatus);
    }
    return `/api/expenses/approval-bitacora${buildQuery(sp)}`;
  }, [mode, page, from, to, qDebounced, company, type, approverUserId, decision, approvalStatus]);

  const { data: approversRes } = useQuery({
    queryKey: ["approval-bitacora-approvers"],
    queryFn: async () => {
      const r = await fetch("/api/expenses/approval-bitacora?meta=approvers", { credentials: "same-origin" });
      const j = (await r.json()) as { data?: { approvers: ApproverOpt[] } };
      if (!r.ok) throw new Error("Error al cargar aprobadores");
      return j.data?.approvers ?? [];
    },
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["approval-bitacora", listUrl],
    queryFn: async () => {
      const r = await fetch(listUrl, { credentials: "same-origin" });
      const j = (await r.json()) as { data?: BitacoraResponse; error?: { message?: string } };
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar bitácora");
      return j.data as BitacoraResponse;
    },
  });

  function applySearch() {
    setQDebounced(q);
    setPage(1);
  }
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const decisionFilterCols: TableColumnFilterDef<DecisionRow>[] = [
    { key: "decidedAt", label: "Fecha decisión", getValue: (r) => r.decidedAt, headerClassName: "px-3 py-2.5" },
    { key: "stepOrder", label: "Paso", getValue: (r) => String(r.stepOrder), headerClassName: "px-3 py-2.5" },
    { key: "decision", label: "Decisión", getValue: (r) => r.decision, headerClassName: "px-3 py-2.5" },
    { key: "approver", label: "Aprobador", getValue: (r) => r.approver.name, headerClassName: "px-3 py-2.5" },
    { key: "sequentialNo", label: "N° gasto", getValue: (r) => String(r.expense.sequentialNo), headerClassName: "px-3 py-2.5" },
    { key: "description", label: "Descripción", getValue: (r) => r.expense.description, headerClassName: "px-3 py-2.5" },
    { key: "type", label: "Tipo", getValue: (r) => r.expense.type, headerClassName: "px-3 py-2.5" },
    { key: "company", label: "Empresa", getValue: (r) => r.expense.company ?? "", headerClassName: "px-3 py-2.5" },
    { key: "amount", label: "Monto", getValue: (r) => String(r.expense.amount), headerClassName: "px-3 py-2.5 text-right" },
    { key: "status", label: "Estado gasto", getValue: (r) => r.expense.approvalStatus, headerClassName: "px-3 py-2.5" },
    { key: "comment", label: "Comentario", getValue: (r) => r.comment ?? "", headerClassName: "px-3 py-2.5" },
  ];
  const submissionFilterCols: TableColumnFilterDef<SubmissionRow>[] = [
    { key: "submittedAt", label: "Enviado (registro)", getValue: (r) => r.submittedAt, headerClassName: "px-3 py-2.5" },
    { key: "submittedBy", label: "Registró", getValue: (r) => r.submittedBy.name, headerClassName: "px-3 py-2.5" },
    { key: "sequentialNo", label: "N° gasto", getValue: (r) => String(r.expense.sequentialNo), headerClassName: "px-3 py-2.5" },
    { key: "description", label: "Descripción", getValue: (r) => r.expense.description, headerClassName: "px-3 py-2.5" },
    { key: "type", label: "Tipo", getValue: (r) => r.expense.type, headerClassName: "px-3 py-2.5" },
    { key: "company", label: "Empresa", getValue: (r) => r.expense.company ?? "", headerClassName: "px-3 py-2.5" },
    { key: "amount", label: "Monto", getValue: (r) => String(r.expense.amount), headerClassName: "px-3 py-2.5 text-right" },
    { key: "steps", label: "Pasos", getValue: (r) => String(r.expense.requiredApprovalSteps), headerClassName: "px-3 py-2.5" },
    { key: "status", label: "Estado", getValue: (r) => r.expense.approvalStatus, headerClassName: "px-3 py-2.5" },
  ];
  const currentFilterCols = mode === "decisions" ? decisionFilterCols : submissionFilterCols;
  const displayedDecisions = data?.mode === "decisions" && (data.data ?? []).length > 0
    ? filterRowsByColumnFilters(data.data as DecisionRow[], columnFilters, decisionFilterCols)
    : [];
  const displayedSubmissions = data?.mode === "submissions" && (data.data ?? []).length > 0
    ? filterRowsByColumnFilters(data.data as SubmissionRow[], columnFilters, submissionFilterCols)
    : [];

  return (
    <>
      <Topbar title="Bitácora — aprobación de gastos" />
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 max-w-2xl">
            Consulte quién aprobó o rechazó cada paso, y cuándo. La pestaña «Envíos al flujo» lista los gastos que
            entraron en aprobación (fecha de registro = envío inicial).
          </p>
          <Button variant="outline" asChild>
            <Link href="/expenses">Volver a Gastos</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/50/80 p-1 w-fit">
              <button
                type="button"
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  mode === "decisions" ? "bg-card shadow text-slate-900" : "text-slate-600"
                }`}
                onClick={() => {
                  setMode("decisions");
                  setPage(1);
                }}
              >
                Decisiones (pasos)
              </button>
              <button
                type="button"
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  mode === "submissions" ? "bg-card shadow text-slate-900" : "text-slate-600"
                }`}
                onClick={() => {
                  setMode("submissions");
                  setPage(1);
                }}
              >
                Envíos al flujo
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Desde</label>
                <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Hasta</label>
                <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-600">Buscar (descripción, ref., N°)</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Texto o número consecutivo…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={applySearch}>
                    Buscar
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Empresa (gasto)</label>
                <Select value={company} onValueChange={(v) => { setCompany(v); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas (ámbito)</SelectItem>
                    {companyRows.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Tipo de gasto</label>
                <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(Object.keys(TYPE_LABELS) as ExpenseType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode === "decisions" ? (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Aprobador</label>
                    <Select value={approverUserId} onValueChange={(v) => { setApproverUserId(v); setPage(1); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {(approversRes ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Decisión</label>
                    <Select value={decision} onValueChange={(v) => { setDecision(v); setPage(1); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="APPROVED">Aprobó</SelectItem>
                        <SelectItem value="REJECTED">Rechazó</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Estado actual</label>
                  <Select value={approvalStatus} onValueChange={(v) => { setApprovalStatus(v); setPage(1); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="PENDING_APPROVAL">Pendiente</SelectItem>
                      <SelectItem value="PARTIALLY_APPROVED">Parcial</SelectItem>
                      <SelectItem value="APPROVED">Aprobado</SelectItem>
                      <SelectItem value="REJECTED">Rechazado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {isError && (
              <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Error"}</p>
            )}

            {isLoading ? (
              <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
            ) : data?.mode === "decisions" ? (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <table data-table-id="gastos-approval-bitacora-decisiones" className="w-full text-sm">
                    <thead>
                      <TableColumnFilterHead
                        tableId="gastos-approval-bitacora-decisiones"
                        defaultColumnWidths={{
                          decidedAt: 120,
                          stepOrder: 80,
                          decision: 110,
                          approver: 180,
                          sequentialNo: 110,
                          description: 220,
                          type: 120,
                          company: 140,
                          amount: 110,
                          status: 120,
                          comment: 180,
                        }}
                        columns={decisionFilterCols}
                        rows={data?.data ?? []}
                        filters={columnFilters}
                        onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                        headerRowClassName="border-b bg-muted/50 text-left text-xs font-semibold text-slate-600"
                      />
                    </thead>
                    <tbody className="divide-y">
                      {displayedDecisions.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                            Sin registros con los filtros actuales
                          </td>
                        </tr>
                      ) : (
                        displayedDecisions.map((row: DecisionRow) => (
                          <tr key={row.id} className="hover:bg-muted/50/80">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {new Date(row.decidedAt).toLocaleString("es-CR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-3 py-2">{row.stepOrder}</td>
                            <td className="px-3 py-2">
                              <Badge variant={row.decision === "APPROVED" ? "default" : "destructive"}>
                                {row.decision === "APPROVED" ? "Aprobó" : "Rechazó"}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">{row.approver.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.expense.sequentialNo}</td>
                            <td className="px-3 py-2 max-w-[220px] truncate">{row.expense.description}</td>
                            <td className="px-3 py-2 text-xs">{TYPE_LABELS[row.expense.type] ?? row.expense.type}</td>
                            <td className="px-3 py-2 text-xs">
                              {row.expense.company
                                ? companyDisplayName(row.expense.company, companyRows)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(row.expense.amount)}
                            </td>
                            <td className="px-3 py-2 text-xs">{statusLabel(row.expense.approvalStatus)}</td>
                            <td className="px-3 py-2 max-w-[180px] truncate text-xs text-slate-600">
                              {row.comment ?? "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={data.meta.page}
                  totalPages={data.meta.totalPages}
                  total={data.meta.total}
                  onPage={setPage}
                />
              </>
            ) : data?.mode === "submissions" ? (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <table data-table-id="gastos-approval-bitacora-envios" className="w-full text-sm">
                    <thead>
                      <TableColumnFilterHead
                        tableId="gastos-approval-bitacora-envios"
                        defaultColumnWidths={{
                          submittedAt: 130,
                          submittedBy: 160,
                          sequentialNo: 110,
                          description: 220,
                          type: 120,
                          company: 140,
                          amount: 110,
                          steps: 80,
                          status: 110,
                        }}
                        columns={submissionFilterCols}
                        rows={data?.data ?? []}
                        filters={columnFilters}
                        onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                        headerRowClassName="border-b bg-muted/50 text-left text-xs font-semibold text-slate-600"
                      />
                    </thead>
                    <tbody className="divide-y">
                      {displayedSubmissions.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                            Sin registros con los filtros actuales
                          </td>
                        </tr>
                      ) : (
                        displayedSubmissions.map((row: SubmissionRow) => (
                          <tr key={row.id} className="hover:bg-muted/50/80">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {new Date(row.submittedAt).toLocaleString("es-CR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </td>
                            <td className="px-3 py-2">{row.submittedBy.name}</td>
                            <td className="px-3 py-2 font-mono text-xs">{row.expense.sequentialNo}</td>
                            <td className="px-3 py-2 max-w-[240px] truncate">{row.expense.description}</td>
                            <td className="px-3 py-2 text-xs">{TYPE_LABELS[row.expense.type] ?? row.expense.type}</td>
                            <td className="px-3 py-2 text-xs">
                              {row.expense.company
                                ? companyDisplayName(row.expense.company, companyRows)
                                : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatCurrency(row.expense.amount)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {row.expense.requiredApprovalSteps} paso(s)
                              {row.expense.currentApprovalStep != null
                                ? ` · actual: ${row.expense.currentApprovalStep}`
                                : ""}
                            </td>
                            <td className="px-3 py-2 text-xs">{statusLabel(row.expense.approvalStatus)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationBar
                  page={data.meta.page}
                  totalPages={data.meta.totalPages}
                  total={data.meta.total}
                  onPage={setPage}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PaginationBar({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        Total: {total} · Página {page} de {Math.max(1, totalPages)}
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
