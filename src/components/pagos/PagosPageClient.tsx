"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Receipt, Pencil, Trash2, CalendarDays, GanttChartSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils/format";
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

function parseDay(iso: string): { day: string; month: string } {
  const [y, m, dd] = iso.split("-");
  return { day: dd, month: `${y}-${m}` };
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

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of calendar) map.set(day.date, day);
    return map;
  }, [calendar]);

  const monthTotal = useMemo(() => calendar.reduce((s, d) => s + d.total, 0), [calendar]);
  const monthPaid = useMemo(() => calendar.reduce((s, d) => s + d.totalPaid, 0), [calendar]);

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
            Gastos aprobados, gastos fijos y pagos manuales
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
          <span className="font-semibold text-amber-600">{formatCurrency(monthTotal - monthPaid)}</span>
          <span className="text-muted-foreground">Pagado:</span>
          <span className="font-semibold text-emerald-600">{formatCurrency(monthPaid)}</span>
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{formatCurrency(monthTotal)}</span>
          {isFetching && <span className="text-xs text-muted-foreground animate-pulse">cargando…</span>}
        </div>
      </div>

      {/* Vistas */}
      <Card className="flex-1 min-h-0 overflow-auto">
        <Tabs defaultValue="calendario" className="h-full flex flex-col">
          <div className="px-3 pt-3">
            <TabsList>
              <TabsTrigger value="calendario" className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Calendario
              </TabsTrigger>
              <TabsTrigger value="cronograma" className="flex items-center gap-1.5">
                <GanttChartSquare className="h-4 w-4" /> Cronograma
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="calendario" className="flex-1 min-h-0 overflow-auto p-3 pt-3">
            <CalendarGrid
              month={month}
              today={today}
              byDate={byDate}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => markMutation.mutate({ id, paid })}
              onDelete={(id) => deleteMutation.mutate(id)}
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
            />
          </TabsContent>
        </Tabs>
      </Card>

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
  month, today, byDate, canEdit, onTogglePaid, onDelete,
}: {
  month: string;
  today: string;
  byDate: Map<string, CalendarDay>;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
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
                  />
                ))}
                {payments.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{payments.length - 3} más…
                  </span>
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
  p, canEdit, onTogglePaid, onDelete,
}: {
  p: PagoDto;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={[
        "group relative rounded px-1 py-0.5 text-[11px] leading-tight cursor-pointer",
        p.paid ? "bg-emerald-50 text-emerald-800" : "bg-background hover:bg-muted",
      ].join(" ")}
      title={`${p.description} — ${formatCurrency(p.amount)}`}
      onClick={() => canEdit && onTogglePaid(p.id, !p.paid)}
    >
      <div className="flex items-center gap-1">
        {p.paid ? (
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
        ) : (
          <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate flex-1">{p.description}</span>
        <Badge className={["h-4 px-1 text-[9px]", FUENTE_BADGE[p.source]].join(" ")}>
          {FUENTE_LABEL[p.source]}
        </Badge>
      </div>
      <div className="pl-4 text-[10px] font-medium">
        {formatCurrency(p.amount)}
        <span className="text-muted-foreground font-normal">
          {p.company ? ` · ${p.company}` : ""}
        </span>
      </div>
      {canEdit && p.source === "MANUAL" && (
        <button
          className="absolute top-0.5 right-0.5 hidden group-hover:inline-flex text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
          aria-label="Eliminar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Cronograma (Gantt) del mes: barras por día sobre la línea de tiempo. */
function CronogramaGrid({
  month, today, calendar, canEdit, onTogglePaid, onDelete,
}: {
  month: string;
  today: string;
  calendar: CalendarDay[];
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
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

  // Todos los pagos del mes aplanados, ordenados por día
  const allPayments = useMemo(() => {
    const flat: (PagoDto & { day: number })[] = [];
    for (const day of calendar) {
      const dd = Number(day.date.split("-")[2]);
      for (const p of day.payments) flat.push({ ...p, day: dd });
    }
    return flat.sort((a, b) => a.day - b.day || a.amount - b.amount);
  }, [calendar]);

  const gridCols = `minmax(150px, 220px) repeat(${totalDays}, minmax(22px, 1fr))`;

  return (
    <div className="w-full overflow-auto">
      {/* Encabezado de días */}
      <div className="grid gap-px rounded-md border bg-muted/20" style={{ gridTemplateColumns: gridCols, minWidth: 160 + totalDays * 24 }}>
        <div className="p-2 text-xs font-semibold text-muted-foreground sticky left-0 bg-background z-10">
          Día / Pago
        </div>
        {days.map((d) => (
          <div
            key={d}
            className={[
              "p-1.5 text-center text-[11px] font-semibold items-center justify-center",
              d === todayNum ? "bg-primary text-primary-foreground rounded" : "text-muted-foreground",
            ].join(" ")}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Filas de pagos */}
      {allPayments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Sin pagos para este mes.
        </div>
      ) : (
        <div className="mt-2 grid gap-px rounded-md border bg-muted/20" style={{ gridTemplateColumns: gridCols, minWidth: 160 + totalDays * 24 }}>
          {allPayments.map((p) => (
            <CronogramRow
              key={p.id}
              p={p}
              totalDays={totalDays}
              todayNum={todayNum}
              canEdit={canEdit}
              onTogglePaid={(id, paid) => onTogglePaid(id, paid)}
              onDelete={(id) => onDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Leyenda */}
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
  p, totalDays, todayNum, canEdit, onTogglePaid, onDelete,
}: {
  p: PagoDto & { day: number };
  totalDays: number;
  todayNum: number | null;
  canEdit: boolean;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const cellBg = p.paid ? "bg-emerald-50" : "bg-amber-50";

  return (
    <>
      {/* Etiqueta del pago */}
      <div className={["p-2 flex items-center gap-1.5 sticky left-0", cellBg].join(" ")}>
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

      {/* Barra de tiempo (celdas por día) */}
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