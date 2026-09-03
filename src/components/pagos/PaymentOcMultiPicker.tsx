"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatCurrency } from "@/lib/utils/format";
import type { OrdenCompraNafRow } from "@/modules/presupuestos/services/list-ordenes-compra-naf";

export type PaymentOcItem = {
  noOrden: string;
  noCia: string;
  companyCode: string | null;
  proveedor: string | null;
  monto: number | null;
};

type PaymentOcMultiPickerProps = {
  items: PaymentOcItem[];
  company?: string;
  onChange: (items: PaymentOcItem[]) => void;
  disabled?: boolean;
};

const ESTADO_LABEL: Record<string, string> = {
  A: "Aprobada",
  E: "En proceso",
  P: "Pendiente",
};

function formatMonto(monto: number | null | undefined): string {
  if (monto == null || !Number.isFinite(monto)) return "—";
  return monto.toLocaleString("es-CR", { maximumFractionDigits: 2 });
}

function formatOcLabel(row: OrdenCompraNafRow): string {
  const estado = ESTADO_LABEL[row.estado] ?? row.estado;
  const monto = row.monto != null ? `₡${formatMonto(row.monto)}` : null;
  const parts = [
    `OC ${row.noOrden}`,
    row.companyCode || `cía ${row.noCia}`,
    row.proveedor || null,
    monto,
    row.fecha || null,
    estado || null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function rowToItem(row: OrdenCompraNafRow): PaymentOcItem {
  return {
    noOrden: row.noOrden,
    noCia: row.noCia,
    companyCode: row.companyCode,
    proveedor: row.proveedor,
    monto: row.monto,
  };
}

async function fetchOcDetalle(opts: {
  noOrden: string;
  noCia?: string;
  company?: string;
  signal?: AbortSignal;
}): Promise<OrdenCompraNafRow> {
  const params = new URLSearchParams({ noOrden: opts.noOrden });
  if (opts.noCia?.trim()) params.set("noCia", opts.noCia.trim());
  if (opts.company?.trim()) params.set("company", opts.company.trim());
  const res = await fetch(`/api/expenses/ordenes-compra/detalle?${params}`, {
    signal: opts.signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || "No se pudo cargar el detalle de la OC");
  }
  return body.data as OrdenCompraNafRow;
}

export function sumPaymentOcMontos(items: PaymentOcItem[]): number {
  return Math.round(
    items.reduce((acc, item) => {
      if (item.monto == null || !Number.isFinite(item.monto)) return acc;
      return acc + item.monto;
    }, 0) * 100,
  ) / 100;
}

export function formatPaymentOcReference(items: PaymentOcItem[]): string {
  return items.map((item) => item.noOrden).join(", ");
}

/**
 * Selector de varias OC Codisa para un pago manual.
 * Cada selección se agrega a la lista; el monto total se calcula afuera con sumPaymentOcMontos.
 */
export function PaymentOcMultiPicker({
  items,
  company,
  onChange,
  disabled,
}: PaymentOcMultiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<OrdenCompraNafRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const debounced = useDebouncedValue(query, 300);

  const selectedKeys = new Set(items.map((item) => `${item.noCia}:${item.noOrden}`));
  const total = sumPaymentOcMontos(items);

  useEffect(() => {
    if (!open || disabled) return;
    const q = debounced.trim();
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "25" });
    if (q) params.set("search", q);
    if (company?.trim()) params.set("company", company.trim());

    fetch(`/api/expenses/ordenes-compra?${params}`, { signal: ac.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "No se pudieron cargar las OC");
        }
        setRows((body?.data?.rows ?? []) as OrdenCompraNafRow[]);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setRows([]);
        setError(e instanceof Error ? e.message : "Error al buscar OC");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [open, disabled, debounced, company]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function addOc(row: OrdenCompraNafRow) {
    const key = `${row.noCia}:${row.noOrden}`;
    if (selectedKeys.has(key) || items.some((i) => i.noOrden === row.noOrden)) {
      setQuery("");
      setOpen(false);
      return;
    }

    setAdding(true);
    setError(null);
    setOpen(false);
    setQuery("");

    let next = rowToItem(row);
    try {
      const detalle = await fetchOcDetalle({
        noOrden: row.noOrden,
        noCia: row.noCia,
        company: row.companyCode ?? company,
      });
      next = rowToItem(detalle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar líneas de la OC");
    } finally {
      setAdding(false);
    }

    onChange([...items, next]);
  }

  function removeOc(noOrden: string) {
    onChange(items.filter((item) => item.noOrden !== noOrden));
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          ref={inputRef}
          value={query}
          placeholder={
            items.length > 0
              ? "Agregar otra OC…"
              : company
                ? "Buscar OC Codisa…"
                : "Elegí empresa o buscá OC…"
          }
          disabled={disabled || adding}
          autoComplete="off"
          className="pl-9 h-9"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
        />
      </div>

      {open && !disabled && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-card text-slate-900 shadow-md"
          role="listbox"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-slate-400">Buscando en Codisa…</li>
          )}
          {error && !loading && (
            <li className="px-3 py-2 text-sm text-red-600">{error}</li>
          )}
          {!loading && !error && rows.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">
              Sin OC para «{debounced.trim() || "recientes"}»
            </li>
          )}
          {!loading &&
            rows.map((row) => {
              const already = selectedKeys.has(`${row.noCia}:${row.noOrden}`)
                || items.some((i) => i.noOrden === row.noOrden);
              return (
                <li
                  key={`${row.noCia}-${row.noOrden}`}
                  role="option"
                  aria-disabled={already}
                  className={`px-3 py-2 text-sm ${
                    already
                      ? "cursor-default text-slate-400"
                      : "cursor-pointer hover:bg-slate-50"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (already) return;
                    void addOc(row);
                  }}
                >
                  <div className="font-medium font-mono">{formatOcLabel(row)}</div>
                  {already && (
                    <div className="text-xs text-slate-400 mt-0.5">Ya agregada</div>
                  )}
                  {!already && row.observaciones && (
                    <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {row.observaciones}
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5 rounded-md border bg-muted/30 p-2">
          {items.map((item) => (
            <li
              key={`${item.noCia}-${item.noOrden}`}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-mono font-medium">
                  OC {item.noOrden}
                  {item.companyCode ? (
                    <span className="text-muted-foreground font-sans font-normal">
                      {" "}· {item.companyCode}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {item.proveedor || "Sin proveedor"}
                  {" · "}
                  {item.monto != null ? formatCurrency(item.monto) : "sin monto"}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                onClick={() => removeOc(item.noOrden)}
                disabled={disabled}
                aria-label={`Quitar OC ${item.noOrden}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between border-t pt-1.5 text-sm font-medium">
            <span>Total OC ({items.length})</span>
            <span>{formatCurrency(total)}</span>
          </li>
        </ul>
      )}

      {adding && (
        <p className="text-xs text-slate-500">Cargando detalle de la OC…</p>
      )}
      {!items.length && !adding && (
        <p className="text-xs text-slate-400">
          Podés agregar varias OC; el monto del pago se suma automáticamente.
        </p>
      )}
    </div>
  );
}
