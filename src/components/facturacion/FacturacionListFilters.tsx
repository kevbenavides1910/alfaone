"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type FacturacionSearchFilters = {
  client: string;
  licitacion: string;
  expectedFrom: string;
  expectedTo: string;
  issuedFrom: string;
  issuedTo: string;
  receivedFrom: string;
  receivedTo: string;
};

export type CxcSearchFilters = {
  client: string;
  licitacion: string;
  issuedFrom: string;
  issuedTo: string;
  expectedPaymentFrom: string;
  expectedPaymentTo: string;
  receivedFrom: string;
  receivedTo: string;
};

export const EMPTY_FACTURACION_FILTERS: FacturacionSearchFilters = {
  client: "",
  licitacion: "",
  expectedFrom: "",
  expectedTo: "",
  issuedFrom: "",
  issuedTo: "",
  receivedFrom: "",
  receivedTo: "",
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
      <div className="flex items-center gap-1.5">
        <Input type="date" className="h-9 text-sm" value={from} onChange={(e) => onFrom(e.target.value)} />
        <span className="text-slate-400 text-xs">—</span>
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
  const hasActive = Object.values(filters).some((v) => v.trim() !== "");

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
      {hasActive && (
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          Limpiar búsqueda
        </Button>
      )}
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
  const hasActive = Object.values(filters).some((v) => v.trim() !== "");

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
      {hasActive && (
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          Limpiar búsqueda
        </Button>
      )}
    </div>
  );
}

export function appendFacturacionFilters(params: URLSearchParams, filters: FacturacionSearchFilters) {
  if (filters.client.trim()) params.set("client", filters.client.trim());
  if (filters.licitacion.trim()) params.set("licitacion", filters.licitacion.trim());
  if (filters.expectedFrom) params.set("expectedFrom", filters.expectedFrom);
  if (filters.expectedTo) params.set("expectedTo", filters.expectedTo);
  if (filters.issuedFrom) params.set("issuedFrom", filters.issuedFrom);
  if (filters.issuedTo) params.set("issuedTo", filters.issuedTo);
  if (filters.receivedFrom) params.set("receivedFrom", filters.receivedFrom);
  if (filters.receivedTo) params.set("receivedTo", filters.receivedTo);
}

export function appendCxcFilters(params: URLSearchParams, filters: CxcSearchFilters) {
  if (filters.client.trim()) params.set("client", filters.client.trim());
  if (filters.licitacion.trim()) params.set("licitacion", filters.licitacion.trim());
  if (filters.issuedFrom) params.set("issuedFrom", filters.issuedFrom);
  if (filters.issuedTo) params.set("issuedTo", filters.issuedTo);
  if (filters.expectedPaymentFrom) params.set("expectedPaymentFrom", filters.expectedPaymentFrom);
  if (filters.expectedPaymentTo) params.set("expectedPaymentTo", filters.expectedPaymentTo);
  if (filters.receivedFrom) params.set("receivedFrom", filters.receivedFrom);
  if (filters.receivedTo) params.set("receivedTo", filters.receivedTo);
}
