"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type {
  OrdenCompraLinea,
  OrdenCompraNafRow,
} from "@/modules/presupuestos/services/list-ordenes-compra-naf";

type ExpenseOcPickerProps = {
  value: string;
  company?: string;
  onChange: (noOrden: string, row?: OrdenCompraNafRow | null) => void;
  disabled?: boolean;
  id?: string;
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

export function ExpenseOcPicker({
  value,
  company,
  onChange,
  disabled = false,
  id,
}: ExpenseOcPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [rows, setRows] = useState<OrdenCompraNafRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrdenCompraNafRow | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  useEffect(() => {
    if (!value.trim()) {
      setSelected(null);
    }
  }, [value]);

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
        const list = (body?.data?.rows ?? []) as OrdenCompraNafRow[];
        setRows(list);
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

  async function selectOc(row: OrdenCompraNafRow) {
    setQuery(row.noOrden);
    setOpen(false);
    setSelected(row);
    setLoadingDetalle(true);
    onChange(row.noOrden, row);

    try {
      const params = new URLSearchParams({ noOrden: row.noOrden, noCia: row.noCia });
      if (row.companyCode) params.set("company", row.companyCode);
      const res = await fetch(`/api/expenses/ordenes-compra/detalle?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message || "No se pudo cargar el detalle de la OC");
      }
      const detalle = body?.data as OrdenCompraNafRow;
      setSelected(detalle);
      onChange(detalle.noOrden, detalle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar líneas de la OC");
    } finally {
      setLoadingDetalle(false);
    }
  }

  const lineas: OrdenCompraLinea[] = selected?.lineas ?? [];

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          ref={inputRef}
          id={id}
          value={open ? query : value}
          placeholder={company ? "Buscar OC Codisa…" : "Elegí empresa o buscá OC…"}
          disabled={disabled}
          autoComplete="off"
          className="pl-9 h-9"
          onFocus={() => {
            setOpen(true);
            setQuery(value);
          }}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            setSelected(null);
            onChange(v, null);
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
          <li
            role="option"
            className="cursor-pointer px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("", null);
              setQuery("");
              setSelected(null);
              setOpen(false);
            }}
          >
            — Sin OC —
          </li>
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
            rows.map((row) => (
              <li
                key={`${row.noCia}-${row.noOrden}`}
                role="option"
                className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void selectOc(row);
                }}
              >
                <div className="font-medium font-mono">{formatOcLabel(row)}</div>
                {row.observaciones && (
                  <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                    {row.observaciones}
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}

      {loadingDetalle && (
        <p className="text-xs text-slate-500">Cargando líneas de la OC…</p>
      )}

      {selected && lineas.length > 0 && (
        <div className="rounded-md border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 flex justify-between gap-2">
            <span>
              Detalle OC {selected.noOrden}
              {selected.proveedor ? ` · ${selected.proveedor}` : ""}
            </span>
            <span className="font-mono">Total ₡{formatMonto(selected.monto)}</span>
          </div>
          <div className="max-h-44 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-slate-500">
                <tr className="border-b">
                  <th className="px-2 py-1 text-left font-medium">#</th>
                  <th className="px-2 py-1 text-left font-medium">Artículo</th>
                  <th className="px-2 py-1 text-right font-medium">Cant.</th>
                  <th className="px-2 py-1 text-right font-medium">P. unit.</th>
                  <th className="px-2 py-1 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.noLinea} className="border-b last:border-0">
                    <td className="px-2 py-1 text-slate-400">{l.noLinea}</td>
                    <td className="px-2 py-1">
                      <div className="text-slate-800">{l.descripcion || l.noArti}</div>
                      {l.descripcion && (
                        <div className="font-mono text-[10px] text-slate-400">{l.noArti}</div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-mono whitespace-nowrap">
                      {formatMonto(l.cantidad)}
                      {l.unidad ? ` ${l.unidad}` : ""}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">₡{formatMonto(l.precioUni)}</td>
                    <td className="px-2 py-1 text-right font-mono">₡{formatMonto(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected.aplicaImpuesto && (
            <p className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50 border-t">
              Monto = suma de líneas (sin IVA desglosado de Codisa).
            </p>
          )}
        </div>
      )}

      {!selected?.lineas?.length && !loadingDetalle && (
        <p className="text-xs text-slate-400">
          Números reales de orden de compra Codisa (NAF). También podés escribir otra referencia.
        </p>
      )}
    </div>
  );
}
