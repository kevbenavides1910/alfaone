"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { OrdenCompraNafRow } from "@/modules/presupuestos/services/list-ordenes-compra-naf";

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

function formatOcLabel(row: OrdenCompraNafRow): string {
  const estado = ESTADO_LABEL[row.estado] ?? row.estado;
  const parts = [
    `OC ${row.noOrden}`,
    row.proveedor || null,
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
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

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

  return (
    <div ref={containerRef} className="relative">
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
                  onChange(row.noOrden, row);
                  setQuery(row.noOrden);
                  setOpen(false);
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
      <p className="text-xs text-slate-400 mt-1">
        Números reales de orden de compra Codisa (NAF). También podés escribir otra referencia.
      </p>
    </div>
  );
}
