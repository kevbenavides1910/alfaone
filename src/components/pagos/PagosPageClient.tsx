"use client";

import { useState, useCallback, useMemo, useEffect, useRef, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Eye, Trash2, CalendarDays, Repeat, GanttChartSquare, ScrollText, Search, X, Building2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate, formatDateTime, calendarDateInputValue } from "@/lib/utils/format";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import {
  PAYMENT_CATEGORIES,
  paymentCategoryLabel,
  paymentSubcategoryLabel,
  subcategoriesFor,
  validatePaymentClassification,
} from "@/modules/pagos/catalog/payment-categories";
import {
  PaymentOcMultiPicker,
  formatPaymentOcReference,
  sumPaymentOcMontos,
  type PaymentOcItem,
} from "@/components/pagos/PaymentOcMultiPicker";

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const p = payload as { message?: unknown; error?: { message?: unknown } };
  if (typeof p.error?.message === "string" && p.error.message.trim()) return p.error.message;
  if (typeof p.message === "string" && p.message.trim()) return p.message;
  return fallback;
}

type PagoFuente = "EXPENSE" | "APEX" | "MANUAL";

type PagoDto = {
  id: string;
  source: PagoFuente;
  expenseId: string | null;
  apexPagoId: number | null;
  apexPagoBaseId: number | null;
  description: string;
  amount: number;
  paymentDate: string;
  company: string | null;
  refType: string | null;
  referenceNumber: string | null;
  category: string | null;
  subcategory: string | null;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
};

type CalendarDay = {
  date: string;
  payments: PagoDto[];
  total: number;
  totalPaid: number;
};

type PaymentChangeLogDto = {
  id: string;
  paymentId: string;
  paymentDescription: string | null;
  paymentCompany: string | null;
  paymentSource: string | null;
  field: string;
  fieldLabel: string;
  previousValue: string | null;
  newValue: string | null;
  changedByName: string | null;
  createdAt: string;
};

const FUENTE_LABEL: Record<PagoFuente, string> = {
  EXPENSE: "Gasto",
  APEX: "E. fijo",
  MANUAL: "Manual",
};

const FUENTE_BADGE: Record<PagoFuente, string> = {
  EXPENSE: "bg-sky-100 text-sky-700",
  APEX: "bg-amber-100 text-amber-700",
  MANUAL: "bg-violet-100 text-violet-700",
};

type PagoProveedorDto = {
  id: string;
  expenseIds: string[];
  description: string;
  amount: number;
  company: string | null;
  type: string;
  referenceNumber: string | null;
  periodMonth: string;
  paymentDate: string | null;
  notes: string | null;
  createdAt: string;
  status: "unscheduled" | "scheduled_unpaid" | "paid";
  paymentId: string | null;
  budgetSlices?: number;
};

type PagosTab = "diarios" | "fijos" | "cronograma" | "proveedores" | "bitacora";

interface NewPaymentDraft {
  description: string;
  amount: string;
  paymentDate: string;
  company: string;
  /** OC de Pago proveedores (cada una ya ligada a un gasto). */
  ocs: PaymentOcItem[];
  notes: string;
  category: string;
  subcategory: string;
}

const EMPTY_DRAFT: NewPaymentDraft = {
  description: "",
  amount: "",
  paymentDate: "",
  company: "",
  ocs: [],
  notes: "",
  category: "",
  subcategory: "",
};

function applyOcsToDraft(d: NewPaymentDraft, ocs: PaymentOcItem[]): NewPaymentDraft {
  const total = sumPaymentOcMontos(ocs);
  const first = ocs[0];
  const next: NewPaymentDraft = {
    ...d,
    ocs,
    amount: ocs.length > 0 ? String(total) : d.amount,
  };
  if (first?.companyCode && !d.company.trim()) {
    next.company = first.companyCode;
  }
  if (ocs.length > 0) {
    const nums = ocs.map((o) => o.noOrden).join(", ");
    const autoDescription =
      ocs.length === 1
        ? `OC ${nums} · ${ocs[0].description}`
        : `OC ${nums} (${ocs.length} gastos proveedores)`;
    const prev = d.description.trim();
    if (!prev || /^OC\s/i.test(prev)) {
      next.description = autoDescription;
    }
  }
  return next;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthFromPaymentDate(paymentDate: string): string {
  return paymentDate.slice(0, 7);
}

function dayLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysInGrid(month: string): { date: string; dayOfMonth: number; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = first.getDay(); // 0=Sun
  const totalDays = new Date(y, m, 0).getDate();
  const cells: { date: string; dayOfMonth: number; inMonth: boolean }[] = [];
  // Leading blanks
  for (let i = 0; i < startDow; i++) {
    const d = new Date(y, m - 1, -startDow + i + 1);
    cells.push({ date: dayLabel(d), dayOfMonth: d.getDate(), inMonth: false });
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ date: dayLabel(new Date(y, m - 1, day)), dayOfMonth: day, inMonth: true });
  }
  // Trailing to complete grid rows (weeks)
  while (cells.length % 7 !== 0) {
    const last = new Date(y, m - 1, totalDays + (cells.length - startDow - totalDays + 1));
    cells.push({ date: dayLabel(last), dayOfMonth: last.getDate(), inMonth: false });
  }
  return cells;
}

function filterCalendar(calendar: CalendarDay[], sources: PagoFuente[]): CalendarDay[] {
  return calendar.map((day) => {
    const payments = day.payments.filter((p) => sources.includes(p.source));
    return {
      date: day.date,
      payments,
      total: payments.reduce((s, p) => s + p.amount, 0),
      totalPaid: payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0),
    };
  });
}

function calendarTotals(calendar: CalendarDay[]) {
  const total = calendar.reduce((s, d) => s + d.total, 0);
  const paid = calendar.reduce((s, d) => s + d.totalPaid, 0);
  return { total, paid, pending: total - paid };
}

type AmountTotals = {
  total: number;
  paid: number;
  pending: number;
};

function aggregateCells(
  cells: { date: string; inMonth: boolean }[],
  byDate: Map<string, CalendarDay>,
  inMonthOnly = true,
): AmountTotals {
  return cells.reduce<AmountTotals>(
    (acc, cell) => {
      if (inMonthOnly && !cell.inMonth) return acc;
      return {
        total: acc.total + (byDate.get(cell.date)?.total ?? 0),
        paid: acc.paid + (byDate.get(cell.date)?.totalPaid ?? 0),
        pending:
          acc.pending +
          ((byDate.get(cell.date)?.total ?? 0) - (byDate.get(cell.date)?.totalPaid ?? 0)),
      };
    },
    { total: 0, paid: 0, pending: 0 },
  );
}

function chunkWeeks(cells: { date: string; dayOfMonth: number; inMonth: boolean }[]) {
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** Pendiente (ámbar) y pagado (verde) en columnas separadas. */
function AmountPair({
  pending,
  paid,
  size = "sm",
  showLabels = true,
}: {
  pending: number;
  paid: number;
  size?: "sm" | "md";
  showLabels?: boolean;
}) {
  const text = size === "sm" ? "text-[9px]" : "text-xs";
  return (
    <div className={`grid grid-cols-2 gap-x-2 gap-y-0.5 ${text} leading-tight`}>
      {showLabels && (
        <>
          <span className="text-muted-foreground text-right">Pend.</span>
          <span className="text-muted-foreground text-right">Pag.</span>
        </>
      )}
      <span className={`font-semibold text-amber-600 text-right ${showLabels ? "" : "col-start-1"}`}>
        {formatCurrency(pending)}
      </span>
      <span className="font-semibold text-emerald-600 text-right">
        {formatCurrency(paid)}
      </span>
    </div>
  );
}

function CalendarTotalsBar({
  label,
  totals,
  variant,
}: {
  label: string;
  totals: AmountTotals;
  variant: "week" | "month";
}) {
  const base =
    variant === "month"
      ? "mt-2 rounded-md border-2 border-primary/20 bg-primary/5 px-3 py-2"
      : "rounded-md border bg-muted/40 px-2 py-1.5";
  return (
    <div className={`${base} flex flex-wrap items-center justify-between gap-2`}>
      <span
        className={`font-semibold text-muted-foreground shrink-0 ${
          variant === "month" ? "text-sm" : "text-[11px]"
        }`}
      >
        {label}
      </span>
      <div className={variant === "month" ? "min-w-[200px]" : "min-w-[160px]"}>
        <AmountPair pending={totals.pending} paid={totals.paid} size={variant === "month" ? "md" : "sm"} />
      </div>
    </div>
  );
}

type Props = {
  initialCompany?: string | null;
};

export function PagosPageClient({ initialCompany }: Props) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [company, setCompany] = useState<string>(initialCompany ?? "all");
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<NewPaymentDraft>(EMPTY_DRAFT);
  const [detailPayment, setDetailPayment] = useState<PagoDto | null>(null);
  const [dayDialog, setDayDialog] = useState<CalendarDay | null>(null);
  const [activeTab, setActiveTab] = useState<PagosTab>("diarios");
  const [ocQuery, setOcQuery] = useState("");
  const [ocDebounced, setOcDebounced] = useState("");
  const [proveedorStatusFilter, setProveedorStatusFilter] = useState<
    "all" | "unscheduled" | "scheduled_unpaid" | "paid"
  >("all");
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setOcDebounced(ocQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [ocQuery]);

  const canEdit = useMemo(
    () => hasPermission(session, "pagos.calendario", "edit"),
    [session],
  );

  const { data: calendar = [], isFetching, isError: calendarError, error: calendarErr, refetch } = useQuery({
    queryKey: ["pagos", month, company],
    queryFn: async () => {
      const params = new URLSearchParams({ month });
      if (company && company !== "all") params.set("company", company);
      const res = await fetch(`/api/pagos?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Error al cargar pagos");
      }
      const json = await res.json();
      return json.data as CalendarDay[];
    },
    enabled: activeTab !== "bitacora" && activeTab !== "proveedores",
    retry: 1,
  });

  const ocSearchEnabled = ocDebounced.length >= 2;
  const {
    data: ocResults = [],
    isFetching: ocSearching,
    isError: ocSearchError,
  } = useQuery({
    queryKey: ["pagos-oc-search", ocDebounced, company],
    queryFn: async () => {
      const params = new URLSearchParams({ oc: ocDebounced });
      if (company && company !== "all") params.set("company", company);
      const res = await fetch(`/api/pagos?${params.toString()}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Error al buscar OC");
      }
      const json = await res.json();
      return (json.data ?? json) as PagoDto[];
    },
    enabled: ocSearchEnabled,
    retry: 1,
  });

  const openOcResult = useCallback((p: PagoDto) => {
    const targetMonth = monthFromPaymentDate(p.paymentDate);
    if (targetMonth) setMonth(targetMonth);
    if (activeTab === "bitacora" || activeTab === "proveedores") setActiveTab("diarios");
    setDetailPayment(p);
  }, [activeTab]);

  const { data: bitacoraGlobal = [], isFetching: bitacoraFetching } = useQuery({
    queryKey: ["pagos-bitacora-global", company],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "300" });
      if (company && company !== "all") params.set("company", company);
      const res = await fetch(`/api/pagos/bitacora?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar bitácora");
      const json = await res.json();
      return (json.data ?? json) as PaymentChangeLogDto[];
    },
    enabled: activeTab === "bitacora",
  });

  const {
    data: proveedores = [],
    isFetching: proveedoresFetching,
    isError: proveedoresError,
    error: proveedoresErr,
    refetch: refetchProveedores,
  } = useQuery({
    queryKey: ["pagos-proveedores", company],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (company && company !== "all") params.set("company", company);
      const qs = params.toString();
      const res = await fetch(`/api/pagos/proveedores${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(j, "Error al cargar pago proveedores"));
      }
      const json = await res.json();
      return (json.data ?? json) as PagoProveedorDto[];
    },
    enabled: activeTab === "proveedores" || showNew,
    retry: 1,
  });

  const proveedorOcOptions = useMemo(
    () =>
      proveedores
        .filter(
          (e) =>
            (e.referenceNumber ?? "").trim().length > 0 && e.status !== "paid",
        )
        .map((e) => ({
          id: e.id,
          expenseIds: e.expenseIds?.length ? e.expenseIds : [e.id],
          description: e.description,
          amount: e.amount,
          company: e.company,
          referenceNumber: e.referenceNumber,
          status: e.status === "scheduled_unpaid" ? "scheduled_unpaid" as const : "unscheduled" as const,
          budgetSlices: e.budgetSlices,
        })),
    [proveedores],
  );

  const proveedoresVisible = useMemo(() => {
    let rows = proveedores;
    if (proveedorStatusFilter !== "all") {
      rows = rows.filter((e) => e.status === proveedorStatusFilter);
    }
    const q = ocDebounced.trim().toLowerCase();
    if (q.length >= 2) {
      rows = rows.filter((e) => {
        const oc = (e.referenceNumber ?? "").toLowerCase();
        return oc.includes(q) || e.description.toLowerCase().includes(q);
      });
    }
    return rows;
  }, [ocDebounced, proveedores, proveedorStatusFilter]);

  const scheduleMutation = useMutation({
    mutationFn: async ({
      expenseId,
      expenseIds,
      paymentDate,
    }: {
      expenseId: string;
      expenseIds?: string[];
      paymentDate: string;
    }) => {
      const res = await fetch("/api/pagos/proveedores/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId,
          expenseIds,
          paymentDate,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || j.message || "No se pudo programar el pago");
      }
      const json = await res.json();
      return (json.data ?? json) as PagoDto;
    },
    onSuccess: (p) => {
      toast.success(
        p.paymentDate
          ? "Fecha guardada — el gasto está en el calendario"
          : "Fecha asignada — ya aparece en el calendario",
      );
      queryClient.invalidateQueries({ queryKey: ["pagos-proveedores"] });
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      setScheduleDates((prev) => {
        const next = { ...prev };
        if (p.expenseId) delete next[p.expenseId];
        return next;
      });
      const targetMonth = monthFromPaymentDate(p.paymentDate);
      if (targetMonth) setMonth(targetMonth);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al programar"),
  });

  const markMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const res = await fetch(`/api/pagos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      if (!res.ok) throw new Error("Error al marcar pago");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-oc-search"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-bitacora"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-bitacora-global"] });
    },
    onError: () => toast.error("No se pudo actualizar el pago"),
  });

  const createMutation = useMutation({
    mutationFn: async (body: object) => {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(j, "Error al crear pago"));
      }
      return res.json();
    },
    onSuccess: (_json, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-oc-search"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-proveedores"] });
      setShowNew(false);
      setDraft(EMPTY_DRAFT);
      const linked =
        variables &&
        typeof variables === "object" &&
        "expenseIds" in variables &&
        Array.isArray((variables as { expenseIds?: string[] }).expenseIds) &&
        ((variables as { expenseIds?: string[] }).expenseIds?.length ?? 0) > 0;
      toast.success(
        linked
          ? "Pago creado — OC ligadas y sacadas de Pago proveedores"
          : "Pago agregado",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al crear pago"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/pagos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar pago");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-oc-search"] });
      toast.success("Pago eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el pago"),
  });

  const syncYearMutation = useMutation({
    mutationFn: async () => {
      const year = Number.parseInt(month.slice(0, 4), 10);
      const res = await fetch(`/api/pagos/sync?year=${year}`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Error al sincronizar meses anteriores");
      }
      return res.json();
    },
    onSuccess: (json) => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-oc-search"] });
      const d = json?.data ?? json;
      const months = Array.isArray(d?.monthsSynced) ? d.monthsSynced.length : 0;
      const apex = Number(d?.apexCreated ?? 0);
      const exp = Number(d?.expensesCreated ?? 0);
      toast.success(
        `Meses sincronizados: ${months}. Nuevos APEX: ${apex}, gastos: ${exp}.`,
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Error al sincronizar meses anteriores"),
  });

  const shiftMonth = useCallback((dir: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, [month]);

  const fixedCalendar = useMemo(
    () => filterCalendar(calendar, ["APEX"]),
    [calendar],
  );

  const allByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of calendar) map.set(day.date, day);
    return map;
  }, [calendar]);

  const fixedByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of fixedCalendar) map.set(day.date, day);
    return map;
  }, [fixedCalendar]);

  const activeCalendar = activeTab === "fijos" ? fixedCalendar : calendar;
  const { total: monthTotal, paid: monthPaid, pending: monthPending } = useMemo(
    () => calendarTotals(activeCalendar),
    [activeCalendar],
  );

  const draftSubcategoryOptions = useMemo(
    () => subcategoriesFor(draft.category || null),
    [draft.category],
  );

  const submitNew = () => {
    if (!draft.description.trim()) return toast.error("Escribí una descripción");
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Monto inválido");
    if (!draft.paymentDate) return toast.error("Elegí la fecha del pago");
    const classification = validatePaymentClassification(
      draft.category || null,
      draft.subcategory || null,
    );
    if (!classification.ok) return toast.error(classification.message);
    const referenceNumber = formatPaymentOcReference(draft.ocs) || undefined;
    const expenseIds = [...new Set(draft.ocs.flatMap((o) => o.expenseIds?.length ? o.expenseIds : [o.expenseId]))];
    createMutation.mutate({
      source: "MANUAL",
      description: draft.description.trim(),
      amount,
      paymentDate: draft.paymentDate,
      company: draft.company || undefined,
      referenceNumber,
      ...(expenseIds.length > 0 ? { expenseIds } : {}),
      notes: draft.notes || undefined,
      category: classification.category,
      subcategory: classification.subcategory,
    });
  };

  const today = dayLabel(new Date());

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4 min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Calendario de Pagos</h1>
          <p className="text-sm text-muted-foreground">
            Calendario diario, pagos fijos, programación de proveedores y bitácora
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={syncYearMutation.isPending}
              onClick={() => syncYearMutation.mutate()}
              title="Trae de Oracle/gastos los meses anteriores del año del mes seleccionado"
            >
              {syncYearMutation.isPending ? "Sincronizando…" : "Traer meses anteriores"}
            </Button>
            <Button
              onClick={() => {
                setDraft({ ...EMPTY_DRAFT, paymentDate: dayLabel(new Date()) });
                setShowNew(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Agregar pago manual
            </Button>
          </div>
        )}
      </div>

      {/* Resumen y controles */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 border rounded-md px-2 text-sm font-medium"
          >
            {monthOptions().map((m) => (
              <option key={m[0]} value={m[0]}>{m[1]}</option>
            ))}
          </select>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="h-9 border rounded-md px-2 text-sm"
        >
          <option value="all">Todas las compañías</option>
          <option value="01">01</option>
          <option value="02">02</option>
          <option value="03">03</option>
          <option value="04">04</option>
          <option value="05">05</option>
          <option value="06">06</option>
          <option value="30">30</option>
          <option value="AA">AA</option>
          <option value="BENA">BENA</option>
          <option value="GRUPO">GRUPO</option>
          <option value="TANGO">TANGO</option>
          <option value="MONITOREO">MONITOREO</option>
          <option value="CONSORCIO">CONSORCIO</option>
          <option value="JOBEN">JOBEN</option>
          <option value="ACE">ACE</option>
        </select>
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={ocQuery}
            onChange={(e) => setOcQuery(e.target.value)}
            placeholder="Buscar por número de OC…"
            className="h-9 pl-8 pr-8"
            aria-label="Buscar por número de OC en todos los meses"
          />
          {ocQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => { setOcQuery(""); setOcDebounced(""); }}
              aria-label="Limpiar búsqueda OC"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {activeTab === "bitacora" ? (
            bitacoraFetching && <span className="text-xs text-muted-foreground animate-pulse">cargando bitácora…</span>
          ) : activeTab === "proveedores" ? (
            proveedoresFetching ? (
              <span className="text-xs text-muted-foreground animate-pulse">cargando…</span>
            ) : (
              <span className="text-muted-foreground">
                Mostrando:{" "}
                <span className="font-semibold text-foreground">{proveedoresVisible.length}</span>
                {(proveedorStatusFilter !== "all" || ocDebounced.trim().length >= 2) &&
                  proveedoresVisible.length !== proveedores.length && (
                    <span className="text-xs ml-1">de {proveedores.length}</span>
                  )}
              </span>
            )
          ) : (
            <>
              <span className="text-muted-foreground">Pendiente:</span>
              <span className="font-semibold text-amber-600">{formatCurrency(monthPending)}</span>
              <span className="text-muted-foreground">Pagado:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(monthPaid)}</span>
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{formatCurrency(monthTotal)}</span>
              {isFetching && <span className="text-xs text-muted-foreground animate-pulse">cargando…</span>}
            </>
          )}
        </div>
      </div>

      {ocSearchEnabled && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium">
              Resultados por OC
              <span className="ml-2 font-normal text-muted-foreground">«{ocDebounced}» · todos los meses</span>
            </p>
            {ocSearching ? (
              <span className="text-xs text-muted-foreground animate-pulse">buscando…</span>
            ) : (
              <span className="text-xs text-muted-foreground">{ocResults.length} encontrado(s)</span>
            )}
          </div>
          {ocSearchError ? (
            <p className="text-sm text-destructive">No se pudo buscar. Probá de nuevo.</p>
          ) : !ocSearching && ocResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin coincidencias. Si es un mes viejo, usá «Traer meses anteriores» y volvé a buscar.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y rounded-md border">
              {ocResults.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-muted/60"
                    onClick={() => openOcResult(p)}
                  >
                    <span className="font-mono font-semibold text-sky-700 shrink-0">
                      {p.referenceNumber || "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.description}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(p.paymentDate)}</span>
                    <span className="font-semibold shrink-0">{formatCurrency(p.amount)}</span>
                    <Badge className={`${FUENTE_BADGE[p.source]} shrink-0`}>{FUENTE_LABEL[p.source]}</Badge>
                    <span className={p.paid ? "text-xs text-emerald-600" : "text-xs text-amber-600"}>
                      {p.paid ? "Pagado" : "Pendiente"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {calendarError && activeTab !== "bitacora" && activeTab !== "proveedores" && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive flex flex-wrap items-center gap-3">
          <span>
            No se pudieron cargar los pagos
            {calendarErr instanceof Error ? `: ${calendarErr.message}` : "."}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Vistas */}
      <Card className="flex-1 min-h-0 overflow-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PagosTab)} className="h-full flex flex-col">
          <div className="px-3 pt-3">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="diarios" className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Calendario de pagos diarios
              </TabsTrigger>
              <TabsTrigger value="proveedores" className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> Pago proveedores
              </TabsTrigger>
              <TabsTrigger value="fijos" className="flex items-center gap-1.5">
                <Repeat className="h-4 w-4" /> Pagos fijos
              </TabsTrigger>
              <TabsTrigger value="cronograma" className="flex items-center gap-1.5">
                <GanttChartSquare className="h-4 w-4" /> Cronograma
              </TabsTrigger>
              <TabsTrigger value="bitacora" className="flex items-center gap-1.5">
                <ScrollText className="h-4 w-4" /> Bitácora
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="diarios" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <CalendarGrid
              month={month}
              today={today}
              byDate={allByDate}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onViewDetail={setDetailPayment}
              onViewDay={setDayDialog}
            />
          </TabsContent>
          <TabsContent value="proveedores" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <p className="text-xs text-muted-foreground max-w-xl">
                Gastos aprobados: sin programar, en calendario (impagos) o ya pagados.
                Filtrá por estado para ver cada cola.
              </p>
              <div className="flex items-center gap-2">
                <label htmlFor="proveedor-status-filter" className="text-xs text-muted-foreground whitespace-nowrap">
                  Estado
                </label>
                <select
                  id="proveedor-status-filter"
                  className="h-9 border rounded-md px-2 text-sm bg-background"
                  value={proveedorStatusFilter}
                  onChange={(e) =>
                    setProveedorStatusFilter(
                      e.target.value as "all" | "unscheduled" | "scheduled_unpaid" | "paid",
                    )
                  }
                >
                  <option value="all">Todos</option>
                  <option value="unscheduled">Sin programar</option>
                  <option value="scheduled_unpaid">En calendario</option>
                  <option value="paid">Pagado</option>
                </select>
              </div>
            </div>
            {proveedoresError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive flex flex-wrap items-center gap-3">
                <span>
                  No se pudo cargar la cola de proveedores
                  {proveedoresErr instanceof Error ? `: ${proveedoresErr.message}` : "."}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetchProveedores()}>
                  Reintentar
                </Button>
              </div>
            ) : proveedoresFetching && proveedores.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center animate-pulse">Cargando…</p>
            ) : proveedoresVisible.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {proveedores.length === 0
                  ? "No hay gastos pendientes de programar ni de pagar."
                  : proveedorStatusFilter !== "all"
                    ? "Ningún gasto con ese estado."
                    : "Ningún gasto coincide con la búsqueda de OC."}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Detalle</th>
                      <th className="px-3 py-2 font-medium">OC</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Cía</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium text-right">Monto</th>
                      <th className="px-3 py-2 font-medium">Fecha de pago</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {proveedoresVisible.map((e) => {
                      const dateValue = scheduleDates[e.id] ?? e.paymentDate ?? "";
                      return (
                        <tr key={e.id} className="align-middle">
                          <td className="px-3 py-2 max-w-[280px]">
                            <div className="font-medium truncate" title={e.description}>
                              {e.description}
                            </div>
                            {e.budgetSlices && e.budgetSlices > 1 && (
                              <div className="text-xs text-muted-foreground">
                                {e.budgetSlices} meses en presupuesto · 1 pago
                              </div>
                            )}
                            {e.notes && (
                              <div className="text-xs text-muted-foreground truncate">{e.notes}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            {e.referenceNumber || "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{e.type}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{e.company ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {e.status === "unscheduled" ? (
                              <span className="text-xs font-medium text-amber-700">Sin programar</span>
                            ) : e.status === "paid" ? (
                              <span className="text-xs font-medium text-emerald-700">Pagado</span>
                            ) : (
                              <span className="text-xs font-medium text-sky-700">En calendario</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                            {formatCurrency(e.amount)}
                          </td>
                          <td className="px-3 py-2">
                            {e.status === "paid" ? (
                              <span className="text-xs text-muted-foreground">
                                {e.paymentDate ? formatDate(e.paymentDate) : "—"}
                              </span>
                            ) : (
                              <Input
                                type="date"
                                className="h-8 w-[150px]"
                                value={dateValue}
                                disabled={!canEdit || scheduleMutation.isPending}
                                onChange={(ev) =>
                                  setScheduleDates((prev) => ({
                                    ...prev,
                                    [e.id]: ev.target.value,
                                  }))
                                }
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {canEdit && e.status !== "paid" && (
                              <Button
                                size="sm"
                                disabled={!dateValue || scheduleMutation.isPending}
                                onClick={() =>
                                  scheduleMutation.mutate({
                                    expenseId: e.id,
                                    expenseIds: e.expenseIds?.length ? e.expenseIds : [e.id],
                                    paymentDate: dateValue,
                                  })
                                }
                              >
                                {e.status === "unscheduled" ? "Asignar fecha" : "Actualizar fecha"}
                              </Button>
                            )}
                            {e.status === "paid" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const fromCal = e.paymentId
                                    ? calendar
                                        .flatMap((d) => d.payments)
                                        .find((p) => p.id === e.paymentId)
                                    : undefined;
                                  if (fromCal) {
                                    setDetailPayment(fromCal);
                                    return;
                                  }
                                  if (e.paymentDate) {
                                    const targetMonth = monthFromPaymentDate(e.paymentDate);
                                    if (targetMonth) setMonth(targetMonth);
                                  }
                                  toast.info(
                                    "Pago marcado — abrí el calendario en esa fecha o buscá por OC",
                                  );
                                }}
                              >
                                Ver pago
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="fijos" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <p className="text-xs text-muted-foreground mb-3">
              Gastos fijos recurrentes sincronizados desde Oracle (APEX). El estado pagado/pendiente se guarda localmente.
            </p>
            <CalendarGrid
              month={month}
              today={today}
              byDate={fixedByDate}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onViewDetail={setDetailPayment}
              onViewDay={setDayDialog}
            />
          </TabsContent>
          <TabsContent value="cronograma" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <CronogramaGrid
              month={month}
              today={today}
              calendar={calendar}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onViewDetail={setDetailPayment}
            />
          </TabsContent>
          <TabsContent value="bitacora" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <PagosBitacoraTable
              logs={bitacoraGlobal}
              loading={bitacoraFetching}
            />
          </TabsContent>
        </Tabs>
      </Card>

      <PaymentDetailDialog
        payment={detailPayment}
        onClose={() => setDetailPayment(null)}
        canEdit={canEdit}
        onTogglePaid={(id, paid) => {
          markMutation.mutate(
            { id, paid },
            {
              onSuccess: () => {
                setDetailPayment((prev) =>
                  prev && prev.id === id
                    ? { ...prev, paid, paidAt: paid ? new Date().toISOString() : null }
                    : prev,
                );
              },
            },
          );
        }}
        onUpdated={(p) => {
          setDetailPayment(p);
          queryClient.invalidateQueries({ queryKey: ["pagos"] });
          queryClient.invalidateQueries({ queryKey: ["pagos-bitacora-global"] });
        }}
      />

      <DayPaymentsDialog
        day={dayDialog}
        onClose={() => setDayDialog(null)}
        canEdit={canEdit}
        onViewDetail={setDetailPayment}
        onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      {/* Dialog nuevo pago */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar pago manual</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Descripción *</Label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Ej. Pago proveedor, arriendo…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Monto (₡) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  placeholder="0.00"
                />
                {draft.ocs.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Suma de {draft.ocs.length} OC: {formatCurrency(sumPaymentOcMontos(draft.ocs))} (editable)
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={draft.paymentDate}
                  onChange={(e) => setDraft((d) => ({ ...d, paymentDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Compañía</Label>
              <Input
                value={draft.company}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                placeholder="Ej. 01"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>N° OC (Pago proveedores)</Label>
              <PaymentOcMultiPicker
                items={draft.ocs}
                options={proveedorOcOptions}
                loading={proveedoresFetching}
                company={draft.company || undefined}
                onChange={(ocs) => setDraft((d) => applyOcsToDraft(d, ocs))}
              />
              <p className="text-xs text-muted-foreground">
                Las OC se eligen de la cola «Pago proveedores» y quedan ligadas automáticamente.
                Varias OC = un solo movimiento con la suma; al guardar salen de la cola.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Categoría</Label>
                <select
                  className="h-9 border rounded-md px-2 text-sm bg-background"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      category: e.target.value,
                      subcategory: "",
                    }))
                  }
                >
                  <option value="">Sin clasificar</option>
                  {PAYMENT_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label>Subcategoría</Label>
                <select
                  className="h-9 border rounded-md px-2 text-sm bg-background"
                  value={draft.subcategory}
                  onChange={(e) => setDraft((d) => ({ ...d, subcategory: e.target.value }))}
                  disabled={!draft.category}
                >
                  <option value="">{draft.category ? "Elegí…" : "Primero la categoría"}</option>
                  {draftSubcategoryOptions.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notas</Label>
              <Input
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); setDraft(EMPTY_DRAFT); }}>
              Cancelar
            </Button>
            <Button onClick={submitNew} disabled={createMutation.isPending}>
              Guardar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatBitacoraValue(field: string, value: string | null): string {
  if (value == null || value === "") return "—";
  if (field === "amount") {
    const n = Number(value);
    return Number.isFinite(n) ? formatCurrency(n) : value;
  }
  if (field === "paymentDate") return formatDate(value);
  return value;
}

function PagosBitacoraTable({
  logs,
  loading,
}: {
  logs: PaymentChangeLogDto[];
  loading: boolean;
}) {
  if (loading && logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center animate-pulse">
        Cargando bitácora…
      </p>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        Aún no hay cambios registrados en pagos.
      </p>
    );
  }

  return (
    <div className="w-full overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur text-left text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 whitespace-nowrap">Fecha</th>
            <th className="px-3 py-2.5">Pago</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Campo</th>
            <th className="px-3 py-2.5">Dato anterior</th>
            <th className="px-3 py-2.5">Dato nuevo</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Usuario</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t hover:bg-muted/40">
              <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground align-top">
                {formatDateTime(log.createdAt)}
              </td>
              <td className="px-3 py-2 align-top">
                <div className="font-medium leading-snug max-w-[280px] truncate" title={log.paymentDescription ?? undefined}>
                  {log.paymentDescription ?? "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {log.paymentSource ? (FUENTE_LABEL[log.paymentSource as PagoFuente] ?? log.paymentSource) : ""}
                  {log.paymentCompany ? ` · ${log.paymentCompany}` : ""}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap align-top font-medium">
                {log.fieldLabel}
              </td>
              <td className="px-3 py-2 align-top text-muted-foreground">
                {formatBitacoraValue(log.field, log.previousValue)}
              </td>
              <td className="px-3 py-2 align-top font-medium">
                {formatBitacoraValue(log.field, log.newValue)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap align-top">
                {log.changedByName ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function monthOptions(): [string, string][] {
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  const out: [string, string][] = [];
  for (let i = 0; i < 36; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
    out.push([val, label]);
  }
  return out;
}

function CalendarGrid({
  month, today, byDate, canEdit, onTogglePaid, onDelete, onViewDetail, onViewDay,
}: {
  month: string;
  today: string;
  byDate: Map<string, CalendarDay>;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
  onViewDetail: (p: PagoDto) => void;
  onViewDay: (day: CalendarDay) => void;
}) {
  const cells = daysInGrid(month);
  const weeks = chunkWeeks(cells);
  const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  const monthTotals = useMemo(
    () => aggregateCells(cells, byDate, true),
    [cells, byDate],
  );

  return (
    <div className="w-full space-y-1">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayLabels.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-muted-foreground py-1">
            {w}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => {
        const weekTotals = aggregateCells(week, byDate, true);
        const inMonthDays = week.filter((c) => c.inMonth);
        const rangeLabel =
          inMonthDays.length > 0
            ? `${inMonthDays[0].dayOfMonth}–${inMonthDays[inMonthDays.length - 1].dayOfMonth}`
            : "";

        return (
          <Fragment key={`week-${weekIndex}`}>
            <div className="grid grid-cols-7 gap-1">
              {week.map((cell) => {
                const dayData = byDate.get(cell.date);
                const payments = dayData?.payments ?? [];
                const total = dayData?.total ?? 0;
                const totalPaid = dayData?.totalPaid ?? 0;
                const pending = total - totalPaid;
                const isToday = cell.date === today;

                return (
                  <div
                    key={cell.date}
                    className={[
                      "min-h-[108px] rounded-md border p-1.5 flex flex-col gap-1",
                      cell.inMonth ? "bg-card" : "bg-muted/30 opacity-60",
                      isToday ? "ring-2 ring-primary/60" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={[
                          "text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full shrink-0",
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                        ].join(" ")}
                      >
                        {cell.dayOfMonth}
                      </span>
                      {total > 0 && (
                        <div className="min-w-0 flex-1">
                          <AmountPair pending={pending} paid={totalPaid} size="sm" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 flex-1 overflow-hidden">
                      {payments.slice(0, 3).map((p) => (
                        <PaymentRow
                          key={p.id}
                          p={p}
                          canEdit={canEdit}
                          onTogglePaid={onTogglePaid}
                          onDelete={onDelete}
                          onViewDetail={onViewDetail}
                        />
                      ))}
                      {payments.length > 3 && (
                        <button
                          type="button"
                          className="text-[10px] text-primary font-medium px-1 py-0.5 rounded hover:bg-primary/10 text-left w-full"
                          onClick={() => dayData && onViewDay(dayData)}
                        >
                          +{payments.length - 3} más…
                        </button>
                      )}
                      {payments.length === 0 && (
                        <div className="text-[11px] text-muted-foreground/60 px-1 py-0.5">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {(weekTotals.total > 0 || inMonthDays.length > 0) && (
              <CalendarTotalsBar
                label={`Semana ${weekIndex + 1}${rangeLabel ? ` (${rangeLabel})` : ""}`}
                totals={weekTotals}
                variant="week"
              />
            )}
          </Fragment>
        );
      })}

      <CalendarTotalsBar label="Total del mes" totals={monthTotals} variant="month" />
    </div>
  );
}

function PaymentRow({
  p, canEdit, onTogglePaid, onDelete, onViewDetail, compact,
}: {
  p: PagoDto;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
  onViewDetail: (p: PagoDto) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "group relative rounded px-1 py-0.5 text-[11px] leading-tight",
        p.paid ? "bg-emerald-50 text-emerald-800" : "bg-background hover:bg-muted",
      ].join(" ")}
      title={`${p.description} — ${formatCurrency(p.amount)}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="shrink-0"
          onClick={() => canEdit && onTogglePaid(p.id, !p.paid)}
          disabled={!canEdit}
          aria-label={p.paid ? "Marcar pendiente" : "Marcar pagado"}
        >
          {p.paid ? (
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          ) : (
            <Circle className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <button
          type="button"
          className="truncate flex-1 text-left"
          onClick={() => onViewDetail(p)}
        >
          {p.description}
        </button>
        <Badge className={["h-4 px-1 text-[9px] shrink-0", FUENTE_BADGE[p.source]].join(" ")}>
          {FUENTE_LABEL[p.source]}
        </Badge>
        <button
          type="button"
          className={[
            "shrink-0 text-muted-foreground hover:text-foreground",
            compact ? "" : "opacity-60 group-hover:opacity-100",
          ].join(" ")}
          onClick={() => onViewDetail(p)}
          aria-label="Ver detalle"
          title="Ver detalle"
        >
          <Eye className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        className="pl-4 text-[10px] font-medium text-left w-full"
        onClick={() => onViewDetail(p)}
      >
        {formatCurrency(p.amount)}
        <span className="text-muted-foreground font-normal">
          {p.company ? ` · ${p.company}` : ""}
          {p.subcategory
            ? ` · ${paymentSubcategoryLabel(p.category, p.subcategory) ?? p.subcategory}`
            : ""}
        </span>
      </button>
      {canEdit && p.source === "MANUAL" && (
        <button
          className="absolute top-0.5 right-5 hidden group-hover:inline-flex text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
          aria-label="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

type ExpenseSummary = {
  type?: string;
  description?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  registroCxp?: string | null;
  registroTr?: string | null;
  approvalStatus?: string;
};

function PaymentDetailDialog({
  payment,
  onClose,
  canEdit,
  onTogglePaid,
  onUpdated,
}: {
  payment: PagoDto | null;
  onClose: () => void;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onUpdated: (p: PagoDto) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"detalle" | "bitacora">("detalle");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");

  useEffect(() => {
    if (!payment) return;
    setAmount(String(payment.amount));
    setPaymentDate(calendarDateInputValue(payment.paymentDate));
    setNotes(payment.notes ?? "");
    setDescription(payment.description);
    setReferenceNumber(payment.referenceNumber ?? "");
    setCategory(payment.category ?? "");
    setSubcategory(payment.subcategory ?? "");
    setTab("detalle");
  }, [payment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const subcategoryOptions = useMemo(() => subcategoriesFor(category || null), [category]);

  const { data: expenseExtra } = useQuery({
    queryKey: ["pagos-expense-detail", payment?.expenseId],
    enabled: !!payment?.expenseId,
    queryFn: async () => {
      const res = await fetch(`/api/expenses/${payment!.expenseId}`);
      if (!res.ok) return null;
      const json = await res.json();
      const e = json.data ?? json;
      return {
        type: e.type,
        description: e.description,
        referenceNumber: e.referenceNumber,
        notes: e.notes,
        registroCxp: e.registroCxp,
        registroTr: e.registroTr,
        approvalStatus: e.approvalStatus,
      } as ExpenseSummary;
    },
  });

  const { data: bitacora = [], isFetching: bitacoraLoading } = useQuery({
    queryKey: ["pagos-bitacora", payment?.id],
    enabled: !!payment?.id && tab === "bitacora",
    queryFn: async () => {
      const res = await fetch(`/api/pagos/${payment!.id}/bitacora`);
      if (!res.ok) throw new Error("Error al cargar bitácora");
      const json = await res.json();
      return (json.data ?? json) as PaymentChangeLogDto[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!payment) throw new Error("Sin pago");
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error("Monto inválido");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        throw new Error("Fecha de pago inválida");
      }
      const res = await fetch(`/api/pagos/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          paymentDate,
          notes,
          description: description.trim(),
          referenceNumber: referenceNumber.trim(),
          category: category || null,
          subcategory: subcategory || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "No se pudo guardar");
      }
      const json = await res.json();
      return (json.data ?? json) as PagoDto;
    },
    onSuccess: (p) => {
      toast.success("Pago actualizado");
      onUpdated(p);
      queryClient.invalidateQueries({ queryKey: ["pagos-bitacora", p.id] });
      queryClient.invalidateQueries({ queryKey: ["pagos-bitacora-global"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar"),
  });

  const p = payment;
  const dirty =
    !!p &&
    (Number(amount) !== p.amount ||
      calendarDateInputValue(p.paymentDate) !== paymentDate ||
      (p.notes ?? "") !== notes ||
      p.description !== description.trim() ||
      (p.referenceNumber ?? "") !== referenceNumber.trim() ||
      (p.category ?? "") !== category ||
      (p.subcategory ?? "") !== subcategory);

  return (
    <Dialog open={!!p} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,780px)] flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span>Detalle del pago</span>
            {p && (
              <Badge className={FUENTE_BADGE[p.source]}>
                {FUENTE_LABEL[p.source]}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {p && (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "detalle" | "bitacora")}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="mx-0 mb-2 shrink-0 self-start">
              <TabsTrigger value="detalle">Detalle</TabsTrigger>
              <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
            </TabsList>

            <TabsContent value="detalle" className="flex-1 min-h-0 overflow-y-auto space-y-4 mt-0 data-[state=inactive]:hidden">
              {canEdit ? (
                <div className="grid gap-3 text-sm rounded-lg border p-4">
                  <div className="grid gap-1.5">
                    <Label>Detalle de la compra</Label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Número(s) de OC</Label>
                    <Input
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="Ej. 12345, 67890"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Monto (₡)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Fecha de pago</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label>Categoría</Label>
                      <select
                        className="h-9 border rounded-md px-2 text-sm bg-background"
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setSubcategory("");
                        }}
                      >
                        <option value="">Sin clasificar</option>
                        {PAYMENT_CATEGORIES.map((c) => (
                          <option key={c.key} value={c.key}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Subcategoría</Label>
                      <select
                        className="h-9 border rounded-md px-2 text-sm bg-background"
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        disabled={!category}
                      >
                        <option value="">{category ? "Elegí…" : "Primero la categoría"}</option>
                        {subcategoryOptions.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Notas</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground pt-1">
                    <div>
                      Compañía: <span className="font-medium text-foreground">{p.company ?? "—"}</span>
                    </div>
                    <div>
                      Estado:{" "}
                      <span className={p.paid ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
                        {p.paid ? "Pagado" : "Pendiente"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-lg p-4">
                  <DetailField label="Detalle de la compra" value={p.description || "—"} className="col-span-2" />
                  <DetailField label="Número de OC" value={p.referenceNumber?.trim() || "—"} className="col-span-2" />
                  <DetailField label="Monto" value={formatCurrency(p.amount)} emphasize />
                  <DetailField label="Fecha de pago" value={formatDate(p.paymentDate)} />
                  <DetailField
                    label="Categoría"
                    value={paymentCategoryLabel(p.category) ?? "Sin clasificar"}
                  />
                  <DetailField
                    label="Subcategoría"
                    value={paymentSubcategoryLabel(p.category, p.subcategory) ?? "—"}
                  />
                  <DetailField label="Compañía" value={p.company ?? "—"} />
                  <DetailField
                    label="Estado"
                    value={p.paid ? "Pagado" : "Pendiente"}
                    valueClassName={p.paid ? "text-emerald-600" : "text-amber-600"}
                  />
                  {p.notes && (
                    <DetailField label="Notas" value={p.notes} className="col-span-2" />
                  )}
                </div>
              )}

              {p.paidAt && (
                <p className="text-xs text-muted-foreground px-1">
                  Marcado pagado el {formatDateTime(p.paidAt)}
                </p>
              )}
              {p.source === "APEX" && p.apexPagoBaseId != null && (
                <p className="text-xs text-muted-foreground px-1">Pago fijo Oracle #{p.apexPagoBaseId}</p>
              )}

              {p.source === "EXPENSE" && expenseExtra && (
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <p className="font-medium text-muted-foreground">Gasto vinculado</p>
                  {expenseExtra.type && <DetailField label="Tipo de gasto" value={expenseExtra.type} />}
                  {expenseExtra.registroCxp && (
                    <DetailField label="Registro CxP" value={expenseExtra.registroCxp} />
                  )}
                  {expenseExtra.registroTr && (
                    <DetailField label="Registro TR" value={expenseExtra.registroTr} />
                  )}
                  <Button variant="outline" size="sm" asChild className="mt-2">
                    <Link href="/expenses">Ver en Gastos</Link>
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="bitacora" className="flex-1 min-h-0 overflow-y-auto mt-0 data-[state=inactive]:hidden">
              {bitacoraLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center animate-pulse">Cargando bitácora…</p>
              ) : bitacora.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Sin cambios registrados todavía.
                </p>
              ) : (
                <div className="space-y-2 py-1">
                  {bitacora.map((log) => (
                    <div key={log.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{log.fieldLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1.5 grid gap-0.5 text-xs">
                        <div>
                          <span className="text-muted-foreground">Anterior: </span>
                          <span className="font-medium">
                            {log.field === "amount" && log.previousValue
                              ? formatCurrency(Number(log.previousValue))
                              : log.field === "paymentDate" && log.previousValue
                                ? formatDate(log.previousValue)
                                : (log.previousValue ?? "—")}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Nuevo: </span>
                          <span className="font-medium">
                            {log.field === "amount" && log.newValue
                              ? formatCurrency(Number(log.newValue))
                              : log.field === "paymentDate" && log.newValue
                                ? formatDate(log.newValue)
                                : (log.newValue ?? "—")}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Por {log.changedByName ?? "usuario desconocido"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="shrink-0 gap-2 sm:gap-0 pt-3">
          {p && canEdit && tab === "detalle" && (
            <>
              <Button
                variant={p.paid ? "outline" : "default"}
                onClick={() => onTogglePaid(p.id, !p.paid)}
              >
                {p.paid ? "Marcar pendiente" : "Marcar pagado"}
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!dirty || saveMutation.isPending}
              >
                Guardar cambios
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({
  label,
  value,
  emphasize,
  valueClassName,
  className,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={[
        emphasize ? "font-semibold text-base" : "font-medium",
        valueClassName,
      ].filter(Boolean).join(" ")}>
        {value}
      </p>
    </div>
  );
}

function DayPaymentsDialog({
  day,
  onClose,
  canEdit,
  onViewDetail,
  onTogglePaid,
  onDelete,
}: {
  day: CalendarDay | null;
  onClose: () => void;
  canEdit: boolean;
  onViewDetail: (p: PagoDto) => void;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const pending = day ? day.total - day.totalPaid : 0;

  return (
    <Dialog open={!!day} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[min(90vh,800px)] flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            Pagos del {day ? formatDate(day.date) : ""}
          </DialogTitle>
        </DialogHeader>

        {day && (
          <>
            <div className="flex flex-wrap gap-4 text-sm py-2 shrink-0 border-b">
              <span>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold">{formatCurrency(day.total)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Pagado: </span>
                <span className="font-semibold text-emerald-600">{formatCurrency(day.totalPaid)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Pendiente: </span>
                <span className="font-semibold text-amber-600">{formatCurrency(pending)}</span>
              </span>
              <span className="text-muted-foreground">
                {day.payments.length} pago{day.payments.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2">
              {day.payments.map((p) => (
                <PaymentRow
                  key={p.id}
                  p={p}
                  canEdit={canEdit}
                  onTogglePaid={onTogglePaid}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  compact
                />
              ))}
            </div>
          </>
        )}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Cronograma (Gantt) del mes: barras por día sobre la línea de tiempo. */
function CronogramaGrid({
  month, today, calendar, canEdit, onTogglePaid, onDelete, onViewDetail,
}: {
  month: string;
  today: string;
  calendar: CalendarDay[];
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
  onViewDetail: (p: PagoDto) => void;
}) {
  const [y, m, totalDays] = useMemo(() => {
    const [yy, mm] = month.split("-").map(Number);
    return [yy, mm, new Date(yy, mm, 0).getDate()];
  }, [month]);

  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);
  const todayNum = useMemo(() => {
    const t = new Date(today + "T00:00:00Z");
    return t.getUTCFullYear() === y && t.getUTCMonth() + 1 === m ? t.getUTCDate() : null;
  }, [today, y, m]);

  const allPayments = useMemo(() => {
    const flat: (PagoDto & { day: number })[] = [];
    for (const day of calendar) {
      const dd = Number(day.date.split("-")[2]);
      for (const p of day.payments) flat.push({ ...p, day: dd });
    }
    return flat.sort((a, b) => a.day - b.day || a.amount - b.amount);
  }, [calendar]);

  const gridCols = `minmax(150px, 220px) repeat(${totalDays}, minmax(22px, 1fr))`;
  const gridMinWidth = 160 + totalDays * 24;

  return (
    <div className="w-full min-h-0">
      <div
        className="grid gap-px rounded-t-md border bg-muted/20 sticky top-0 z-20 shadow-sm"
        style={{ gridTemplateColumns: gridCols, minWidth: gridMinWidth }}
      >
        <div className="p-2 text-xs font-semibold text-muted-foreground sticky left-0 top-0 z-30 bg-background">
          Día / Pago
        </div>
        {days.map((d) => (
          <div
            key={d}
            className={[
              "p-1.5 text-center text-[11px] font-semibold bg-background",
              d === todayNum ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            ].join(" ")}
          >
            {d}
          </div>
        ))}
      </div>

      {allPayments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border border-t-0 rounded-b-md">
          Sin pagos para este mes.
        </div>
      ) : (
        <div
          className="grid gap-px rounded-b-md border border-t-0 bg-muted/20"
          style={{ gridTemplateColumns: gridCols, minWidth: gridMinWidth }}
        >
          {allPayments.map((p) => (
            <CronogramRow
              key={p.id}
              p={p}
              totalDays={totalDays}
              todayNum={todayNum}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => onTogglePaid(id, paid)}
              onDelete={(id) => onDelete(id)}
              onViewDetail={onViewDetail}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-emerald-100 border border-emerald-400" /> Pagado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-400" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-sky-100 border border-sky-400" /> Gasto aprobado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-50 border border-amber-300" /> E. fijo APEX
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-violet-100 border border-violet-400" /> Manual
        </span>
        {todayNum && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-primary" /> Hoy
          </span>
        )}
        <span className="ml-auto">Clic en la barra para marcar pagado/pendiente</span>
      </div>
    </div>
  );
}

function CronogramRow({
  p, totalDays, todayNum, canEdit, onTogglePaid, onDelete, onViewDetail,
}: {
  p: PagoDto & { day: number };
  totalDays: number;
  todayNum: number | null;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
  onViewDetail: (p: PagoDto) => void;
}) {
  const cellBg = p.paid ? "bg-emerald-50" : "bg-amber-50";

  return (
    <>
      <div className={["p-2 flex items-center gap-1.5 sticky left-0 z-10", cellBg].join(" ")}>
        <Badge className={["h-4 px-1 text-[9px] shrink-0", FUENTE_BADGE[p.source]].join(" ")}>
          {FUENTE_LABEL[p.source]}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium">{p.description}</div>
          <div className="text-[10px] text-muted-foreground">
            {formatCurrency(p.amount)}
            {p.company ? ` · ${p.company}` : ""}
          </div>
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => onViewDetail(p)}
          aria-label="Ver detalle"
          title="Ver detalle"
        >
          <Eye className="h-3 w-3" />
        </button>
        {canEdit && p.source === "MANUAL" && (
          <button
            className="text-destructive hover:opacity-70 shrink-0"
            onClick={() => onDelete(p.id)}
            aria-label="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {Array.from({ length: totalDays }, (_, i) => {
        const dayNum = i + 1;
        const isPayday = dayNum === p.day;
        const isToday = dayNum === todayNum;
        const bg = isPayday
          ? p.paid
            ? "bg-emerald-400/70 ring-1 ring-emerald-500"
            : "bg-amber-400/70 ring-1 ring-amber-500"
          : isToday
            ? "bg-primary/15"
            : "bg-transparent";
        return (
          <button
            key={dayNum}
            onClick={() => canEdit && isPayday && onTogglePaid(p.id, !p.paid)}
            title={isPayday ? `${p.description} — ${formatCurrency(p.amount)} (${p.paid ? "pagado" : "pendiente"})` : undefined}
            disabled={!canEdit || !isPayday}
            className={["min-h-[34px] transition-colors", bg, canEdit && isPayday && "cursor-pointer hover:opacity-80"].join(" ")}
          />
        );
      })}
    </>
  );
}