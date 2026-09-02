"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth/client-session";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Eye, Search, Receipt, Pencil, Upload, Download, Paperclip, X } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatMonthYear, calendarDateInputValue } from "@/lib/utils/format";
import { companyDisplayName, EXPENSE_BUDGET_LINES, EXPENSE_BUDGET_LINE_LABELS } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import {
  DeferredContractSelector,
  draftFromServer,
  type DeferredContractDraft,
  type DeferredSelectorContract,
} from "@/components/expenses/DeferredContractSelector";
import { AttachmentPreviewDialog } from "@/components/expenses/AttachmentPreviewDialog";
import { ExpenseEditDialog } from "@/components/expenses/ExpenseEditDialog";
import { ExpenseOcPicker } from "@/components/expenses/ExpenseOcPicker";
import { ExpensePreviewDialog } from "@/components/expenses/ExpensePreviewDialog";
import { canManageExpenses as userCanManageExpenses } from "@/modules/core/permissions";
import type { ExpenseBudgetLine, ExpenseType } from "@prisma/client";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  type Contract, type Distribution, type ExpenseOrigin, type ExpenseDetailDto,
  type PreviewableAttachment, type Expense, type ExpenseDistributionFilter,
  EXPENSE_TYPES, PRORRATEO_DESC_RE, DEFAULT_EXPENSE_LIST_URL, ATTACH_ACCEPT,
  isAssignableContractForExpense, filterAssignableContractsByQuery,
  isPdf, isImage, isPreviewable, expenseDistributionKind,
  typeInfo, budgetLineLabel, formatSequentialNo, currentMonth, uploadExpenseAttachments,
} from "./expenses-types";




function approvalBadge(e: Expense) {
  const st = e.approvalStatus ?? "APPROVED";
  const req = e.requiredApprovalSteps ?? 0;
  if (req <= 0 || st === "APPROVED") {
    return <Badge variant="success">Compra confirmada</Badge>;
  }
  if (st === "REJECTED") return <Badge variant="destructive">Rechazado</Badge>;
  if (st === "PENDING_APPROVAL") {
    return (
      <Badge variant="warning">
        Pendiente ({e.currentApprovalStep ?? 1}/{req})
      </Badge>
    );
  }
  if (st === "PARTIALLY_APPROVED") {
    return (
      <Badge variant="warning">
        En aprobación ({e.currentApprovalStep ?? "—"}/{req})
      </Badge>
    );
  }
  return <Badge variant="secondary">{st}</Badge>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExpensesPageClient({ initialExpenses }: { initialExpenses: Expense[] }) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const canEdit = userCanManageExpenses(session ?? null);
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];
  const activeCompanies = companyRows.filter((c) => c.isActive);
  const expenseFileRef = useRef<HTMLInputElement>(null);
  const addExpenseAttachRef = useRef<HTMLInputElement>(null);
  const [expenseImporting, setExpenseImporting] = useState(false);
  /** Archivos a subir después de crear el gasto (modal Agregar) */
  const [addExpenseFiles, setAddExpenseFiles] = useState<File[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDistribution, setFilterDistribution] = useState<ExpenseDistributionFilter>("all");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [previewExpense, setPreviewExpense] = useState<Expense | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewableAttachment | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({
    type: "OTHER" as ExpenseType,
    budgetLine: "LABOR" as ExpenseBudgetLine,
    periodMonth: currentMonth(),
    paymentDate: "",
    company: "",
    description: "",
    originId: "",
    referenceNumber: "",
    notes: "",
    registroCxp: "",
    registroTr: "",
  });

  // Form state
  const [form, setForm] = useState({
    type: "OTHER" as ExpenseType,
    budgetLine: "" as ExpenseBudgetLine | "",
    description: "",
    amount: "",
    periodMonth: currentMonth(),
    paymentDate: "",
    mode: "contract" as "contract" | "deferred" | "deferred_custom",
    contractId: "",
    positionId: "",
    originId: "",
    referenceNumber: "",
    company: "",
    notes: "",
    registroCxp: "",
    registroTr: "",
    /** Prorrateo del monto en N meses (solo contrato específico) */
    spreadMonths: 1,
  });
  /** Reparto diferido al crear: "all" = todos los contratos activos; si no, solo los IDs listados. */
  const [createDeferredDraft, setCreateDeferredDraft] = useState<DeferredContractDraft>("all");
  /** Filas para diferido personalizado: búsqueda de contrato + monto (la suma debe igualar el monto del gasto). */
  const [customDeferredRows, setCustomDeferredRows] = useState<
    Array<{ contractId: string; amount: string; contractQuery: string }>
  >([{ contractId: "", amount: "", contractQuery: "" }]);
  /** Fila cuyo campo de contrato tiene foco (lista desplegable de búsqueda). */
  const [customDeferredFocusIdx, setCustomDeferredFocusIdx] = useState<number | null>(null);
  /** Borrador en el modal de detalle / reparto */
  const [distributionDraft, setDistributionDraft] = useState<DeferredContractDraft>("all");
  const [contractSearch, setContractSearch] = useState("");
  const [contractFocused, setContractFocused] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  // Nota: no usar el nombre `params` (reservado para props de Page en Next.js 15).
  const expenseListUrl = useMemo(() => {
    const sp = new URLSearchParams({ pageSize: "200" });
    if (filterType !== "all") sp.set("type", filterType);
    if (filterCompany !== "all") sp.set("company", filterCompany);
    if (filterStatus !== "all") sp.set("approvalStatus", filterStatus);
    return `/api/expenses?${sp.toString()}`;
  }, [filterType, filterCompany, filterStatus]);

  const { data, isLoading: expensesLoading, isError, error, refetch } = useQuery<{ data: Expense[] }>({
    queryKey: ["expenses", expenseListUrl],
    queryFn: async () => {
      const res = await fetch(expenseListUrl, { credentials: "same-origin" });
      const json = (await res.json()) as { data?: Expense[]; error?: { message?: string } };
      if (!res.ok) {
        throw new Error(json?.error?.message ?? `Error al cargar gastos (${res.status})`);
      }
      return json as { data: Expense[] };
    },
    initialData: expenseListUrl === DEFAULT_EXPENSE_LIST_URL ? { data: initialExpenses } : undefined,
  });

  const { data: contractsData } = useQuery<{ data: Contract[] }>({
    queryKey: ["contracts-assignable"],
    queryFn: () =>
      fetch("/api/contracts?pageSize=500&assignable=true", { credentials: "same-origin" }).then((r) =>
        r.json()
      ),
    staleTime: 60000,
  });

  const debouncedContractSearch = useDebouncedValue(contractSearch, 300);
  const remoteContractQuery = debouncedContractSearch.trim();
  const {
    data: contractRemoteSearch,
    isFetching: contractRemoteSearchLoading,
  } = useQuery<{ data: Contract[] }>({
    queryKey: ["contracts-assignable-search", remoteContractQuery],
    queryFn: () =>
      fetch(
        `/api/contracts?assignable=true&search=${encodeURIComponent(remoteContractQuery)}&pageSize=100`,
        { credentials: "same-origin" }
      ).then((r) => r.json()),
    enabled: showForm && form.mode === "contract" && remoteContractQuery.length >= 2,
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
    enabled: showForm && form.mode === "deferred_custom" && remoteDeferredQuery.length >= 2,
    staleTime: 60_000,
  });

  const { data: originsData } = useQuery<{ data: ExpenseOrigin[] }>({
    queryKey: ["expense-origins"],
    queryFn: () => fetch("/api/admin/catalogs/origins").then(r => r.json()),
    staleTime: 300000,
  });

  const { data: positionsData } = useQuery<{
    data: { id: string; name: string; label: string; locationName: string; shifts: { label: string | null; hours: number }[] }[];
  }>({
    queryKey: ["positions-for-expense", form.contractId],
    queryFn: () => fetch(`/api/contracts/${form.contractId}/positions`).then((r) => r.json()),
    enabled: form.mode === "contract" && !!form.contractId,
  });

  const { data: previewData, isLoading: previewLoading } = useQuery<{ data: Distribution[] }>({
    queryKey: ["expense-preview", previewExpense?.id, distributionDraft],
    queryFn: async () => {
      const id = previewExpense!.id;
      const sp = new URLSearchParams();
      if (distributionDraft !== "all" && distributionDraft.length > 0) {
        sp.set("contractIds", distributionDraft.join(","));
      }
      const q = sp.toString();
      const r = await fetch(`/api/expenses/${id}/distribute${q ? `?${q}` : ""}`, {
        credentials: "same-origin",
      });
      return r.json();
    },
    enabled:
      !!previewExpense &&
      previewExpense.isDeferred &&
      (previewExpense.approvalStatus ?? "APPROVED") !== "REJECTED",
  });

  const { data: previewDetail, refetch: refetchPreviewDetail } = useQuery({
    queryKey: ["expense-detail", previewExpense?.id],
    queryFn: async (): Promise<ExpenseDetailDto> => {
      const r = await fetch(`/api/expenses/${previewExpense!.id}`, { credentials: "same-origin" });
      const j = (await r.json()) as { data?: ExpenseDetailDto; error?: { message?: string } };
      if (!r.ok || !j.data) throw new Error(j.error?.message ?? "Error al cargar detalle");
      return j.data;
    },
    enabled: !!previewExpense,
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

  const customDeferredSum = useMemo(
    () => customDeferredRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    [customDeferredRows]
  );
  const customDeferredTotalTarget = useMemo(() => {
    const t = parseFloat(form.amount);
    return Number.isFinite(t) ? t : 0;
  }, [form.amount]);

  useEffect(() => {
    if (!previewExpense?.isDeferred || previewExpense.deferredManualDistribution) return;
    setDistributionDraft(draftFromServer(previewDetail?.deferredIncludeContractIds));
  }, [
    previewExpense?.id,
    previewExpense?.isDeferred,
    previewExpense?.deferredManualDistribution,
    previewDetail?.deferredIncludeContractIds,
  ]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload: { body: Record<string, unknown>; files: File[] }) => {
      const { body, files } = payload;
      const r = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "same-origin",
      });
      const json = (await r.json()) as {
        data?: { count?: number; expenses?: { id: string }[] };
        error?: { message?: string };
      };
      if (!r.ok) {
        throw new Error(json?.error?.message ?? "Error al crear gasto");
      }
      const ids = json.data?.expenses?.map((e) => e.id).filter(Boolean) ?? [];
      let uploadWarning: string | null = null;
      if (files.length > 0 && ids.length > 0) {
        try {
          await uploadExpenseAttachments(ids, files);
        } catch (e) {
          uploadWarning = e instanceof Error ? e.message : "Error al subir adjuntos";
        }
      }
      return {
        json,
        uploadWarning,
        createdCount: json.data?.count ?? Math.max(1, ids.length),
      };
    },
    onSuccess: (res) => {
      const count = res.createdCount;
      if (res.uploadWarning) {
        toast.error("Gasto guardado, pero hubo un problema con los archivos", res.uploadWarning, { durationMs: 12_000 });
      } else {
        toast.success(count > 1 ? `Se registraron ${count} cuotas mensuales` : "Gasto registrado");
      }
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["profitability"] });
      qc.invalidateQueries({ queryKey: ["traffic-light"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message || "Error al guardar"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error?.message ?? "Error al actualizar");
        return;
      }
      toast.success("Gasto actualizado");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["profitability"] });
      qc.invalidateQueries({ queryKey: ["traffic-light"] });
      qc.invalidateQueries({ queryKey: ["contract-expenses"] });
      setEditExpense(null);
    },
    onError: () => toast.error("Error al actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/expenses/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      toast.success("Gasto eliminado");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["profitability"] });
      qc.invalidateQueries({ queryKey: ["traffic-light"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const saveDeferredTargetsMutation = useMutation({
    mutationFn: async ({ id, contractIds }: { id: string; contractIds: string[] }) => {
      const r = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deferredIncludeContractIds: contractIds }),
        credentials: "same-origin",
      });
      const json = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) throw new Error(json.error?.message ?? "Error al guardar el reparto");
      return json;
    },
    onSuccess: () => {
      toast.success("Reparto actualizado");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-preview"] });
      qc.invalidateQueries({ queryKey: ["expense-detail"] });
      qc.invalidateQueries({ queryKey: ["profitability"] });
      qc.invalidateQueries({ queryKey: ["traffic-light"] });
      qc.invalidateQueries({ queryKey: ["contract-deferred-expenses"] });
    },
    onError: (e: Error) => toast.error(e.message || "Error al guardar"),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function resetForm() {
    setForm({
      type: "OTHER",
      budgetLine: "",
      description: "",
      amount: "",
      periodMonth: currentMonth(),
      paymentDate: "",
      mode: "contract",
      contractId: "",
      positionId: "",
      originId: "",
      referenceNumber: "",
      company: "",
      notes: "",
      registroCxp: "",
      registroTr: "",
      spreadMonths: 1,
    });
    setCreateDeferredDraft("all");
    setCustomDeferredRows([{ contractId: "", amount: "", contractQuery: "" }]);
    setContractSearch("");
    setAddExpenseFiles([]);
    if (addExpenseAttachRef.current) addExpenseAttachRef.current.value = "";
  }

  function openEdit(e: Expense) {
    setEditExpense(e);
    const dt = new Date(e.periodMonth);
    const periodMonth = Number.isNaN(dt.getTime())
      ? currentMonth()
      : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    setEditForm({
      type: e.type,
      budgetLine: e.budgetLine ?? "LABOR",
      periodMonth,
      paymentDate: calendarDateInputValue(e.paymentDate) || "",
      company: e.company ?? "",
      description: e.description,
      originId: e.originId ?? "",
      referenceNumber: e.referenceNumber ?? "",
      notes: e.notes ?? "",
      registroCxp: e.registroCxp ?? "",
      registroTr: e.registroTr ?? "",
    });
  }

  function handleSaveEdit() {
    if (!editExpense) return;
    if (!editForm.description.trim()) {
      toast.error("Ingrese una descripción");
      return;
    }
    updateMutation.mutate({
      id: editExpense.id,
      body: {
        type: editForm.type,
        budgetLine: editForm.budgetLine,
        periodMonth: editForm.periodMonth,
        paymentDate: editForm.paymentDate.trim() || null,
        company: editForm.company || null,
        description: editForm.description.trim(),
        originId: editForm.originId || null,
        referenceNumber: editForm.referenceNumber.trim() || null,
        notes: editForm.notes.trim() || null,
        registroCxp: editForm.registroCxp.trim() || null,
        registroTr: editForm.registroTr.trim() || null,
      },
    });
  }

  function handleSubmit() {
    if (!form.budgetLine) { toast.error("Seleccione la partida (mano de obra, insumos, administrativo o utilidad)"); return; }
    if (!form.company) { toast.error("Seleccione la empresa a la que pertenece el gasto"); return; }
    if (!form.description.trim()) { toast.error("Ingrese una descripción"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Ingrese un monto válido"); return; }
    if (form.mode === "contract" && !form.contractId) { toast.error("Seleccione un contrato"); return; }
    const spreadMonths =
      form.mode === "contract"
        ? Math.min(60, Math.max(1, Math.floor(Number(form.spreadMonths)) || 1))
        : 1;
    if (form.mode === "contract" && spreadMonths > 1) {
      const total = parseFloat(form.amount);
      if (!Number.isFinite(total) || total <= 0) {
        toast.error("Ingrese un monto válido para prorratear");
        return;
      }
    }
    if (form.mode === "deferred") {
      if (createDeferredDraft !== "all" && createDeferredDraft.length === 0) {
        toast.error("Seleccione al menos un contrato para el reparto");
        return;
      }
    }

    let deferredManualAllocations: { contractId: string; amount: number }[] | undefined;
    if (form.mode === "deferred_custom") {
      const total = parseFloat(form.amount);
      const allocations: { contractId: string; amount: number }[] = [];
      for (const row of customDeferredRows) {
        if (!row.contractId) {
          toast.error("Seleccione el contrato en cada fila del reparto personalizado");
          return;
        }
        const a = parseFloat(row.amount);
        if (!Number.isFinite(a) || a <= 0) {
          toast.error("Cada monto asignado debe ser un número mayor que cero");
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
          toast.error("No repita el mismo contrato en el reparto personalizado");
          return;
        }
        seen.add(a.contractId);
      }
      const sum = allocations.reduce((s, r) => s + r.amount, 0);
      if (Math.abs(sum - total) > 0.02) {
        toast.error(
          `La suma de los montos por contrato (${sum.toLocaleString("es-CR", { maximumFractionDigits: 2 })}) debe igualar el monto total (${total.toLocaleString("es-CR", { maximumFractionDigits: 2 })})`
        );
        return;
      }
      deferredManualAllocations = allocations;
    }

    createMutation.mutate({
      body: {
        type: form.type,
        budgetLine: form.budgetLine,
        company: form.company,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        periodMonth: form.periodMonth,
        paymentDate: form.paymentDate.trim() || undefined,
        contractId: form.mode === "contract" ? form.contractId : undefined,
        positionId: form.mode === "contract" && form.positionId ? form.positionId : undefined,
        originId: form.originId || undefined,
        referenceNumber: form.referenceNumber.trim() || undefined,
        isDeferred: form.mode === "deferred" || form.mode === "deferred_custom",
        notes: form.notes.trim() || undefined,
        registroCxp: form.registroCxp.trim() || undefined,
        registroTr: form.registroTr.trim() || undefined,
        spreadMonths,
        ...(form.mode === "deferred"
          ? {
              deferredIncludeContractIds:
                createDeferredDraft === "all" ? [] : createDeferredDraft,
            }
          : {}),
        ...(deferredManualAllocations ? { deferredManualAllocations } : {}),
      },
      files: addExpenseFiles,
    });
  }

  // ── Filtered contracts for search ──────────────────────────────────────────
  // Lista base assignable (hasta 500) + búsqueda en servidor si escribe ≥2 caracteres
  const filteredContracts = useMemo(() => {
    if (form.mode !== "contract") return [];
    const qDeb = remoteContractQuery;
    if (qDeb.length >= 2) {
      if (Array.isArray(contractRemoteSearch?.data)) {
        return contractRemoteSearch.data.slice(0, 50);
      }
      return filterAssignableContractsByQuery(allContracts, contractSearch, 20);
    }
    return filterAssignableContractsByQuery(allContracts, contractSearch, 20);
  }, [form.mode, allContracts, contractSearch, remoteContractQuery, contractRemoteSearch]);

  // ── Filtered expenses ──────────────────────────────────────────────────────
  const expenses = useMemo(() => {
    const raw = data?.data ?? [];
    const bySearch = raw.filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.contract?.client?.toLowerCase().includes(q) ||
        e.contract?.licitacionNo?.toLowerCase().includes(q)
      );
    });
    if (filterDistribution === "all") return bySearch;
    return bySearch.filter((e) => expenseDistributionKind(e) === filterDistribution);
  }, [data?.data, search, filterDistribution]);

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const onColumnFilterChange = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const expenseColumnDefs = useMemo((): TableColumnFilterDef<Expense>[] => {
    const typeOptions = EXPENSE_TYPES.map((t) => ({ value: t.label, label: t.label }));
    const approvalOptions = [
      { value: "Aprobado", label: "Aprobado" },
      { value: "Rechazado", label: "Rechazado" },
      { value: "Pendiente", label: "Pendiente" },
    ];
    return [
      {
        key: "sequentialNo",
        label: "N°",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => formatSequentialNo(e.sequentialNo),
      },
      {
        key: "type",
        label: "Tipo",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => typeInfo(e.type).label,
        options: typeOptions,
        mode: "select",
      },
      {
        key: "budgetLine",
        label: "Partida",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => budgetLineLabel(e.budgetLine),
      },
      {
        key: "company",
        label: "Empresa",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => (e.company ? companyDisplayName(e.company, companyRows) : ""),
      },
      {
        key: "description",
        label: "Descripción",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => e.description,
      },
      {
        key: "originRef",
        label: "Origen / Ref.",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) =>
          [e.origin?.name, e.referenceNumber].filter(Boolean).join(" · "),
      },
      {
        key: "contract",
        label: "Contrato / Empresa",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) =>
          e.isDeferred
            ? "Diferido"
            : e.contract
              ? `${e.contract.licitacionNo} · ${e.contract.client}`
              : e.company
                ? companyDisplayName(e.company, companyRows)
                : "",
      },
      {
        key: "period",
        label: "Período",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => formatMonthYear(e.periodMonth),
      },
      {
        key: "createdAt",
        label: "Registrado",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => e.createdAt.slice(0, 10),
      },
      {
        key: "amount",
        label: "Monto",
        align: "right",
        headerClassName: "text-right px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => formatCurrency(e.amount),
      },
      {
        key: "status",
        label: "Estado",
        headerClassName: "text-left px-4 py-3 font-semibold text-foreground/90",
        getValue: (e) => approvalStatusLabel(e),
        options: approvalOptions,
        mode: "select",
      },
      { key: "actions", label: "", filterable: false, headerClassName: "px-4 py-3", getValue: () => "" },
    ];
  }, [companyRows]);

  const displayedExpenses = useMemo(
    () =>
      filterRowsByColumnFilters(
        expenses,
        columnFilters,
        expenseColumnDefs.map((col) => ({
          key: col.key,
          getValue: col.getValue,
          mode: col.mode,
          filterable: col.filterable,
        }))
      ),
    [expenses, columnFilters, expenseColumnDefs]
  );

  const expenseColumnFilterKeys = useMemo(
    () => expenseColumnDefs.filter((c) => c.filterable !== false).map((c) => c.key),
    [expenseColumnDefs]
  );

  // ── Totals ─────────────────────────────────────────────────────────────────
  const total = displayedExpenses.reduce((s, e) => s + e.amount, 0);

  async function downloadExpenseTemplate() {
    const res = await fetch("/api/import/expenses", { credentials: "same-origin" });
    if (!res.ok) {
      toast.error("No se pudo descargar la plantilla");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plantilla_importar_gastos.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function approvalStatusLabel(e: Expense): string {
    const st = e.approvalStatus ?? "APPROVED";
    const req = e.requiredApprovalSteps ?? 0;
    if (req <= 0 || st === "APPROVED") return "Aprobado";
    if (st === "REJECTED") return "Rechazado";
    if (st === "PENDING_APPROVAL")
      return `Pendiente (${e.currentApprovalStep ?? 1}/${req})`;
    if (st === "PARTIALLY_APPROVED")
      return `Aprobado parcial (${e.currentApprovalStep ?? 0}/${req})`;
    return st;
  }

  function exportExpensesToExcel() {
    if (displayedExpenses.length === 0) {
      toast.info("No hay gastos para exportar");
      return;
    }

    const rows = displayedExpenses.map((e) => {
      const typeLabel = EXPENSE_TYPES.find((t) => t.value === e.type)?.label ?? e.type;
      const deferredScope =
        e.isDeferred
          ? e.deferredManualDistribution
            ? "Diferido (montos manuales)"
            : e.deferredIncludeContractIds && e.deferredIncludeContractIds.length > 0
              ? `Diferido proporcional (${e.deferredIncludeContractIds.length} contratos)`
              : "Diferido proporcional (todos)"
          : "Contrato específico";

      return {
        "N°": formatSequentialNo(e.sequentialNo),
        Tipo: typeLabel,
        Partida: budgetLineLabel(e.budgetLine ?? null),
        Empresa: e.company ? companyDisplayName(e.company, companyRows) : "",
        Descripción: e.description,
        "Origen / Ref.": [e.origin?.name, e.referenceNumber].filter(Boolean).join(" · "),
        Contrato: e.contract?.client ?? "",
        "N° Licitación": e.contract?.licitacionNo ?? "",
        "Empresa contrato": e.contract?.company
          ? companyDisplayName(e.contract.company, companyRows)
          : "",
        Puesto: e.position?.name ?? "",
        Ubicación: e.position?.location?.name ?? "",
        "Tipo reparto": deferredScope,
        Período: formatMonthYear(e.periodMonth),
        Monto: e.amount,
        "Registro CXP": e.registroCxp ?? "",
        "Registro TR": e.registroTr ?? "",
        Estado: approvalStatusLabel(e),
        Registrado: new Date(e.createdAt).toLocaleString("es-CR"),
        "Creado por": e.createdBy?.name ?? "",
        Notas: e.notes ?? "",
      };
    });

    const totalRow: Record<string, string | number> = {
      "N°": "",
      Tipo: "",
      Partida: "",
      Empresa: "",
      Descripción: "TOTAL",
      "Origen / Ref.": "",
      Contrato: "",
      "N° Licitación": "",
      "Empresa contrato": "",
      Puesto: "",
      Ubicación: "",
      "Tipo reparto": "",
      Período: "",
      Monto: total,
      "Registro CXP": "",
      "Registro TR": "",
      Estado: "",
      Registrado: "",
      "Creado por": "",
      Notas: "",
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const parts = ["gastos", stamp];
    if (filterType !== "all") {
      const lbl = EXPENSE_TYPES.find((t) => t.value === filterType)?.label ?? filterType;
      parts.push(lbl.toLowerCase().replace(/\s+/g, "-"));
    }
    if (filterCompany !== "all") {
      parts.push(filterCompany.toLowerCase());
    }
    exportRowsToExcel({
      filename: parts.join("_"),
      sheetName: "Gastos",
      rows,
      columnWidths: [9, 14, 14, 14, 36, 22, 28, 22, 18, 20, 20, 26, 12, 14, 16, 16, 22, 20, 22, 30],
      totalRow,
      appendDateToFilename: false,
    });
  }

  async function onExpenseFileSelected(f: File | null) {
    if (!f) return;
    setExpenseImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await fetch("/api/import/expenses", { method: "POST", body: fd, credentials: "same-origin" });
      const json = (await res.json()) as {
        data?: { created?: number; errors?: { sheetRow: number; message: string }[]; message?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Error al importar");
        return;
      }
      const d = json.data;
      const createdN = d?.created ?? 0;
      const errLines =
        d?.errors && d.errors.length > 0
          ? d.errors
              .slice(0, 100)
              .map((e) => `Fila ${e.sheetRow}: ${e.message}`)
              .join("\n") +
              (d.errors.length > 100 ? `\n… y ${d.errors.length - 100} más.` : "")
          : "";
      const errHint =
        errLines !== ""
          ? `\n\n— «Fila N» es el número de fila en su Excel (la fila 1 son los títulos).`
          : "";
      if (createdN > 0) {
        toast.success(
          d?.message ?? `Se registraron ${createdN} movimiento(s).`,
          errLines ? `${errLines}${errHint}` : undefined,
          errLines ? { durationMs: 90_000, copyable: true } : undefined
        );
      } else if (errLines) {
        toast.error("No se importaron gastos", `${errLines}${errHint}`, {
          durationMs: 90_000,
          copyable: true,
        });
      } else {
        toast.info("Importación", d?.message ?? "Sin filas nuevas.");
      }
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["profitability"] });
      qc.invalidateQueries({ queryKey: ["traffic-light"] });
    } finally {
      setExpenseImporting(false);
      if (expenseFileRef.current) expenseFileRef.current.value = "";
    }
  }

  return (
    <>
      <Topbar title="Registro de Gastos" />
      <div className="p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Gastos</h2>
            <p className="text-sm text-muted-foreground">
              {expensesLoading ? (
                "Cargando totales…"
              ) : (
                <>
                  {displayedExpenses.length} registros · Total: <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={exportExpensesToExcel}
              disabled={displayedExpenses.length === 0}
              title={
                displayedExpenses.length === 0
                  ? "No hay gastos para exportar"
                  : "Exportar a Excel los gastos visibles (aplicando filtros y búsqueda)"
              }
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            {canEdit && (
              <>
                <input
                  ref={expenseFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => onExpenseFileSelected(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" className="gap-2" onClick={downloadExpenseTemplate}>
                  <Download className="h-4 w-4" />
                  Plantilla Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={expenseImporting}
                  onClick={() => expenseFileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {expenseImporting ? "Importando…" : "Importar Excel"}
                </Button>
                <Button className="gap-2" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" /> Agregar Gasto
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Buscar por descripción o contrato..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {EXPENSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companyRows.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="PENDING">En aprobación</SelectItem>
                  <SelectItem value="APPROVED">Aprobados</SelectItem>
                  <SelectItem value="REJECTED">Rechazados</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterDistribution}
                onValueChange={(v) => setFilterDistribution(v as ExpenseDistributionFilter)}
              >
                <SelectTrigger className="w-[13.5rem]">
                  <SelectValue placeholder="Reparto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo tipo de reparto</SelectItem>
                  <SelectItem value="single_contract">Un solo contrato (un mes)</SelectItem>
                  <SelectItem value="multi_month">Un contrato — varios meses</SelectItem>
                  <SelectItem value="deferred">Varios contratos (diferido)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {expensesLoading ? (
              <div className="p-12 text-center text-slate-400">Cargando gastos...</div>
            ) : isError ? (
              <div className="p-12 text-center space-y-3">
                <p className="text-red-600">
                  {error instanceof Error ? error.message : "No se pudieron cargar los gastos"}
                </p>
                <Button type="button" variant="outline" onClick={() => refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
                No hay gastos registrados
              </div>
            ) : (
              <div className="overflow-x-auto">
                {hasActiveColumnFilters(columnFilters) && (
                  <div className="flex justify-end px-3 py-1.5 border-b bg-muted/30">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setColumnFilters(clearColumnFilters(expenseColumnFilterKeys))}
                    >
                      <X className="h-3 w-3" />
                      Limpiar filtros de columnas
                    </Button>
                  </div>
                )}
                <table data-table-id="gastos-expenses" className="w-full text-sm">
                  <thead>
                    <TableColumnFilterHead
                      tableId="gastos-expenses"
                      defaultColumnWidths={{
                        sequentialNo: 110,
                        type: 120,
                        budgetLine: 140,
                        company: 140,
                        description: 220,
                        originRef: 140,
                        contract: 140,
                        period: 100,
                        createdAt: 110,
                        amount: 110,
                        status: 110,
                        actions: 90,
                      }}
                      columns={expenseColumnDefs}
                      rows={expenses}
                      filters={columnFilters}
                      onFilterChange={onColumnFilterChange}
                      filterRowClassName="border-b bg-muted/30"
                    />
                  </thead>
                  <tbody className="divide-y">
                    {displayedExpenses.map(e => {
                      const ti = typeInfo(e.type);
                      return (
                        <tr key={e.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            {formatSequentialNo(e.sequentialNo)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ti.color}`}>
                              {ti.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {budgetLineLabel(e.budgetLine)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs">
                            {e.company ? companyDisplayName(e.company, companyRows) : "—"}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-medium text-slate-800 truncate">{e.description}</div>
                            {e.notes && <div className="text-xs text-slate-400 truncate">{e.notes}</div>}
                          </td>
                          <td className="px-4 py-3">
                            {e.origin ? (
                              <div>
                                <div className="text-xs font-medium text-slate-700">{e.origin.name}</div>
                                {e.referenceNumber && <div className="text-xs text-slate-400 font-mono">{e.referenceNumber}</div>}
                              </div>
                            ) : e.referenceNumber ? (
                              <div className="text-xs text-slate-500 font-mono">{e.referenceNumber}</div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {e.contract ? (
                              <div>
                                <div className="font-medium text-slate-700">{e.contract.client}</div>
                                <div className="text-xs text-slate-400">{e.contract.licitacionNo} · {companyDisplayName(e.contract.company, companyRows)}</div>
                                {e.position && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {e.position.location
                                      ? `${e.position.location.name} › ${e.position.name}`
                                      : `Puesto: ${e.position.name}`}
                                  </div>
                                )}
                              </div>
                            ) : e.isDeferred ? (
                              <div>
                                <Badge variant="outline">
                                  {e.deferredIncludeContractIds && e.deferredIncludeContractIds.length > 0
                                    ? `${e.deferredIncludeContractIds.length} contrato(s) en reparto`
                                    : "Todos los contratos activos"}
                                </Badge>
                                <div className="text-xs text-slate-400 mt-0.5">
                                  Diferido · impacto inmediato al presupuesto
                                </div>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatMonthYear(e.periodMonth)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs text-slate-500">
                              {new Date(e.createdAt).toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                            </div>
                            <div className="text-xs text-slate-400">
                              {new Date(e.createdAt).toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit" })}
                              {e.createdBy?.name ? ` · ${e.createdBy.name}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(e.amount)}
                          </td>
                          <td className="px-4 py-3 space-y-1">
                            <div>{approvalBadge(e)}</div>
                            {e.isDeferred ? (
                              e.isDistributed ? (
                                <Badge variant="success">En presupuesto</Badge>
                              ) : (
                                <Badge variant="outline">Sin reparto (sin contratos elegibles)</Badge>
                              )
                            ) : (
                              <Badge variant="secondary">Directo</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                title="Detalle, aprobaciones y adjuntos"
                                onClick={() => setPreviewExpense(e)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {canEdit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-slate-600 hover:text-red-600 hover:bg-red-50"
                                  title="Editar tipo, descripción u origen"
                                  onClick={() => openEdit(e)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="text-red-500 hover:bg-red-50"
                                  onClick={() => {
                                    if (confirm("¿Eliminar este gasto?")) deleteMutation.mutate(e.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Edit Expense Modal ───────────────────────────────────────────────── */}
      <ExpenseEditDialog
        editExpense={editExpense}
        editForm={editForm}
        setEditForm={setEditForm}
        setEditExpense={setEditExpense}
        handleSaveEdit={handleSaveEdit}
        updateMutation={updateMutation}
        activeCompanies={activeCompanies}
        originsData={originsData}
      />


      {/* ── Add Expense Modal ────────────────────────────────────────────────── */}
      <Dialog open={showForm && canEdit} onOpenChange={v => { if (!v) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[min(92vh,880px)] flex flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <div className="shrink-0 px-6 pt-6 pb-2 pr-12">
            <DialogHeader>
              <DialogTitle>Agregar Gasto</DialogTitle>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-2">
          <div className="space-y-4">
            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Tipo de gasto</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ExpenseType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${t.color}`}>{t.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Partida + Empresa del gasto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Partida</label>
                <Select
                  value={form.budgetLine || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, budgetLine: v === "none" ? "" : (v as ExpenseBudgetLine) }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Partida presupuestaria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Seleccione —</SelectItem>
                    {EXPENSE_BUDGET_LINES.map((bl) => (
                      <SelectItem key={bl} value={bl}>{EXPENSE_BUDGET_LINE_LABELS[bl]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">Alinea el gasto con la distribución del contrato.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Empresa</label>
                <Select
                  value={form.company || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, company: v === "none" ? "" : v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Empresa del gasto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Seleccione —</SelectItem>
                    {activeCompanies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">Empresa a la que se imputa este gasto.</p>
              </div>
            </div>

            {/* Origin + Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Origen</label>
                <Select value={form.originId || "none"} onValueChange={v => setForm(f => ({ ...f, originId: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar origen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin especificar —</SelectItem>
                    {(originsData?.data ?? []).filter(o => o.isActive).map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">N° OC (Codisa)</label>
                <ExpenseOcPicker
                  value={form.referenceNumber}
                  company={form.company || undefined}
                  onChange={(noOrden, row) => {
                    setForm((f) => {
                      if (!row) return { ...f, referenceNumber: noOrden };
                      return {
                        ...f,
                        referenceNumber: noOrden,
                        company: row.companyCode || f.company,
                        amount:
                          row.monto != null && Number.isFinite(row.monto)
                            ? String(row.monto)
                            : f.amount,
                        description:
                          row.observaciones && !f.description.trim()
                            ? row.observaciones.slice(0, 200)
                            : f.description,
                      };
                    });
                  }}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <Input
                placeholder="Ej: Compra de uniformes octubre, Mantenimiento radio..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Amount + Period + Payment date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Monto (₡)</label>
                <Input
                  type="number" min="0" step="100"
                  placeholder="0"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Período</label>
                <Input
                  type="month"
                  value={form.periodMonth}
                  onChange={e => setForm(f => ({ ...f, periodMonth: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Fecha de pago (opcional)</label>
                <Input
                  type="date"
                  value={form.paymentDate}
                  onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))}
                />
                <p className="text-xs text-slate-400">
                  La programación en calendario se hace en Pagos → Pago proveedores.
                </p>
              </div>
            </div>

            {/* Mode toggle */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Asignar a</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-md border border-slate-200 p-1 bg-muted/50/50">
                <button
                  type="button"
                  className={`rounded py-2.5 px-1 text-xs sm:text-sm font-medium transition-colors ${form.mode === "contract" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-card"}`}
                  onClick={() => {
                    setCreateDeferredDraft("all");
                    setCustomDeferredRows([{ contractId: "", amount: "", contractQuery: "" }]);
                    setForm((f) => ({ ...f, mode: "contract" }));
                  }}
                >
                  Contrato específico
                </button>
                <button
                  type="button"
                  className={`rounded py-2.5 px-1 text-xs sm:text-sm font-medium transition-colors ${form.mode === "deferred" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-card"}`}
                  onClick={() => {
                    setCreateDeferredDraft("all");
                    setCustomDeferredRows([{ contractId: "", amount: "", contractQuery: "" }]);
                    setForm((f) => ({
                      ...f,
                      mode: "deferred",
                      contractId: "",
                      positionId: "",
                      spreadMonths: 1,
                    }));
                  }}
                >
                  Diferido proporcional
                </button>
                <button
                  type="button"
                  className={`rounded py-2.5 px-1 text-xs sm:text-sm font-medium transition-colors ${form.mode === "deferred_custom" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 hover:bg-card"}`}
                  onClick={() => {
                    setCreateDeferredDraft("all");
                    setCustomDeferredRows([{ contractId: "", amount: "", contractQuery: "" }]);
                    setForm((f) => ({
                      ...f,
                      mode: "deferred_custom",
                      contractId: "",
                      positionId: "",
                      spreadMonths: 1,
                    }));
                  }}
                >
                  Diferido personalizado
                </button>
              </div>
              <p className="text-xs text-slate-500">
                <strong>Proporcional:</strong> reparto según presupuesto de insumos de cada contrato.
                <strong className="ml-1">Personalizado:</strong> usted elige el monto exacto por contrato (debe sumar al total).
              </p>
            </div>

            {/* Contract selector */}
            {form.mode === "contract" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Contrato *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className={`pl-9 ${form.contractId ? "border-green-400 bg-green-50" : ""}`}
                    placeholder="Escriba para buscar por licitación, cliente o empresa..."
                    value={contractSearch}
                    onFocus={() => setContractFocused(true)}
                    onBlur={() => setTimeout(() => setContractFocused(false), 150)}
                    onChange={e => {
                      setContractSearch(e.target.value);
                      setForm(f => ({ ...f, contractId: "", positionId: "" }));
                    }}
                  />
                </div>
                {/* Dropdown: show when focused OR when typing and no contract selected yet */}
                {(contractFocused || (contractSearch && !form.contractId)) && (
                  <div className="border rounded-md max-h-48 overflow-y-auto divide-y shadow-sm">
                    {contractRemoteSearchLoading && remoteContractQuery.length >= 2 && (
                      <div className="p-2.5 text-xs text-slate-500 border-b bg-muted/50">
                        Buscando contratos en el servidor…
                      </div>
                    )}
                    {filteredContracts.length === 0 && !(contractRemoteSearchLoading && remoteContractQuery.length >= 2) ? (
                      <div className="p-3 text-sm text-slate-400">Sin resultados para «{contractSearch}»</div>
                    ) : filteredContracts.map(c => (
                      <button
                        key={c.id} type="button"
                        className={`w-full text-left px-3 py-2.5 text-sm hover:bg-red-50 transition-colors ${form.contractId === c.id ? "bg-red-50 text-red-700" : ""}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setForm(f => ({ ...f, contractId: c.id, company: c.company, positionId: "" }));
                          setContractSearch(`${c.licitacionNo} — ${c.client}`);
                          setContractFocused(false);
                        }}
                      >
                        <div className="font-medium text-slate-800">{c.client}</div>
                        <div className="text-xs text-slate-400">{c.licitacionNo} · {companyDisplayName(c.company, companyRows)}</div>
                      </button>
                    ))}
                  </div>
                )}
                {form.contractId
                  ? <p className="text-xs text-green-600 font-medium">✓ Contrato seleccionado</p>
                  : <p className="text-xs text-slate-400">Escriba para buscar y haga clic para seleccionar</p>
                }
              </div>
            )}

            {/* Position selector — shown when a contract is selected */}
            {form.mode === "contract" && form.contractId && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Puesto <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                {(positionsData?.data ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Este contrato no tiene puestos en ninguna ubicación.{" "}
                    <a href={`/contracts/${form.contractId}`} className="text-red-600 hover:underline" target="_blank">
                      Agregar en Ubicaciones
                    </a>
                  </p>
                ) : (
                  <Select
                    value={form.positionId || "none"}
                    onValueChange={v => setForm(f => ({ ...f, positionId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Asignar a puesto específico..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sin puesto (contrato general) —</SelectItem>
                      {(positionsData?.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                          {p.shifts.length > 0
                            ? ` (${p.shifts.map((s) => (s.label ? `${s.label} ` : "") + `${s.hours}h`).join(", ")})`
                            : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Prorrateo en meses (mismo contrato) */}
            {form.mode === "contract" && form.contractId && (
              <div className="space-y-1.5 rounded-lg border border-slate-200 bg-muted/50/80 p-3">
                <label className="text-sm font-medium text-slate-700">Prorrateo en meses</label>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    className="w-24 h-9"
                    value={form.spreadMonths}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setForm((f) => ({
                        ...f,
                        spreadMonths: Number.isFinite(v) ? Math.min(60, Math.max(1, v)) : 1,
                      }));
                    }}
                  />
                  <span className="text-sm text-slate-600">
                    {form.spreadMonths <= 1
                      ? "Un solo mes (período indicado arriba)."
                      : `El monto total se divide en ${form.spreadMonths} cuotas iguales desde el período seleccionado.`}
                  </span>
                </div>
                {form.spreadMonths > 1 && form.amount && parseFloat(form.amount) > 0 && (
                  <p className="text-xs text-slate-500">
                    ≈ {formatCurrency(parseFloat(form.amount) / form.spreadMonths)} por mes (ajuste por redondeo en la última cuota si aplica).
                  </p>
                )}
              </div>
            )}

            {/* Deferred proporcional */}
            {form.mode === "deferred" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                <p className="font-medium text-slate-900">Gasto diferido proporcional</p>
                <p className="text-xs text-slate-700">
                  El monto <strong>entra de inmediato</strong> al presupuesto de los contratos marcados (proporcional al presupuesto de insumos). Si un aprobador rechaza el gasto, ese impacto se revierte.
                </p>
                <p className="text-xs font-medium text-slate-700">Contratos que reciben el reparto</p>
                <DeferredContractSelector
                  contracts={deferredAssignableContracts}
                  allIds={deferredAssignableIds}
                  draft={createDeferredDraft}
                  onChange={setCreateDeferredDraft}
                  companyRows={companyRows}
                />
              </div>
            )}

            {/* Deferred personalizado: montos manuales por contrato */}
            {form.mode === "deferred_custom" && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-sm space-y-3">
                <p className="font-medium text-violet-900">Reparto manual por contrato</p>
                <p className="text-xs text-violet-900/90">
                  Busque cada contrato escribiendo licitación, cliente o empresa. La <strong>suma de los montos</strong> debe
                  igualar el <strong>monto total</strong> del gasto indicado arriba (hasta ¢2 de diferencia por redondeo).
                  Los contratos no tienen que ser de la misma empresa que la del gasto.
                </p>
                {customDeferredTotalTarget > 0 && (
                  <p
                    className={`text-xs font-medium rounded border px-2 py-1.5 ${
                      Math.abs(customDeferredSum - customDeferredTotalTarget) <= 0.02
                        ? "border-green-300 bg-green-50 text-green-900"
                        : "border-amber-300 bg-amber-50 text-amber-900"
                    }`}
                  >
                    Suma asignada: {formatCurrency(customDeferredSum)} · Monto del gasto:{" "}
                    {formatCurrency(customDeferredTotalTarget)}
                    {Math.abs(customDeferredSum - customDeferredTotalTarget) <= 0.02
                      ? " ✓"
                      : " — ajuste las filas hasta que coincidan"}
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
                      form.mode === "deferred_custom" &&
                      Array.isArray(deferredRowRemoteSearch?.data) &&
                      debouncedDeferredRowSearch.trim() === rowPickQuery;
                    const rowFiltered = useRemoteRow
                      ? deferredRowRemoteSearch!.data!.slice(0, 50)
                      : filterAssignableContractsByQuery(deferredAssignableContracts, row.contractQuery);
                    return (
                      <div key={idx} className="rounded-md border border-violet-100/80 bg-card/90 p-2 space-y-1.5">
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex-1 min-w-[220px] space-y-1">
                            <span className="text-xs font-medium text-slate-600">Contrato</span>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                              <Input
                                className={`pl-9 h-9 ${row.contractId ? "border-green-400 bg-green-50/60" : ""}`}
                                placeholder="Escriba para buscar…"
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
                              <div className="border rounded-md max-h-44 overflow-y-auto divide-y shadow-sm bg-card">
                                {rowFiltered.length === 0 ? (
                                  <div className="p-2.5 text-xs text-slate-400">
                                    Sin resultados para «{row.contractQuery.trim() || "…"}»
                                  </div>
                                ) : (
                                  rowFiltered.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      className={`w-full text-left px-3 py-2 text-sm hover:bg-violet-50 transition-colors ${
                                        row.contractId === c.id ? "bg-violet-50 text-violet-900" : ""
                                      }`}
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
                                      <div className="font-medium text-slate-800">{c.client}</div>
                                      <div className="text-xs text-slate-500">
                                        {c.licitacionNo} · {companyDisplayName(c.company, companyRows)}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                            {row.contractId ? (
                              <p className="text-[11px] text-green-700 font-medium">✓ Contrato seleccionado</p>
                            ) : (
                              <p className="text-[11px] text-slate-400">Escriba y elija un contrato de la lista</p>
                            )}
                          </div>
                          <div className="w-36 space-y-1">
                            <span className="text-xs font-medium text-slate-600">Monto ₡</span>
                            <Input
                              type="number"
                              min={0}
                              step={100}
                              className="h-9 bg-card"
                              placeholder="0"
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
                            size="icon"
                            className="h-9 w-9 shrink-0 text-slate-500"
                            disabled={customDeferredRows.length <= 1}
                            title="Quitar fila"
                            onClick={() =>
                              setCustomDeferredRows((rows) =>
                                rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
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
                  className="w-full gap-1 border-violet-200 bg-card text-violet-900 hover:bg-violet-50"
                  onClick={() =>
                    setCustomDeferredRows((rows) => [...rows, { contractId: "", amount: "", contractQuery: "" }])
                  }
                >
                  <Plus className="h-4 w-4" /> Agregar contrato
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Registro 1 CXP (opcional)</label>
                <Input
                  placeholder="Referencia CXP…"
                  value={form.registroCxp}
                  onChange={(e) => setForm((f) => ({ ...f, registroCxp: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Registro 2 TR (opcional)</label>
                <Input
                  placeholder="Referencia TR…"
                  value={form.registroTr}
                  onChange={(e) => setForm((f) => ({ ...f, registroTr: e.target.value }))}
                />
              </div>
            </div>

            {/* Adjuntos (se suben al guardar, tras crear el gasto) */}
            <div className="space-y-2 rounded-lg border border-slate-200 bg-muted/50/80 p-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-slate-500 shrink-0" />
                <label className="text-sm font-medium text-slate-700">Archivos adjuntos (opcional)</label>
              </div>
              <input
                ref={addExpenseAttachRef}
                type="file"
                multiple
                accept={ATTACH_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  setAddExpenseFiles((prev) => [...prev, ...picked]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => addExpenseAttachRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Elegir archivos
              </Button>
              {addExpenseFiles.length > 0 ? (
                <ul className="text-xs space-y-1.5 max-h-28 overflow-y-auto">
                  {addExpenseFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}-${f.size}`}
                      className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5"
                    >
                      <span className="truncate text-slate-700" title={f.name}>
                        {f.name}
                        <span className="text-slate-400"> · {(f.size / 1024).toFixed(0)} KB</span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Quitar ${f.name}`}
                        onClick={() => setAddExpenseFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">PDF, imágenes, Excel o CSV. Máx. 15 MB por archivo.</p>
              )}
              {form.mode === "contract" && form.spreadMonths > 1 && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                  Con prorrateo en varios meses, los adjuntos se asocian al <strong>primer</strong> mes generado;
                  puede abrir las demás cuotas desde la tabla y añadir más desde el detalle.
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Notas (opcional)</label>
              <Input
                placeholder="Detalles adicionales..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-background px-6 py-4">
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Guardando…" : "Guardar Gasto"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Distribution Preview Modal ───────────────────────────────────────── */}
      <ExpensePreviewDialog
        previewExpense={previewExpense}
        setPreviewExpense={setPreviewExpense}
        previewData={previewData}
        previewDetail={previewDetail}
        previewLoading={previewLoading}
        distributionDraft={distributionDraft}
        setDistributionDraft={setDistributionDraft}
        saveDeferredTargetsMutation={saveDeferredTargetsMutation}
        setPreviewAttachment={setPreviewAttachment}
        refetchPreviewDetail={refetchPreviewDetail}
        canEdit={canEdit}
        companyRows={companyRows}
        deferredAssignableContracts={deferredAssignableContracts as DeferredSelectorContract[]}
        deferredAssignableIds={deferredAssignableIds}
        approvalBadge={approvalBadge}
        qc={qc}
      />

      <AttachmentPreviewDialog
        attachment={previewAttachment}
        onOpenChange={(open) => { if (!open) setPreviewAttachment(null); }}
      />
    </>
  );
}
