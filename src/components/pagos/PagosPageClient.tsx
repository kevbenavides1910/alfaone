"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Eye, Trash2, CalendarDays, Repeat } from "lucide-react";
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
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";

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

interface NewPaymentDraft {
  description: string;
  amount: string;
  paymentDate: string;
  company: string;
  referenceNumber: string;
  notes: string;
}

const EMPTY_DRAFT: NewPaymentDraft = {
  description: "",
  amount: "",
  paymentDate: "",
  company: "",
  referenceNumber: "",
  notes: "",
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
  const [activeTab, setActiveTab] = useState<"diarios" | "fijos">("diarios");

  const canEdit = useMemo(
    () => hasPermission(session, "pagos.calendario", "edit"),
    [session],
  );

  const { data: calendar = [], isFetching } = useQuery({
    queryKey: ["pagos", month, company],
    queryFn: async () => {
      const params = new URLSearchParams({ month });
      if (company && company !== "all") params.set("company", company);
      const res = await fetch(`/api/pagos?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar pagos");
      const json = await res.json();
      return json.data as CalendarDay[];
    },
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pagos"] }),
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
        throw new Error(j.message || "Error al crear pago");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      setShowNew(false);
      setDraft(EMPTY_DRAFT);
      toast.success("Pago agregado");
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
      toast.success("Pago eliminado");
    },
    onError: () => toast.error("No se pudo eliminar el pago"),
  });

  const shiftMonth = useCallback((dir: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, [month]);

  const dailyCalendar = useMemo(
    () => filterCalendar(calendar, ["EXPENSE", "MANUAL"]),
    [calendar],
  );
  const fixedCalendar = useMemo(
    () => filterCalendar(calendar, ["APEX"]),
    [calendar],
  );

  const dailyByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of dailyCalendar) map.set(day.date, day);
    return map;
  }, [dailyCalendar]);

  const fixedByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of fixedCalendar) map.set(day.date, day);
    return map;
  }, [fixedCalendar]);

  const activeCalendar = activeTab === "diarios" ? dailyCalendar : fixedCalendar;
  const { total: monthTotal, paid: monthPaid, pending: monthPending } = useMemo(
    () => calendarTotals(activeCalendar),
    [activeCalendar],
  );

  const submitNew = () => {
    if (!draft.description.trim()) return toast.error("Escribí una descripción");
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Monto inválido");
    if (!draft.paymentDate) return toast.error("Elegí la fecha del pago");
    createMutation.mutate({
      source: "MANUAL",
      description: draft.description.trim(),
      amount,
      paymentDate: draft.paymentDate,
      company: draft.company || undefined,
      referenceNumber: draft.referenceNumber || undefined,
      notes: draft.notes || undefined,
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
            Pagos diarios (gastos aprobados y manuales) y pagos fijos de Oracle
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar pago manual
          </Button>
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
        </select>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Pendiente:</span>
          <span className="font-semibold text-amber-600">{formatCurrency(monthPending)}</span>
          <span className="text-muted-foreground">Pagado:</span>
          <span className="font-semibold text-emerald-600">{formatCurrency(monthPaid)}</span>
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{formatCurrency(monthTotal)}</span>
          {isFetching && <span className="text-xs text-muted-foreground animate-pulse">cargando…</span>}
        </div>
      </div>

      {/* Vistas */}
      <Card className="flex-1 min-h-0 overflow-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "diarios" | "fijos")} className="h-full flex flex-col">
          <div className="px-3 pt-3">
            <TabsList>
              <TabsTrigger value="diarios" className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Calendario de pagos diarios
              </TabsTrigger>
              <TabsTrigger value="fijos" className="flex items-center gap-1.5">
                <Repeat className="h-4 w-4" /> Pagos fijos
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="diarios" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <CalendarGrid
              month={month}
              today={today}
              byDate={dailyByDate}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
              onDelete={(id) => deleteMutation.mutate(id)}
              onViewDetail={setDetailPayment}
              onViewDay={setDayDialog}
            />
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
        </Tabs>
      </Card>

      <PaymentDetailDialog
        payment={detailPayment}
        onClose={() => setDetailPayment(null)}
        canEdit={canEdit}
        onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
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
        <DialogContent className="sm:max-w-md">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Compañía</Label>
                <Input
                  value={draft.company}
                  onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                  placeholder="Ej. 01"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Referencia</Label>
                <Input
                  value={draft.referenceNumber}
                  onChange={(e) => setDraft((d) => ({ ...d, referenceNumber: e.target.value }))}
                  placeholder="Factura, proveedor…"
                />
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
  const weekdayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayLabels.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-muted-foreground py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const dayData = byDate.get(cell.date);
          const payments = dayData?.payments ?? [];
          const total = dayData?.total ?? 0;
          const totalPaid = dayData?.totalPaid ?? 0;
          const isToday = cell.date === today;

          return (
            <div
              key={cell.date}
              className={[
                "min-h-[96px] rounded-md border p-1.5 flex flex-col gap-1",
                cell.inMonth ? "bg-card" : "bg-muted/30 opacity-60",
                isToday ? "ring-2 ring-primary/60" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className={[
                  "text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                ].join(" ")}>
                  {cell.dayOfMonth}
                </span>
                {total > 0 && (
                  <span className={[
                    "text-[11px] font-semibold",
                    totalPaid >= total ? "text-emerald-600" : "text-amber-600",
                  ].join(" ")}>
                    {formatCurrency(totalPaid >= total ? totalPaid : total)}
                  </span>
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
}: {
  payment: PagoDto | null;
  onClose: () => void;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
}) {
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
        notes: e.notes,
        registroCxp: e.registroCxp,
        registroTr: e.registroTr,
        approvalStatus: e.approvalStatus,
      } as ExpenseSummary;
    },
  });

  const p = payment;

  return (
    <Dialog open={!!p} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] flex flex-col gap-0 overflow-hidden">
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-lg p-4">
              <DetailField label="Descripción" value={p.description} className="col-span-2" />
              <DetailField label="Monto" value={formatCurrency(p.amount)} emphasize />
              <DetailField label="Fecha de pago" value={formatDate(p.paymentDate)} />
              <DetailField label="Compañía" value={p.company ?? "—"} />
              <DetailField
                label="Estado"
                value={p.paid ? "Pagado" : "Pendiente"}
                valueClassName={p.paid ? "text-emerald-600" : "text-amber-600"}
              />
              {p.paidAt && (
                <DetailField label="Pagado el" value={formatDateTime(p.paidAt)} className="col-span-2" />
              )}
              {p.refType && <DetailField label="Tipo" value={p.refType} />}
              {p.referenceNumber && (
                <DetailField label="Referencia" value={p.referenceNumber} />
              )}
              {p.notes && (
                <DetailField label="Notas" value={p.notes} className="col-span-2" />
              )}
              {p.source === "APEX" && p.apexPagoBaseId != null && (
                <DetailField label="Pago fijo Oracle" value={`#${p.apexPagoBaseId}`} />
              )}
            </div>

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
                {expenseExtra.notes && (
                  <DetailField label="Notas del gasto" value={expenseExtra.notes} />
                )}
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link href="/expenses">Ver en Gastos</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          {p && canEdit && (
            <Button
              variant={p.paid ? "outline" : "default"}
              onClick={() => onTogglePaid(p.id, !p.paid)}
            >
              {p.paid ? "Marcar pendiente" : "Marcar pagado"}
            </Button>
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