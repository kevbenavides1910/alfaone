"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/auth/client-session";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils/format";
import { companyDisplayName, EXPENSE_BUDGET_LINES, EXPENSE_BUDGET_LINE_LABELS } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  DeferredContractSelector,
  type DeferredContractDraft,
} from "@/components/expenses/DeferredContractSelector";
import { canManageExpenses as userCanManageExpenses } from "@/modules/core/permissions";
import type { ExpenseBudgetLine, ExpenseType, PaymentSource } from "@prisma/client";
import {
  paymentCategoryLabel,
  paymentSubcategoryLabel,
} from "@/modules/pagos/catalog/payment-categories";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  type Contract,
  EXPENSE_TYPES,
  currentMonth,
  isAssignableContractForExpense,
  filterAssignableContractsByQuery,
} from "../expenses-types";

type PendingPayment = {
  id: string;
  source: PaymentSource;
  description: string;
  amount: number;
  paymentDate: string;
  company: string | null;
  referenceNumber: string | null;
  category: string | null;
  subcategory: string | null;
  notes: string | null;
  paidAt: string | null;
};

type PendingRow = PendingPayment & {
  companyLabel: string;
  sourceLabel: string;
  categoryLabel: string;
  subcategoryLabel: string;
};

const SOURCE_LABEL: Record<PaymentSource, string> = {
  EXPENSE: "Gasto",
  APEX: "APEX",
  MANUAL: "Manual",
};

const TABLE_ID = "gastos-pendientes-asignar";

/** Etiqueta de mes YYYY-MM sin desfase UTC (evita «sep → ago» en CR). */
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString("es-CR", {
    month: "long",
    year: "numeric",
  });
}

function monthOptions(): [string, string][] {
  const start = new Date();
  start.setMonth(start.getMonth() - 18);
  const out: [string, string][] = [];
  for (let i = 0; i < 36; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push([val, monthLabel(val)]);
  }
  return out;
}

function shiftMonthValue(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PendientesAsignarClient() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canEdit = userCanManageExpenses(session ?? null);
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];
  const activeCompanies = companyRows.filter((c) => c.isActive);

  const [month, setMonth] = useState(currentMonth());
  const monthChoices = useMemo(() => {
    const opts = monthOptions();
    if (!opts.some(([v]) => v === month)) {
      return [[month, monthLabel(month)] as [string, string], ...opts];
    }
    return opts;
  }, [month]);
  const [filterCompany, setFilterCompany] = useState("all");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [month, filterCompany]);

  /** Uno o varios pagos a asignar con la misma clasificación. */
  const [assignTargets, setAssignTargets] = useState<PendingPayment[]>([]);
  const assignTarget = assignTargets[0] ?? null;
  const isBulkAssign = assignTargets.length > 1;
  const [form, setForm] = useState({
    type: "OTHER" as ExpenseType,
    budgetLine: "" as ExpenseBudgetLine | "",
    description: "",
    periodMonth: currentMonth(),
    company: "",
    notes: "",
    mode: "deferred" as "contract" | "deferred" | "deferred_custom",
    contractId: "",
    spreadMonths: 1,
  });
  const [createDeferredDraft, setCreateDeferredDraft] = useState<DeferredContractDraft>("all");
  const [customDeferredRows, setCustomDeferredRows] = useState<
    Array<{ contractId: string; amount: string; contractQuery: string }>
  >([{ contractId: "", amount: "", contractQuery: "" }]);
  const [customDeferredFocusIdx, setCustomDeferredFocusIdx] = useState<number | null>(null);
  const [contractSearch, setContractSearch] = useState("");
  const [contractFocused, setContractFocused] = useState(false);

  const listUrl = useMemo(() => {
    const sp = new URLSearchParams({ month });
    if (filterCompany !== "all") sp.set("company", filterCompany);
    return `/api/expenses/pendientes-asignar?${sp.toString()}`;
  }, [month, filterCompany]);

  const { data, isLoading, isError, error, refetch } = useQuery<{ data: PendingPayment[] }>({
    queryKey: ["pendientes-asignar", listUrl],
    queryFn: async () => {
      const res = await fetch(listUrl, { credentials: "same-origin" });
      const json = (await res.json()) as { data?: PendingPayment[]; error?: { message?: string } };
      if (!res.ok) throw new Error(json?.error?.message ?? `Error (${res.status})`);
      return json as { data: PendingPayment[] };
    },
  });

  const rows = data?.data ?? [];

  const { data: contractsData } = useQuery<{ data: Contract[] }>({
    queryKey: ["contracts-assignable"],
    queryFn: () =>
      fetch("/api/contracts?pageSize=500&assignable=true", { credentials: "same-origin" }).then((r) =>
        r.json()
      ),
    staleTime: 60_000,
    enabled: assignTargets.length > 0,
  });

  const allContracts = contractsData?.data ?? [];
  const deferredAssignableContracts = useMemo(
    () => allContracts.filter(isAssignableContractForExpense),
    [allContracts]
  );
  const deferredAssignableIds = useMemo(
    () => deferredAssignableContracts.map((c) => c.id),
    [deferredAssignableContracts]
  );

  const debouncedContractSearch = useDebouncedValue(contractSearch, 300);
  const remoteContractQuery = debouncedContractSearch.trim();
  const { data: contractRemoteSearch, isFetching: contractRemoteSearchLoading } = useQuery<{
    data: Contract[];
  }>({
    queryKey: ["contracts-assignable-search", remoteContractQuery],
    queryFn: () =>
      fetch(
        `/api/contracts?assignable=true&search=${encodeURIComponent(remoteContractQuery)}&pageSize=100`,
        { credentials: "same-origin" }
      ).then((r) => r.json()),
    enabled: assignTargets.length > 0 && form.mode === "contract" && remoteContractQuery.length >= 2,
    staleTime: 60_000,
  });

  const focusedDeferredQuery =
    form.mode === "deferred_custom" && customDeferredFocusIdx !== null
      ? customDeferredRows[customDeferredFocusIdx]?.contractQuery ?? ""
      : "";
  const debouncedDeferredRowSearch = useDebouncedValue(focusedDeferredQuery, 300);
  const remoteDeferredQuery = debouncedDeferredRowSearch.trim();
  const { data: deferredRowRemoteSearch } = useQuery<{ data: Contract[] }>({
    queryKey: ["contracts-assignable-search", "deferred-row", remoteDeferredQuery],
    queryFn: () =>
      fetch(
        `/api/contracts?assignable=true&search=${encodeURIComponent(remoteDeferredQuery)}&pageSize=100`,
        { credentials: "same-origin" }
      ).then((r) => r.json()),
    enabled:
      assignTargets.length > 0 && form.mode === "deferred_custom" && remoteDeferredQuery.length >= 2,
    staleTime: 60_000,
  });

  const filteredContracts = useMemo(() => {
    if (remoteContractQuery.length >= 2 && Array.isArray(contractRemoteSearch?.data)) {
      return contractRemoteSearch!.data!.slice(0, 20);
    }
    return filterAssignableContractsByQuery(allContracts, contractSearch, 20);
  }, [allContracts, contractSearch, contractRemoteSearch, remoteContractQuery]);

  const customDeferredSum = useMemo(
    () =>
      customDeferredRows.reduce((s, r) => {
        const a = parseFloat(r.amount);
        return s + (Number.isFinite(a) ? a : 0);
      }, 0),
    [customDeferredRows]
  );
  const customDeferredTotalTarget = assignTarget?.amount ?? 0;
  const bulkTotalAmount = useMemo(
    () => assignTargets.reduce((s, p) => s + p.amount, 0),
    [assignTargets]
  );

  const enrichedRows: PendingRow[] = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        companyLabel: r.company ? companyDisplayName(r.company, companyRows) : "—",
        sourceLabel: SOURCE_LABEL[r.source] ?? r.source,
        categoryLabel: paymentCategoryLabel(r.category) ?? "Sin clasificar",
        subcategoryLabel:
          paymentSubcategoryLabel(r.category, r.subcategory) ??
          (r.subcategory?.trim() || "Sin subcategoría"),
      })),
    [rows, companyRows]
  );

  const filterCols: TableColumnFilterDef<PendingRow>[] = useMemo(
    () => [
      {
        key: "select",
        label: "Sel.",
        getValue: () => "",
        headerClassName: "text-center px-2 py-2 font-semibold text-slate-600 w-10",
        filterable: false,
      },
      {
        key: "paymentDate",
        label: "Fecha",
        getValue: (r) => r.paymentDate,
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "description",
        label: "Descripción",
        getValue: (r) => r.description,
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "amount",
        label: "Monto",
        getValue: (r) => String(r.amount),
        headerClassName: "text-right px-3 py-2 font-semibold text-slate-600",
        align: "right",
      },
      {
        key: "company",
        label: "Empresa",
        getValue: (r) => r.companyLabel,
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "category",
        label: "Categoría",
        getValue: (r) => r.categoryLabel,
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "subcategory",
        label: "Subcategoría",
        getValue: (r) => r.subcategoryLabel,
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "source",
        label: "Origen",
        getValue: (r) => r.sourceLabel,
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "referenceNumber",
        label: "Referencia",
        getValue: (r) => r.referenceNumber ?? "",
        headerClassName: "text-left px-3 py-2 font-semibold text-slate-600",
      },
      {
        key: "actions",
        label: "Acción",
        getValue: () => "",
        headerClassName: "px-3 py-2 font-semibold text-slate-600",
        filterable: false,
      },
    ],
    []
  );

  const displayRows = useMemo(
    () => filterRowsByColumnFilters(enrichedRows, columnFilters, filterCols),
    [enrichedRows, columnFilters, filterCols]
  );

  const displayIds = useMemo(() => displayRows.map((r) => r.id), [displayRows]);
  const allVisibleSelected =
    displayIds.length > 0 && displayIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = displayIds.some((id) => selectedIds.includes(id));

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      const drop = new Set(displayIds);
      setSelectedIds((prev) => prev.filter((id) => !drop.has(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...displayIds])]);
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function openAssign(targets: PendingPayment | PendingPayment[]) {
    const list = Array.isArray(targets) ? targets : [targets];
    if (list.length === 0) return;
    const first = list[0]!;
    setAssignTargets(list);
    setForm({
      type: "OTHER",
      budgetLine: "",
      description: list.length === 1 ? first.description : "",
      periodMonth: first.paymentDate.slice(0, 7),
      company: first.company || "",
      notes: "",
      mode: "deferred",
      contractId: "",
      spreadMonths: 1,
    });
    setCreateDeferredDraft("all");
    setCustomDeferredRows([{ contractId: "", amount: "", contractQuery: "" }]);
    setContractSearch("");
  }

  function openAssignSelected() {
    const selected = displayRows.filter((r) => selectedIds.includes(r.id));
    if (selected.length === 0) {
      toast.error("Seleccione al menos un pago");
      return;
    }
    openAssign(selected);
  }

  const assignMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/expenses/pendientes-asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.message ?? `Error (${res.status})`);
      }
      return json;
    },
    onSuccess: (json) => {
      const data = json?.data ?? json;
      if (typeof data?.assigned === "number") {
        const failed = Array.isArray(data.failed) ? data.failed.length : 0;
        if (failed > 0) {
          toast.success(`Asignados ${data.assigned}; ${failed} con error`);
        } else {
          toast.success(`Se asignaron ${data.assigned} pagos`);
        }
      } else {
        const count = data?.count ?? 1;
        toast.success(count > 1 ? `Se crearon ${count} gastos` : "Gasto creado y pago asignado");
      }
      setAssignTargets([]);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["pendientes-asignar"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleAssignSubmit() {
    if (assignTargets.length === 0) return;
    if (!form.budgetLine) {
      toast.error("Seleccione la partida");
      return;
    }
    if (!form.company) {
      toast.error("Seleccione la empresa");
      return;
    }
    if (!isBulkAssign && !form.description.trim()) {
      toast.error("Ingrese una descripción");
      return;
    }
    if (form.mode === "contract" && !form.contractId) {
      toast.error("Seleccione un contrato");
      return;
    }

    const spreadMonths =
      form.mode === "contract"
        ? Math.min(60, Math.max(1, Math.floor(Number(form.spreadMonths)) || 1))
        : 1;

    if (form.mode === "deferred") {
      if (createDeferredDraft !== "all" && createDeferredDraft.length === 0) {
        toast.error("Seleccione al menos un contrato para el reparto");
        return;
      }
    }

    let deferredManualAllocations: { contractId: string; amount: number }[] | undefined;
    if (form.mode === "deferred_custom") {
      if (isBulkAssign) {
        toast.error(
          "En lote use diferido proporcional o contrato; el personalizado se escala solo si es un pago"
        );
        return;
      }
      const total = assignTarget!.amount;
      const allocations: { contractId: string; amount: number }[] = [];
      for (const row of customDeferredRows) {
        if (!row.contractId) {
          toast.error("Seleccione el contrato en cada fila del reparto personalizado");
          return;
        }
        const a = parseFloat(row.amount);
        if (!Number.isFinite(a) || a <= 0) {
          toast.error("Cada monto asignado debe ser mayor que cero");
          return;
        }
        allocations.push({ contractId: row.contractId, amount: a });
      }
      if (allocations.length === 0) {
        toast.error("Agregue al menos un contrato con su monto");
        return;
      }
      const seen = new Set<string>();
      for (const a of allocations) {
        if (seen.has(a.contractId)) {
          toast.error("No repita el mismo contrato");
          return;
        }
        seen.add(a.contractId);
      }
      const sum = allocations.reduce((s, r) => s + r.amount, 0);
      if (Math.abs(sum - total) > 0.02) {
        toast.error(
          `La suma (${sum.toLocaleString("es-CR", { maximumFractionDigits: 2 })}) debe igualar el monto del pago (${total.toLocaleString("es-CR", { maximumFractionDigits: 2 })})`
        );
        return;
      }
      deferredManualAllocations = allocations;
    }

    const first = assignTargets[0]!;
    assignMutation.mutate({
      ...(assignTargets.length === 1
        ? { paymentId: first.id }
        : { paymentIds: assignTargets.map((p) => p.id) }),
      type: form.type,
      budgetLine: form.budgetLine,
      company: form.company,
      description: isBulkAssign
        ? first.description || "Asignación en lote"
        : form.description.trim(),
      amount: first.amount,
      periodMonth: form.periodMonth,
      paymentDate: first.paymentDate,
      contractId: form.mode === "contract" ? form.contractId : undefined,
      isDeferred: form.mode === "deferred" || form.mode === "deferred_custom",
      notes: form.notes.trim() || undefined,
      spreadMonths,
      ...(form.mode === "deferred"
        ? {
            deferredIncludeContractIds:
              createDeferredDraft === "all" ? [] : createDeferredDraft,
          }
        : {}),
      ...(deferredManualAllocations ? { deferredManualAllocations } : {}),
    });
  }

  function exportExcel() {
    exportRowsToExcel({
      filename: `pendientes-asignar-${month}`,
      sheetName: "Pendientes",
      rows: displayRows.map((r) => ({
        Fecha: r.paymentDate,
        Descripción: r.description,
        Monto: r.amount,
        Empresa: r.companyLabel,
        Categoría: r.categoryLabel,
        Subcategoría: r.subcategoryLabel,
        Origen: r.sourceLabel,
        Referencia: r.referenceNumber ?? "",
      })),
      columnWidths: [12, 40, 14, 18, 18, 20, 12, 18],
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Topbar title="Pendientes de asignar" />

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Mes (pagos)</label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Mes anterior"
                  onClick={() => setMonth((m) => shiftMonthValue(m, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-9 min-w-[180px] rounded-md border border-input bg-background px-2 text-sm font-medium"
                >
                  {monthChoices.map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Mes siguiente"
                  onClick={() => setMonth((m) => shiftMonthValue(m, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Empresa</label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {activeCompanies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {companyDisplayName(c.code, companyRows)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Actualizar
            </Button>
            {canEdit && selectedIds.length > 0 && (
              <Button type="button" size="sm" onClick={openAssignSelected}>
                Asignar seleccionados ({selectedIds.length})
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={exportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Excel
            </Button>
            {hasActiveColumnFilters(columnFilters) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setColumnFilters(clearColumnFilters(filterCols.map((c) => c.key)))}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          <p className="text-sm text-slate-600">
            Pagos marcados <strong>Pagado</strong> en {monthLabel(month)} que aún no tienen
            gasto de presupuesto. Al asignar se crea el gasto (contrato o diferido) como en Gastos.
          </p>

          {isError && (
            <p className="text-sm text-red-600">{(error as Error)?.message ?? "Error al cargar"}</p>
          )}

          <div className="border rounded-md overflow-auto max-h-[calc(100vh-280px)]">
            <table data-table-id={TABLE_ID} className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                <TableColumnFilterHead
                  tableId={TABLE_ID}
                  columns={filterCols}
                  rows={enrichedRows}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                  headerRowClassName="border-b bg-muted/50"
                  defaultColumnWidths={{
                    select: 44,
                    paymentDate: 110,
                    description: 280,
                    amount: 120,
                    company: 140,
                    category: 140,
                    subcategory: 160,
                    source: 90,
                    referenceNumber: 140,
                    actions: 100,
                  }}
                />
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                      Cargando…
                    </td>
                  </tr>
                ) : displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                      No hay pagos pendientes de asignar en este mes
                    </td>
                  </tr>
                ) : (
                  displayRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-2 py-2 text-center">
                        {canEdit ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-red-600"
                            checked={selectedIds.includes(r.id)}
                            onChange={() => toggleSelectOne(r.id)}
                            aria-label={`Seleccionar ${r.description}`}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.paymentDate}</td>
                      <td className="px-3 py-2">
                        <span className="whitespace-nowrap" title={r.description}>
                          {r.description}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                        {formatCurrency(r.amount)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.companyLabel}</td>
                      <td className="px-3 py-2 whitespace-nowrap" title={r.categoryLabel}>
                        {r.categoryLabel}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" title={r.subcategoryLabel}>
                        {r.subcategoryLabel}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{r.sourceLabel}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap" title={r.referenceNumber ?? undefined}>
                        {r.referenceNumber || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {canEdit ? (
                          <Button type="button" size="sm" onClick={() => openAssign(r)}>
                            Asignar
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              {displayRows.length} registro(s)
              {selectedIds.length > 0 ? ` · ${selectedIds.length} seleccionado(s)` : ""}
            </p>
            {canEdit && displayRows.length > 0 && (
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-red-600"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  onChange={toggleSelectAllVisible}
                />
                Seleccionar visibles
              </label>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={assignTargets.length > 0}
        onOpenChange={(o) => !o && setAssignTargets([])}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isBulkAssign
                ? `Asignar ${assignTargets.length} pagos como gasto`
                : "Asignar pago como gasto"}
            </DialogTitle>
          </DialogHeader>

          {assignTarget && (
            <div className="space-y-4">
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm space-y-1">
                {isBulkAssign ? (
                  <>
                    <p>
                      <span className="text-slate-500">Pagos:</span>{" "}
                      <strong>{assignTargets.length}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Suma montos:</span>{" "}
                      <strong>{formatCurrency(bulkTotalAmount)}</strong>
                    </p>
                    <p className="text-xs text-slate-500">
                      Misma clasificación y distribución para todos. Cada pago conserva su descripción
                      y monto; el diferido personalizado no aplica en lote.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="text-slate-500">Monto del pago:</span>{" "}
                      <strong>{formatCurrency(assignTarget.amount)}</strong>
                    </p>
                    <p>
                      <span className="text-slate-500">Fecha pago:</span> {assignTarget.paymentDate} ·{" "}
                      <Badge variant="secondary">{SOURCE_LABEL[assignTarget.source]}</Badge>
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tipo *</label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm((f) => ({ ...f, type: v as ExpenseType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Partida *</label>
                  <Select
                    value={form.budgetLine || undefined}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, budgetLine: v as ExpenseBudgetLine }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_BUDGET_LINES.map((bl) => (
                        <SelectItem key={bl} value={bl}>
                          {EXPENSE_BUDGET_LINE_LABELS[bl]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Empresa *</label>
                  <Select
                    value={form.company || undefined}
                    onValueChange={(v) => setForm((f) => ({ ...f, company: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCompanies.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {companyDisplayName(c.code, companyRows)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Período presupuesto *</label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.periodMonth}
                    onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
                  >
                    {monthChoices.map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                    {!monthChoices.some(([v]) => v === form.periodMonth) && form.periodMonth && (
                      <option value={form.periodMonth}>{monthLabel(form.periodMonth)}</option>
                    )}
                  </select>
                </div>
              </div>

              {!isBulkAssign ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descripción *</label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Cada pago conserva su propia descripción del calendario.
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Asignar a</label>
                <div
                  className={`grid grid-cols-1 gap-1 rounded-md border border-slate-200 p-1 bg-muted/50 ${
                    isBulkAssign ? "sm:grid-cols-2" : "sm:grid-cols-3"
                  }`}
                >
                  {(
                    [
                      { mode: "contract" as const, label: "Contrato específico" },
                      { mode: "deferred" as const, label: "Diferido proporcional" },
                      ...(isBulkAssign
                        ? []
                        : [{ mode: "deferred_custom" as const, label: "Diferido personalizado" }]),
                    ]
                  ).map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded py-2.5 px-1 text-xs sm:text-sm font-medium transition-colors ${
                        form.mode === mode
                          ? "bg-red-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-card"
                      }`}
                      onClick={() => {
                        setCreateDeferredDraft("all");
                        setCustomDeferredRows([{ contractId: "", amount: "", contractQuery: "" }]);
                        setForm((f) => ({
                          ...f,
                          mode,
                          contractId: mode === "contract" ? f.contractId : "",
                          spreadMonths: 1,
                        }));
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.mode === "contract" && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Contrato *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        className={`pl-9 ${form.contractId ? "border-green-400 bg-green-50" : ""}`}
                        placeholder="Buscar por licitación, cliente…"
                        value={contractSearch}
                        onFocus={() => setContractFocused(true)}
                        onBlur={() => setTimeout(() => setContractFocused(false), 150)}
                        onChange={(e) => {
                          setContractSearch(e.target.value);
                          setForm((f) => ({ ...f, contractId: "" }));
                        }}
                      />
                    </div>
                    {(contractFocused || (contractSearch && !form.contractId)) && (
                      <div className="border rounded-md max-h-48 overflow-y-auto divide-y shadow-sm">
                        {contractRemoteSearchLoading && remoteContractQuery.length >= 2 && (
                          <div className="p-2.5 text-xs text-slate-500">Buscando…</div>
                        )}
                        {filteredContracts.length === 0 ? (
                          <div className="p-3 text-sm text-slate-400">Sin resultados</div>
                        ) : (
                          filteredContracts.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-red-50 ${
                                form.contractId === c.id ? "bg-red-50 text-red-700" : ""
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setForm((f) => ({ ...f, contractId: c.id, company: c.company }));
                                setContractSearch(`${c.licitacionNo} — ${c.client}`);
                                setContractFocused(false);
                              }}
                            >
                              <div className="font-medium">{c.client}</div>
                              <div className="text-xs text-slate-400">
                                {c.licitacionNo} · {companyDisplayName(c.company, companyRows)}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Prorrateo en meses</label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={form.spreadMonths}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setForm((f) => ({
                          ...f,
                          spreadMonths: Number.isFinite(v) ? Math.min(60, Math.max(1, v)) : 1,
                        }));
                      }}
                    />
                    {form.spreadMonths > 1 && (
                      <p className="text-xs text-slate-500">
                        ≈ {formatCurrency(assignTarget.amount / form.spreadMonths)} por mes
                      </p>
                    )}
                  </div>
                </div>
              )}

              {form.mode === "deferred" && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                  <p className="font-medium">Gasto diferido proporcional</p>
                  <DeferredContractSelector
                    contracts={deferredAssignableContracts}
                    allIds={deferredAssignableIds}
                    draft={createDeferredDraft}
                    onChange={setCreateDeferredDraft}
                    companyRows={companyRows}
                  />
                </div>
              )}

              {form.mode === "deferred_custom" && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-sm space-y-3">
                  <p className="font-medium text-violet-900">Reparto manual por contrato</p>
                  {customDeferredTotalTarget > 0 && (
                    <p
                      className={`text-xs font-medium rounded border px-2 py-1.5 ${
                        Math.abs(customDeferredSum - customDeferredTotalTarget) <= 0.02
                          ? "border-green-300 bg-green-50 text-green-900"
                          : "border-amber-300 bg-amber-50 text-amber-900"
                      }`}
                    >
                      Suma: {formatCurrency(customDeferredSum)} · Pago:{" "}
                      {formatCurrency(customDeferredTotalTarget)}
                    </p>
                  )}
                  <div className="space-y-3">
                    {customDeferredRows.map((row, idx) => {
                      const rowPickOpen =
                        customDeferredFocusIdx === idx ||
                        (Boolean(row.contractQuery) && !row.contractId);
                      const rowPickQuery = row.contractQuery.trim();
                      const useRemoteRow =
                        rowPickQuery.length >= 2 &&
                        customDeferredFocusIdx === idx &&
                        Array.isArray(deferredRowRemoteSearch?.data) &&
                        debouncedDeferredRowSearch.trim() === rowPickQuery;
                      const rowFiltered = useRemoteRow
                        ? deferredRowRemoteSearch!.data!.slice(0, 50)
                        : filterAssignableContractsByQuery(
                            deferredAssignableContracts,
                            row.contractQuery
                          );
                      return (
                        <div
                          key={idx}
                          className="rounded-md border border-violet-100/80 bg-card/90 p-2 space-y-1.5"
                        >
                          <div className="flex flex-wrap items-end gap-2">
                            <div className="flex-1 min-w-[200px] space-y-1">
                              <span className="text-xs font-medium text-slate-600">Contrato</span>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                  className={`pl-9 h-9 ${row.contractId ? "border-green-400 bg-green-50/60" : ""}`}
                                  placeholder="Buscar…"
                                  value={row.contractQuery}
                                  onFocus={() => setCustomDeferredFocusIdx(idx)}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setCustomDeferredFocusIdx((cur) => (cur === idx ? null : cur));
                                    }, 150);
                                  }}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setCustomDeferredRows((rows) =>
                                      rows.map((r, i) =>
                                        i === idx ? { ...r, contractQuery: v, contractId: "" } : r
                                      )
                                    );
                                  }}
                                />
                              </div>
                              {rowPickOpen && (
                                <div className="border rounded-md max-h-40 overflow-y-auto divide-y bg-card">
                                  {rowFiltered.length === 0 ? (
                                    <div className="p-2.5 text-xs text-slate-400">Sin resultados</div>
                                  ) : (
                                    rowFiltered.map((c) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className="w-full text-left px-2.5 py-2 text-sm hover:bg-violet-50"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          setCustomDeferredRows((rows) =>
                                            rows.map((r, i) =>
                                              i === idx
                                                ? {
                                                    ...r,
                                                    contractId: c.id,
                                                    contractQuery: `${c.licitacionNo} — ${c.client}`,
                                                  }
                                                : r
                                            )
                                          );
                                          setCustomDeferredFocusIdx(null);
                                        }}
                                      >
                                        <div className="font-medium">{c.client}</div>
                                        <div className="text-xs text-slate-400">{c.licitacionNo}</div>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="w-[120px] space-y-1">
                              <span className="text-xs font-medium text-slate-600">Monto</span>
                              <Input
                                className="h-9"
                                type="number"
                                step="0.01"
                                value={row.amount}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setCustomDeferredRows((rows) =>
                                    rows.map((r, i) => (i === idx ? { ...r, amount: v } : r))
                                  );
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={customDeferredRows.length <= 1}
                              onClick={() =>
                                setCustomDeferredRows((rows) => rows.filter((_, i) => i !== idx))
                              }
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCustomDeferredRows((rows) => [
                        ...rows,
                        { contractId: "", amount: "", contractQuery: "" },
                      ])
                    }
                  >
                    + Contrato
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notas</label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignTargets([])}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAssignSubmit}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending
                ? "Asignando…"
                : isBulkAssign
                  ? `Crear ${assignTargets.length} gastos`
                  : "Crear gasto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
