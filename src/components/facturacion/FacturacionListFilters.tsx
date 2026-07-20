"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { FACTURA_MENSUAL_STATUS_LABELS, HIRING_TYPE_LABELS } from "@/lib/utils/constants";
import type { FacturaMensualRow } from "@/components/facturacion/FacturacionDetailDialog";

type CxcRowForFilter = {
  periodMonth: number;
  periodYear: number;
  totalCalculated: number | null;
  invoiceNumber: string | null;
  dueDate: string;
  provisionalReceiptNumber: string | null;
  provisionalPaymentAmount: number | null;
  totalAbonos?: number;
  abonos?: { receiptNumber: string | null }[];
  remainingBalance: number | null;
  hasPartialPayment: boolean;
  collectionEmailCount: number;
  cxcObservations: string | null;
  paymentPending: boolean;
  billingContact: {
    name: string;
    jobTitle: string | null;
    phone: string;
    email: string;
  } | null;
};

export type FacturacionSearchFilters = {
  search: string;
  client: string;
  licitacion: string;
  administration: string;
  zone: string;
  expectedFrom: string;
  expectedTo: string;
  issuedFrom: string;
  issuedTo: string;
  receivedFrom: string;
  receivedTo: string;
  hiring: string;
  subtotal: string;
  iva: string;
  total: string;
  lastPrice: string;
  status: string;
  modified: string;
};

export type FacturaListExpandedRow = FacturaMensualRow & {
  listKey: string;
  emisionId: string | null;
  administrationName: string | null;
  managerName: string | null;
  zoneName: string | null;
  emisionIndex: number;
  emisionTotal: number;
};

/** Una fila de lista por emisión (administración) del contrato. */
export function expandFacturasForList(rows: FacturaMensualRow[]): FacturaListExpandedRow[] {
  const out: FacturaListExpandedRow[] = [];
  for (const factura of rows) {
    const emisiones = factura.emisiones ?? [];
    if (emisiones.length === 0) {
      out.push({
        ...factura,
        listKey: factura.id,
        emisionId: null,
        administrationName: null,
        managerName: null,
        zoneName: null,
        emisionIndex: 0,
        emisionTotal: 1,
      });
      continue;
    }
    emisiones.forEach((em, idx) => {
      out.push({
        ...factura,
        listKey: `${factura.id}-${em.id}`,
        emisionId: em.id,
        administrationName: em.administrationName ?? null,
        managerName: em.managerName ?? null,
        zoneName: em.zoneName ?? null,
        emisionIndex: idx,
        emisionTotal: emisiones.length,
        status: em.status ?? factura.status,
        closedAt: em.closedAt ?? factura.closedAt,
      });
    });
  }
  return out;
}

export type CxcSearchFilters = {
  client: string;
  licitacion: string;
  issuedFrom: string;
  issuedTo: string;
  expectedPaymentFrom: string;
  expectedPaymentTo: string;
  receivedFrom: string;
  receivedTo: string;
  paidAtFrom: string;
  paidAtTo: string;
  contact: string;
  period: string;
  total: string;
  abono: string;
  invoiceNumber: string;
  dueFrom: string;
  dueTo: string;
  receipt: string;
  emailCount: string;
  observations: string;
  paymentStatus: string;
};

export const EMPTY_FACTURACION_FILTERS: FacturacionSearchFilters = {
  search: "",
  client: "",
  licitacion: "",
  administration: "",
  zone: "",
  expectedFrom: "",
  expectedTo: "",
  issuedFrom: "",
  issuedTo: "",
  receivedFrom: "",
  receivedTo: "",
  hiring: "",
  subtotal: "",
  iva: "",
  total: "",
  lastPrice: "",
  status: "all",
  modified: "all",
};

export const EMPTY_CXC_FILTERS: CxcSearchFilters = {
  client: "",
  licitacion: "",
  issuedFrom: "",
  issuedTo: "",
  expectedPaymentFrom: "",
  expectedPaymentTo: "",
  receivedFrom: "",
  receivedTo: "",
  paidAtFrom: "",
  paidAtTo: "",
  contact: "",
  period: "",
  total: "",
  abono: "",
  invoiceNumber: "",
  dueFrom: "",
  dueTo: "",
  receipt: "",
  emailCount: "",
  observations: "",
  paymentStatus: "pending",
};

function DateRange({
  label,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" className="h-9 text-sm" value={from} onChange={(e) => onFrom(e.target.value)} />
        <Input type="date" className="h-9 text-sm" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

export function FacturacionListFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: FacturacionSearchFilters;
  onChange: (next: FacturacionSearchFilters) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<FacturacionSearchFilters>) => onChange({ ...filters, ...patch });
  const hasActive =
    filters.client.trim() ||
    filters.licitacion.trim() ||
    filters.expectedFrom ||
    filters.expectedTo ||
    filters.issuedFrom ||
    filters.issuedTo ||
    filters.receivedFrom ||
    filters.receivedTo;

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Cliente</Label>
          <Input
            className="h-9"
            placeholder="Buscar por nombre…"
            value={filters.client}
            onChange={(e) => set({ client: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Nº licitación</Label>
          <Input
            className="h-9"
            placeholder="Ej. LIC-2024…"
            value={filters.licitacion}
            onChange={(e) => set({ licitacion: e.target.value })}
          />
        </div>
        <DateRange
          label="Fecha esperada de emisión"
          from={filters.expectedFrom}
          to={filters.expectedTo}
          onFrom={(v) => set({ expectedFrom: v })}
          onTo={(v) => set({ expectedTo: v })}
        />
        <DateRange
          label="Fecha de emisión / cierre"
          from={filters.issuedFrom}
          to={filters.issuedTo}
          onFrom={(v) => set({ issuedFrom: v })}
          onTo={(v) => set({ issuedTo: v })}
        />
        <DateRange
          label="Recibido conforme"
          from={filters.receivedFrom}
          to={filters.receivedTo}
          onFrom={(v) => set({ receivedFrom: v })}
          onTo={(v) => set({ receivedTo: v })}
        />
      </div>
      {hasActive ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          Limpiar búsqueda
        </Button>
      ) : null}
    </div>
  );
}

export function CxcListFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: CxcSearchFilters;
  onChange: (next: CxcSearchFilters) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<CxcSearchFilters>) => onChange({ ...filters, ...patch });
  const hasActive =
    filters.client.trim() ||
    filters.licitacion.trim() ||
    filters.issuedFrom ||
    filters.issuedTo ||
    filters.expectedPaymentFrom ||
    filters.expectedPaymentTo ||
    filters.receivedFrom ||
    filters.receivedTo;

  return (
    <div className="space-y-3 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Cliente</Label>
          <Input
            className="h-9"
            placeholder="Buscar por nombre…"
            value={filters.client}
            onChange={(e) => set({ client: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">Nº licitación</Label>
          <Input
            className="h-9"
            placeholder="Ej. LIC-2024…"
            value={filters.licitacion}
            onChange={(e) => set({ licitacion: e.target.value })}
          />
        </div>
        <DateRange
          label="Fecha de emisión"
          from={filters.issuedFrom}
          to={filters.issuedTo}
          onFrom={(v) => set({ issuedFrom: v })}
          onTo={(v) => set({ issuedTo: v })}
        />
        <DateRange
          label="Pago esperado"
          from={filters.expectedPaymentFrom}
          to={filters.expectedPaymentTo}
          onFrom={(v) => set({ expectedPaymentFrom: v })}
          onTo={(v) => set({ expectedPaymentTo: v })}
        />
        <DateRange
          label="Recibido conforme"
          from={filters.receivedFrom}
          to={filters.receivedTo}
          onFrom={(v) => set({ receivedFrom: v })}
          onTo={(v) => set({ receivedTo: v })}
        />
      </div>
      {hasActive ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          Limpiar búsqueda
        </Button>
      ) : null}
    </div>
  );
}

export const CXC_PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pendientes de cobro" },
  { value: "collected", label: "Cobradas" },
  { value: "all", label: "Todas" },
] as const;

export const FACTURACION_STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  ...(Object.entries(FACTURA_MENSUAL_STATUS_LABELS) as [
    keyof typeof FACTURA_MENSUAL_STATUS_LABELS,
    string,
  ][]).map(([value, label]) => ({ value, label })),
] as const;

export const FACTURACION_MODIFIED_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "none", label: "Sin modificación" },
  { value: "pending_amount", label: "Pendiente aprob. monto" },
  { value: "doc_corrected", label: "Doc. corregida" },
  { value: "amount_modified", label: "Monto modificado" },
  { value: "modified", label: "Modificada" },
] as const;

export type FacturaModifiedFilterValue =
  | "all"
  | "none"
  | "pending_amount"
  | "doc_corrected"
  | "amount_modified"
  | "modified";

/** Clasificación de la columna Modificada (misma lógica que los badges de la lista). */
export function getFacturaModifiedFilterValue(
  row: Pick<
    FacturaMensualRow,
    "returnRequestStatus" | "returnRequestType" | "isModifiedAfterBilling" | "lastCorrectionType"
  >
): Exclude<FacturaModifiedFilterValue, "all"> {
  if (row.returnRequestStatus === "PENDING" && row.returnRequestType !== "DOCUMENTATION") {
    return "pending_amount";
  }
  if (!row.isModifiedAfterBilling) return "none";
  if (row.lastCorrectionType === "AMOUNT") return "amount_modified";
  if (row.lastCorrectionType === "DOCUMENTATION") return "doc_corrected";
  return "modified";
}

const FILTER_INPUT =
  "w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400";

const STICKY_TH =
  "sticky top-0 z-20 bg-slate-50 align-top border-b border-slate-200 shadow-[0_1px_0_0_rgb(226,232,240)]";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function matchesFilter(value: string | null | undefined, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  return (value ?? "").toString().toLowerCase().includes(f);
}

function matchesDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Borrador inmediato en UI; `applied` va al API con debounce (solo campos de servidor). */
export function useDebouncedFilters<T extends Record<string, string>>(empty: T, delay = 400) {
  const [draft, setDraft] = useState(empty);
  const debounced = useDebouncedValue(draft, delay);
  const [applied, setApplied] = useState(empty);

  useEffect(() => {
    setApplied(debounced);
  }, [debounced]);

  const clear = useCallback(() => {
    setDraft(empty);
    setApplied(empty);
  }, [empty]);

  const isPending = JSON.stringify(draft) !== JSON.stringify(applied);

  return { draft, setDraft, applied, clear, isPending };
}

function useOpenColumnFilters() {
  const [openCols, setOpenCols] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setOpenCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const closeAll = useCallback(() => setOpenCols(new Set()), []);

  return { openCols, toggle, closeAll };
}

function ColumnTextFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative min-w-[88px]" onClick={(e) => e.stopPropagation()}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Filtrar…"}
        className={cn(FILTER_INPUT, value && "pr-7")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          title="Limpiar"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ColumnSelectFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={cn(FILTER_INPUT, "cursor-pointer")}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function ColumnDateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  return (
    <div className="space-y-1 min-w-[108px]" onClick={(e) => e.stopPropagation()}>
      <CalendarDateInput
        value={from}
        onChange={onFrom}
        title="Desde"
        placeholder="Desde"
        className={FILTER_INPUT}
      />
      <CalendarDateInput
        value={to}
        onChange={onTo}
        title="Hasta"
        placeholder="Hasta"
        className={FILTER_INPUT}
      />
    </div>
  );
}

function ColumnHeader({
  label,
  filterKey,
  openCols,
  onToggle,
  filterable = true,
  align = "left",
  active,
  className,
  children,
}: {
  label: string;
  filterKey?: string;
  openCols?: Set<string>;
  onToggle?: (key: string) => void;
  filterable?: boolean;
  align?: "left" | "right" | "center";
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const isOpen = filterKey ? openCols?.has(filterKey) : false;
  const showFilter = Boolean(children) && filterable && isOpen;

  return (
    <th className={cn(STICKY_TH, alignClass, className, "px-3 py-2 min-w-[96px]")}>
      {label && filterable && filterKey ? (
        <button
          type="button"
          onClick={() => onToggle?.(filterKey)}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap hover:text-slate-700 transition-colors mb-0",
            align === "right" && "ml-auto",
            active || isOpen ? "text-slate-700" : "text-slate-600"
          )}
          title="Clic para filtrar"
        >
          <span>{label}</span>
          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />}
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 opacity-50 transition-transform", isOpen && "rotate-180")}
          />
        </button>
      ) : label ? (
        <div
          className={cn(
            "text-xs font-semibold whitespace-nowrap",
            active ? "text-slate-700" : "text-slate-600"
          )}
        >
          {label}
        </div>
      ) : null}
      {showFilter && <div className="mt-1.5">{children}</div>}
    </th>
  );
}

export function FacturacionStickyTableHead({
  filters,
  onChange,
  onClear,
}: {
  filters: FacturacionSearchFilters;
  onChange: (next: FacturacionSearchFilters) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<FacturacionSearchFilters>) => onChange({ ...filters, ...patch });
  const hasActive = Object.entries(filters).some(([key, v]) =>
    key === "status" || key === "modified" ? v !== "all" : v.trim() !== ""
  );
  const { openCols, toggle, closeAll } = useOpenColumnFilters();

  const handleClear = () => {
    closeAll();
    onClear();
  };

  return (
    <thead>
      <tr>
        <ColumnHeader
          label="Cliente"
          filterKey="cliente"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.search.trim() || !!filters.client.trim() || !!filters.licitacion.trim()}
        >
          <div className="space-y-1">
            <ColumnTextFilter value={filters.client} onChange={(v) => set({ client: v })} placeholder="Cliente…" />
            <ColumnTextFilter
              value={filters.licitacion}
              onChange={(v) => set({ licitacion: v })}
              placeholder="Licitación…"
            />
          </div>
        </ColumnHeader>
        <ColumnHeader
          label="Administración"
          filterKey="administration"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.administration.trim()}
          className="min-w-[120px]"
        >
          <ColumnTextFilter
            value={filters.administration}
            onChange={(v) => set({ administration: v })}
            placeholder="Nombre…"
          />
        </ColumnHeader>
        <ColumnHeader
          label="Zona"
          filterKey="zone"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.zone.trim()}
          className="min-w-[100px]"
        >
          <ColumnTextFilter value={filters.zone} onChange={(v) => set({ zone: v })} placeholder="Zona…" />
        </ColumnHeader>
        <ColumnHeader
          label="Contratación"
          filterKey="hiring"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.hiring.trim()}
        >
          <ColumnTextFilter value={filters.hiring} onChange={(v) => set({ hiring: v })} placeholder="Tipo…" />
        </ColumnHeader>
        <ColumnHeader
          label="Subtotal"
          filterKey="subtotal"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          active={!!filters.subtotal.trim()}
        >
          <ColumnTextFilter value={filters.subtotal} onChange={(v) => set({ subtotal: v })} placeholder="Monto…" />
        </ColumnHeader>
        <ColumnHeader
          label="% IVA"
          filterKey="iva"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          active={!!filters.iva.trim()}
          className="min-w-[72px]"
        >
          <ColumnTextFilter value={filters.iva} onChange={(v) => set({ iva: v })} placeholder="IVA…" />
        </ColumnHeader>
        <ColumnHeader label="Monto IVA" filterable={false} align="right" className="min-w-[96px]" />
        <ColumnHeader
          label="Total"
          filterKey="total"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          active={!!filters.total.trim()}
        >
          <ColumnTextFilter value={filters.total} onChange={(v) => set({ total: v })} placeholder="Monto…" />
        </ColumnHeader>
        <ColumnHeader
          label="Fecha esperada"
          filterKey="expected"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.expectedFrom || !!filters.expectedTo}
        >
          <ColumnDateRangeFilter
            from={filters.expectedFrom}
            to={filters.expectedTo}
            onFrom={(v) => set({ expectedFrom: v })}
            onTo={(v) => set({ expectedTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Cierre"
          filterKey="issued"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.issuedFrom || !!filters.issuedTo}
        >
          <ColumnDateRangeFilter
            from={filters.issuedFrom}
            to={filters.issuedTo}
            onFrom={(v) => set({ issuedFrom: v })}
            onTo={(v) => set({ issuedTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Recibido conforme"
          filterKey="received"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.receivedFrom || !!filters.receivedTo}
        >
          <ColumnDateRangeFilter
            from={filters.receivedFrom}
            to={filters.receivedTo}
            onFrom={(v) => set({ receivedFrom: v })}
            onTo={(v) => set({ receivedTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Últ. act. precio"
          filterKey="lastPrice"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.lastPrice.trim()}
        >
          <ColumnTextFilter value={filters.lastPrice} onChange={(v) => set({ lastPrice: v })} placeholder="Fecha…" />
        </ColumnHeader>
        <ColumnHeader
          label="Estado"
          filterKey="status"
          openCols={openCols}
          onToggle={toggle}
          active={filters.status !== "all"}
        >
          <ColumnSelectFilter
            value={filters.status}
            onChange={(v) => set({ status: v })}
            options={FACTURACION_STATUS_OPTIONS}
          />
        </ColumnHeader>
        <ColumnHeader label="Modificada" filterKey="modified" openCols={openCols} onToggle={toggle} active={filters.modified !== "all"} className="min-w-[120px]">
          <ColumnSelectFilter value={filters.modified} onChange={(v) => set({ modified: v })} options={FACTURACION_MODIFIED_OPTIONS} />
        </ColumnHeader>
        <ColumnHeader label="Cambio monto" filterable={false} align="right" className="min-w-[110px]" />
        <ColumnHeader label="Obs. corrección" filterable={false} className="min-w-[140px]" />
        <ColumnHeader label="" align="right" filterable={false} className="min-w-[72px]">
          {hasActive && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs w-full" onClick={handleClear}>
              Limpiar
            </Button>
          )}
        </ColumnHeader>
      </tr>
    </thead>
  );
}

export function CxcStickyTableHead({
  filters,
  onChange,
  onClear,
  showActionCol,
}: {
  filters: CxcSearchFilters;
  onChange: (next: CxcSearchFilters) => void;
  onClear: () => void;
  showActionCol?: boolean;
}) {
  const set = (patch: Partial<CxcSearchFilters>) => onChange({ ...filters, ...patch });
  const hasActive = Object.entries(filters).some(([key, v]) =>
    key === "paymentStatus" ? v !== "pending" : v.trim() !== ""
  );
  const { openCols, toggle, closeAll } = useOpenColumnFilters();

  const handleClear = () => {
    closeAll();
    onClear();
  };

  return (
    <thead>
      <tr>
        <ColumnHeader
          label="Cliente"
          filterKey="cliente"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.client.trim() || !!filters.licitacion.trim()}
        >
          <div className="space-y-1 min-w-[120px]">
            <ColumnTextFilter value={filters.client} onChange={(v) => set({ client: v })} placeholder="Cliente…" />
            <ColumnTextFilter
              value={filters.licitacion}
              onChange={(v) => set({ licitacion: v })}
              placeholder="Licitación…"
            />
          </div>
        </ColumnHeader>
        <ColumnHeader
          label="Contacto facturación"
          filterKey="contact"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.contact.trim()}
          className="min-w-[130px]"
        >
          <ColumnTextFilter value={filters.contact} onChange={(v) => set({ contact: v })} placeholder="Nombre…" />
        </ColumnHeader>
        <ColumnHeader
          label="Periodo"
          filterKey="period"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.period.trim()}
        >
          <ColumnTextFilter value={filters.period} onChange={(v) => set({ period: v })} placeholder="M/A…" />
        </ColumnHeader>
        <ColumnHeader
          label="Total factura"
          filterKey="total"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          active={!!filters.total.trim()}
        >
          <ColumnTextFilter value={filters.total} onChange={(v) => set({ total: v })} placeholder="Monto…" />
        </ColumnHeader>
        <ColumnHeader
          label="Retención 2%"
          filterKey="retention"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          className="min-w-[100px]"
        >
          <span className="text-xs text-slate-500">Clientes públicos</span>
        </ColumnHeader>
        <ColumnHeader
          label="Neto a cobrar"
          filterKey="netAmount"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          className="min-w-[110px]"
        >
          <span className="text-xs text-slate-500">Después de retención</span>
        </ColumnHeader>
        <ColumnHeader
          label="Abono / Saldo"
          filterKey="abono"
          openCols={openCols}
          onToggle={toggle}
          align="right"
          active={!!filters.abono.trim()}
          className="min-w-[110px]"
        >
          <ColumnTextFilter value={filters.abono} onChange={(v) => set({ abono: v })} placeholder="Monto…" />
        </ColumnHeader>
        <ColumnHeader
          label="Nº factura"
          filterKey="invoiceNumber"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.invoiceNumber.trim()}
        >
          <ColumnTextFilter
            value={filters.invoiceNumber}
            onChange={(v) => set({ invoiceNumber: v })}
            placeholder="Nº…"
          />
        </ColumnHeader>
        <ColumnHeader
          label="Emisión"
          filterKey="issued"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.issuedFrom || !!filters.issuedTo}
        >
          <ColumnDateRangeFilter
            from={filters.issuedFrom}
            to={filters.issuedTo}
            onFrom={(v) => set({ issuedFrom: v })}
            onTo={(v) => set({ issuedTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Vencimiento"
          filterKey="due"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.dueFrom || !!filters.dueTo}
        >
          <ColumnDateRangeFilter
            from={filters.dueFrom}
            to={filters.dueTo}
            onFrom={(v) => set({ dueFrom: v })}
            onTo={(v) => set({ dueTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Pago esperado"
          filterKey="expectedPayment"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.expectedPaymentFrom || !!filters.expectedPaymentTo}
          className="min-w-[120px]"
        >
          <ColumnDateRangeFilter
            from={filters.expectedPaymentFrom}
            to={filters.expectedPaymentTo}
            onFrom={(v) => set({ expectedPaymentFrom: v })}
            onTo={(v) => set({ expectedPaymentTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Recibido conforme"
          filterKey="received"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.receivedFrom || !!filters.receivedTo}
          className="min-w-[120px]"
        >
          <ColumnDateRangeFilter
            from={filters.receivedFrom}
            to={filters.receivedTo}
            onFrom={(v) => set({ receivedFrom: v })}
            onTo={(v) => set({ receivedTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Recibo provisional"
          filterKey="receipt"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.receipt.trim()}
          className="min-w-[130px]"
        >
          <ColumnTextFilter value={filters.receipt} onChange={(v) => set({ receipt: v })} placeholder="Nº recibo…" />
        </ColumnHeader>
        <ColumnHeader
          label="Fecha pago recibido"
          filterKey="paidAt"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.paidAtFrom || !!filters.paidAtTo}
          className="min-w-[130px]"
        >
          <ColumnDateRangeFilter
            from={filters.paidAtFrom}
            to={filters.paidAtTo}
            onFrom={(v) => set({ paidAtFrom: v })}
            onTo={(v) => set({ paidAtTo: v })}
          />
        </ColumnHeader>
        <ColumnHeader
          label="Correos cobro"
          filterKey="emailCount"
          openCols={openCols}
          onToggle={toggle}
          align="center"
          active={!!filters.emailCount.trim()}
        >
          <ColumnTextFilter value={filters.emailCount} onChange={(v) => set({ emailCount: v })} placeholder="Nº…" />
        </ColumnHeader>
        <ColumnHeader
          label="Observaciones"
          filterKey="observations"
          openCols={openCols}
          onToggle={toggle}
          active={!!filters.observations.trim()}
          className="min-w-[130px]"
        >
          <ColumnTextFilter
            value={filters.observations}
            onChange={(v) => set({ observations: v })}
            placeholder="Texto…"
          />
        </ColumnHeader>
        <ColumnHeader
          label="Estado cobro"
          filterKey="paymentStatus"
          openCols={openCols}
          onToggle={toggle}
          active={filters.paymentStatus !== "pending"}
        >
          <ColumnSelectFilter
            value={filters.paymentStatus}
            onChange={(v) => set({ paymentStatus: v })}
            options={CXC_PAYMENT_STATUS_OPTIONS}
          />
        </ColumnHeader>
        {showActionCol ? (
          <ColumnHeader label="Acción" filterable={false} className="min-w-[80px]">
            {hasActive && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs w-full" onClick={handleClear}>
                Limpiar
              </Button>
            )}
          </ColumnHeader>
        ) : (
          <ColumnHeader label="" align="right" filterable={false}>
            {hasActive && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs w-full" onClick={handleClear}>
                Limpiar
              </Button>
            )}
          </ColumnHeader>
        )}
      </tr>
    </thead>
  );
}

export function filterFacturacionRows(rows: FacturaListExpandedRow[], f: FacturacionSearchFilters) {
  const q = f.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (q) {
      const haystack = [
        row.clientNameCopied,
        row.licitacionNo ?? "",
        row.administrationName ?? "",
        row.zoneName ?? "",
        row.managerName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (!matchesFilter(row.administrationName, f.administration)) return false;
    if (!matchesFilter(row.zoneName, f.zone)) return false;
    if (!matchesFilter(HIRING_TYPE_LABELS[row.hiringTypeCopied ?? "FIXED"], f.hiring)) return false;
    if (
      !matchesFilter(
        row.amountDefined && row.subtotalCopied != null ? formatCurrency(row.subtotalCopied) : "",
        f.subtotal
      )
    )
      return false;
    if (!matchesFilter(`${row.ivaPctCopied.toFixed(2)}%`, f.iva)) return false;
    if (
      !matchesFilter(
        row.amountDefined && row.totalCalculated != null ? formatCurrency(row.totalCalculated) : "",
        f.total
      )
    )
      return false;
    if (!matchesFilter(formatDate(row.lastPriceUpdateCopied), f.lastPrice)) return false;
    if (f.status !== "all" && row.status !== f.status) return false;
    if (f.modified !== "all" && getFacturaModifiedFilterValue(row) !== f.modified) return false;
    return true;
  });
}

export function filterCxcRows<T extends CxcRowForFilter>(rows: T[], f: CxcSearchFilters): T[] {
  return rows.filter((row) => {
    const contactText = row.billingContact
      ? `${row.billingContact.name} ${row.billingContact.jobTitle ?? ""} ${row.billingContact.phone} ${row.billingContact.email}`
      : "";
    if (!matchesFilter(contactText, f.contact)) return false;
    if (!matchesFilter(`${row.periodMonth}/${row.periodYear}`, f.period)) return false;
    if (
      !matchesFilter(row.totalCalculated != null ? formatCurrency(row.totalCalculated) : "", f.total)
    )
      return false;
    const abonoText = row.hasPartialPayment
      ? `${row.totalAbonos ?? row.provisionalPaymentAmount} ${row.remainingBalance}`
      : (row.totalAbonos ?? row.provisionalPaymentAmount) != null
        ? String(row.totalAbonos ?? row.provisionalPaymentAmount)
        : "";
    if (!matchesFilter(abonoText, f.abono)) return false;
    if (!matchesFilter(row.invoiceNumber ?? "", f.invoiceNumber)) return false;
    if (!matchesDateRange(row.dueDate, f.dueFrom, f.dueTo)) return false;
    const receiptHaystack = [
      row.provisionalReceiptNumber ?? "",
      ...(row.abonos ?? []).map((a) => a.receiptNumber ?? ""),
    ].join(" ");
    if (!matchesFilter(receiptHaystack, f.receipt)) return false;
    if (!matchesFilter(String(row.collectionEmailCount), f.emailCount)) return false;
    if (!matchesFilter(row.cxcObservations ?? "", f.observations)) return false;
    return true;
  });
}

export function appendFacturacionFilters(params: URLSearchParams, filters: FacturacionSearchFilters) {
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.client.trim()) params.set("client", filters.client.trim());
  if (filters.licitacion.trim()) params.set("licitacion", filters.licitacion.trim());
  if (filters.expectedFrom) params.set("expectedFrom", filters.expectedFrom);
  if (filters.expectedTo) params.set("expectedTo", filters.expectedTo);
  if (filters.issuedFrom) params.set("issuedFrom", filters.issuedFrom);
  if (filters.issuedTo) params.set("issuedTo", filters.issuedTo);
  if (filters.receivedFrom) params.set("receivedFrom", filters.receivedFrom);
  if (filters.receivedTo) params.set("receivedTo", filters.receivedTo);
  if (filters.status !== "all") params.set("status", filters.status);
}

export function appendCxcFilters(params: URLSearchParams, filters: CxcSearchFilters) {
  params.set("filter", filters.paymentStatus || "pending");
  if (filters.client.trim()) params.set("client", filters.client.trim());
  if (filters.licitacion.trim()) params.set("licitacion", filters.licitacion.trim());
  if (filters.issuedFrom) params.set("issuedFrom", filters.issuedFrom);
  if (filters.issuedTo) params.set("issuedTo", filters.issuedTo);
  if (filters.expectedPaymentFrom) params.set("expectedPaymentFrom", filters.expectedPaymentFrom);
  if (filters.expectedPaymentTo) params.set("expectedPaymentTo", filters.expectedPaymentTo);
  if (filters.receivedFrom) params.set("receivedFrom", filters.receivedFrom);
  if (filters.receivedTo) params.set("receivedTo", filters.receivedTo);
  if (filters.paidAtFrom) params.set("paidAtFrom", filters.paidAtFrom);
  if (filters.paidAtTo) params.set("paidAtTo", filters.paidAtTo);
}

/** Contenedor con scroll propio para que sticky del thead funcione sin tapar filas. */
export function FacturacionTableScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative max-h-[calc(100vh-13rem)] overflow-auto overscroll-contain">{children}</div>
  );
}
