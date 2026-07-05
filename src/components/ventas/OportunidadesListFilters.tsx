"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { VENTAS_OPORTUNIDAD_ESTADO_OPTIONS } from "@/modules/ventas/client";

export type OportunidadSearchFilters = {
  q: string;
  licitacionNo: string;
  cliente: string;
  descripcion: string;
  estado: string;
  fechaDesde: string;
  fechaHasta: string;
};

export const EMPTY_OPORTUNIDAD_FILTERS: OportunidadSearchFilters = {
  q: "",
  licitacionNo: "",
  cliente: "",
  descripcion: "",
  estado: "",
  fechaDesde: "",
  fechaHasta: "",
};

const FILTER_INPUT =
  "w-full h-8 text-xs border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-red-400";

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

export function useDebouncedOportunidadFilters(delay = 400) {
  const [draft, setDraft] = useState(EMPTY_OPORTUNIDAD_FILTERS);
  const debounced = useDebouncedValue(draft, delay);
  const [applied, setApplied] = useState(EMPTY_OPORTUNIDAD_FILTERS);

  useEffect(() => {
    setApplied({
      q: debounced.q,
      licitacionNo: debounced.licitacionNo,
      cliente: debounced.cliente,
      descripcion: debounced.descripcion,
      estado: debounced.estado,
      fechaDesde: debounced.fechaDesde,
      fechaHasta: debounced.fechaHasta,
    });
  }, [debounced]);

  const clearAll = useCallback(() => {
    setDraft(EMPTY_OPORTUNIDAD_FILTERS);
    setApplied(EMPTY_OPORTUNIDAD_FILTERS);
  }, []);

  return { draft, setDraft, applied, clearAll };
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

export function filterOportunidadRows<
  T extends {
    licitacionNo: string;
    cliente: string;
    descripcion: string;
    fechaPresentacion: string;
    estado: string;
  },
>(rows: T[], filters: OportunidadSearchFilters): T[] {
  return rows.filter(
    (row) =>
      matchesFilter(row.licitacionNo, filters.licitacionNo) &&
      matchesFilter(row.cliente, filters.cliente) &&
      matchesFilter(row.descripcion, filters.descripcion) &&
      (!filters.estado || row.estado === filters.estado) &&
      matchesDateRange(row.fechaPresentacion, filters.fechaDesde, filters.fechaHasta)
  );
}

function useOpenColumnFilters() {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const closeAll = () => setOpen(new Set());
  return { open, toggle, closeAll };
}

type ColumnHeaderProps = {
  label: string;
  colKey: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
};

function ColumnHeader({ label, colKey, active, open, onToggle, children }: ColumnHeaderProps) {
  return (
    <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 min-w-[7rem]")}>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 hover:text-slate-900"
        aria-expanded={open}
        aria-controls={`filter-${colKey}`}
      >
        <span className="relative">
          {label}
          {active && (
            <span className="absolute -top-0.5 -right-2 h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && children && (
        <div id={`filter-${colKey}`} className="mt-2">
          {children}
        </div>
      )}
    </th>
  );
}

type Props = {
  draft: OportunidadSearchFilters;
  setDraft: (next: OportunidadSearchFilters) => void;
  clearAll: () => void;
};

export function OportunidadesListFilters({ draft, setDraft, clearAll }: Props) {
  const { open, toggle, closeAll } = useOpenColumnFilters();

  const patch = (partial: Partial<OportunidadSearchFilters>) =>
    setDraft({ ...draft, ...partial });

  const hasActive =
    draft.licitacionNo.trim() ||
    draft.cliente.trim() ||
    draft.descripcion.trim() ||
    draft.estado ||
    draft.fechaDesde ||
    draft.fechaHasta;

  return (
    <thead>
      <tr>
        <ColumnHeader
          label="Nº licitación"
          colKey="licitacionNo"
          active={!!draft.licitacionNo.trim()}
          open={open.has("licitacionNo")}
          onToggle={() => toggle("licitacionNo")}
        >
          <input
            className={FILTER_INPUT}
            value={draft.licitacionNo}
            onChange={(e) => patch({ licitacionNo: e.target.value })}
            placeholder="Filtrar…"
          />
        </ColumnHeader>
        <ColumnHeader
          label="Cliente"
          colKey="cliente"
          active={!!draft.cliente.trim()}
          open={open.has("cliente")}
          onToggle={() => toggle("cliente")}
        >
          <input
            className={FILTER_INPUT}
            value={draft.cliente}
            onChange={(e) => patch({ cliente: e.target.value })}
            placeholder="Filtrar…"
          />
        </ColumnHeader>
        <ColumnHeader
          label="Descripción"
          colKey="descripcion"
          active={!!draft.descripcion.trim()}
          open={open.has("descripcion")}
          onToggle={() => toggle("descripcion")}
        >
          <input
            className={FILTER_INPUT}
            value={draft.descripcion}
            onChange={(e) => patch({ descripcion: e.target.value })}
            placeholder="Filtrar…"
          />
        </ColumnHeader>
        <ColumnHeader
          label="Fecha presentación"
          colKey="fecha"
          active={!!(draft.fechaDesde || draft.fechaHasta)}
          open={open.has("fecha")}
          onToggle={() => toggle("fecha")}
        >
          <div className="space-y-1">
            <input
              type="date"
              className={FILTER_INPUT}
              value={draft.fechaDesde}
              onChange={(e) => patch({ fechaDesde: e.target.value })}
            />
            <input
              type="date"
              className={FILTER_INPUT}
              value={draft.fechaHasta}
              onChange={(e) => patch({ fechaHasta: e.target.value })}
            />
          </div>
        </ColumnHeader>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap")}>
          Inicio recepción
        </th>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap")}>
          Cierre recepción
        </th>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap")}>
          Monto contratación
        </th>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap")}>
          Fecha aclaración
        </th>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap")}>
          Fecha objeciones
        </th>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700")}>
          Enlace
        </th>
        <ColumnHeader
          label="Estado"
          colKey="estado"
          active={!!draft.estado}
          open={open.has("estado")}
          onToggle={() => toggle("estado")}
        >
          <select
            className={FILTER_INPUT}
            value={draft.estado}
            onChange={(e) => patch({ estado: e.target.value })}
          >
            <option value="">Todos</option>
            {VENTAS_OPORTUNIDAD_ESTADO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </ColumnHeader>
        <th className={cn(STICKY_TH, "px-3 py-2 text-left font-medium text-slate-700 min-w-[8rem]")}>
          <div className="flex items-center justify-between gap-2">
            <span>Decisión</span>
            {hasActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  clearAll();
                  closeAll();
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </th>
      </tr>
    </thead>
  );
}
