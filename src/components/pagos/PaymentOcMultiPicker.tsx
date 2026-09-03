"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { formatCurrency } from "@/lib/utils/format";

/** Gasto de «Pago proveedores» seleccionado (ya ligado a una OC). */
export type PaymentOcItem = {
  expenseId: string;
  noOrden: string;
  companyCode: string | null;
  description: string;
  monto: number;
  status: "unscheduled" | "scheduled_unpaid";
};

export type ProveedorOcOption = {
  id: string;
  description: string;
  amount: number;
  company: string | null;
  referenceNumber: string | null;
  status: "unscheduled" | "scheduled_unpaid";
};

type PaymentOcMultiPickerProps = {
  items: PaymentOcItem[];
  /** Cola de Pago proveedores (gastos aprobados pendientes). */
  options: ProveedorOcOption[];
  loading?: boolean;
  company?: string;
  onChange: (items: PaymentOcItem[]) => void;
  disabled?: boolean;
};

function optionOc(opt: ProveedorOcOption): string {
  return (opt.referenceNumber ?? "").trim();
}

function optionToItem(opt: ProveedorOcOption): PaymentOcItem | null {
  const noOrden = optionOc(opt);
  if (!noOrden) return null;
  return {
    expenseId: opt.id,
    noOrden,
    companyCode: opt.company,
    description: opt.description,
    monto: opt.amount,
    status: opt.status,
  };
}

export function sumPaymentOcMontos(items: PaymentOcItem[]): number {
  return Math.round(
    items.reduce((acc, item) => acc + (Number.isFinite(item.monto) ? item.monto : 0), 0) * 100,
  ) / 100;
}

export function formatPaymentOcReference(items: PaymentOcItem[]): string {
  return items.map((item) => item.noOrden).join(", ");
}

/**
 * Selector de varias OC desde la cola «Pago proveedores».
 * Cada fila ya es un gasto aprobado: al elegirla queda ligada automáticamente.
 */
export function PaymentOcMultiPicker({
  items,
  options,
  loading,
  company,
  onChange,
  disabled,
}: PaymentOcMultiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);

  const selectedIds = useMemo(() => new Set(items.map((i) => i.expenseId)), [items]);
  const total = sumPaymentOcMontos(items);

  const available = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return options.filter((opt) => {
      const oc = optionOc(opt);
      if (!oc) return false;
      if (selectedIds.has(opt.id)) return false;
      if (company?.trim() && opt.company && opt.company !== company.trim()) {
        // Mostrar igual si busca texto; solo priorizar misma compañía vía orden.
      }
      if (!q) return true;
      return (
        oc.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q) ||
        (opt.company ?? "").toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      if (company?.trim()) {
        const aSame = a.company === company.trim() ? 0 : 1;
        const bSame = b.company === company.trim() ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
      }
      return optionOc(a).localeCompare(optionOc(b), "es", { numeric: true });
    });
  }, [options, selectedIds, debounced, company]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addOption(opt: ProveedorOcOption) {
    const item = optionToItem(opt);
    if (!item || selectedIds.has(opt.id)) return;
    if (items.some((i) => i.noOrden === item.noOrden)) return;
    onChange([...items, item]);
    setQuery("");
    setOpen(false);
  }

  function removeItem(expenseId: string) {
    onChange(items.filter((item) => item.expenseId !== expenseId));
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
              ? "Agregar otra OC de proveedores…"
              : "Buscar OC en Pago proveedores…"
          }
          disabled={disabled}
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
            <li className="px-3 py-2 text-sm text-slate-400">Cargando cola de proveedores…</li>
          )}
          {!loading && available.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">
              {options.filter((o) => optionOc(o)).length === 0
                ? "No hay gastos con OC en Pago proveedores"
                : `Sin coincidencias para «${debounced.trim() || "…"}»`}
            </li>
          )}
          {!loading &&
            available.slice(0, 40).map((opt) => {
              const oc = optionOc(opt);
              return (
                <li
                  key={opt.id}
                  role="option"
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addOption(opt);
                  }}
                >
                  <div className="font-medium font-mono">
                    OC {oc}
                    {opt.company ? (
                      <span className="font-sans font-normal text-slate-500"> · {opt.company}</span>
                    ) : null}
                    <span className="font-sans font-normal"> · {formatCurrency(opt.amount)}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5">
                    {opt.description}
                    {opt.status === "scheduled_unpaid" ? " · ya en calendario" : ""}
                  </div>
                </li>
              );
            })}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5 rounded-md border bg-muted/30 p-2">
          {items.map((item) => (
            <li
              key={item.expenseId}
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
                  {item.description} · {formatCurrency(item.monto)}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                onClick={() => removeItem(item.expenseId)}
                disabled={disabled}
                aria-label={`Quitar OC ${item.noOrden}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between border-t pt-1.5 text-sm font-medium">
            <span>
              Total · {items.length} OC · ligado a proveedores
            </span>
            <span>{formatCurrency(total)}</span>
          </li>
        </ul>
      )}

      {!items.length && !loading && (
        <p className="text-xs text-slate-400">
          Elegí OC de la cola «Pago proveedores»; al guardar salen de la cola en un solo movimiento.
        </p>
      )}
    </div>
  );
}
