"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { feApiUrl } from "@/components/facturacion-electronica/fe-company-context";

type CatalogItem = {
  codigo: string;
  descripcion: string;
  impuesto?: number | null;
  origen?: string;
};

type FeCatalogSearchPickerProps = {
  companyCode: string;
  kind: "cabys" | "actividad";
  value: string;
  selectedDescription?: string;
  onSelect: (item: CatalogItem) => void;
  identificacion?: string;
  placeholder?: string;
  minQueryLength?: number;
  disabled?: boolean;
};

export function FeCatalogSearchPicker({
  companyCode,
  kind,
  value,
  selectedDescription,
  onSelect,
  identificacion,
  placeholder,
  minQueryLength,
  disabled,
}: FeCatalogSearchPickerProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const minLen = minQueryLength ?? (kind === "cabys" ? 3 : 2);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function runSearch(searchQ: string) {
    const q = searchQ.trim();
    if (q.length < minLen) {
      setItems([]);
      setError(`Ingrese al menos ${minLen} caracteres`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q });
      if (kind === "cabys") params.set("top", "20");
      if (kind === "actividad" && identificacion) params.set("identificacion", identificacion);

      const path =
        kind === "cabys"
          ? `/api/fe/catalogos/cabys?${params}`
          : `/api/fe/catalogos/actividades?${params}`;

      const r = await fetch(feApiUrl(path, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al buscar");

      const rows = (j.data?.items ?? []) as CatalogItem[];
      setItems(rows);
      setOpen(true);
      if (!rows.length) setError("Sin resultados");
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || query.trim().length < minLen) return;
    const t = setTimeout(() => void runSearch(query), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, identificacion, kind, companyCode]);

  return (
    <div ref={wrapRef} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          disabled={disabled}
          placeholder={
            placeholder ??
            (kind === "cabys" ? "Buscar CABYS por código o descripción…" : "Buscar actividad económica…")
          }
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch(query);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || loading}
          onClick={() => void runSearch(query)}
          title="Buscar en catálogo Hacienda"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {value ? (
        <p className="text-xs text-muted-foreground">
          Seleccionado: <span className="font-mono text-foreground">{value}</span>
          {selectedDescription ? ` — ${selectedDescription}` : null}
        </p>
      ) : null}

      {error && !loading ? <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}

      {open && items.length > 0 ? (
        <ul
          id={listId}
          className="max-h-52 overflow-y-auto rounded-md border bg-background text-sm shadow-sm"
          role="listbox"
        >
          {items.map((item) => (
            <li key={`${item.codigo}-${item.descripcion}`}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/60"
                onClick={() => {
                  onSelect(item);
                  setQuery("");
                  setItems([]);
                  setOpen(false);
                  setError(null);
                }}
              >
                <span className="font-mono text-xs font-medium">{item.codigo}</span>
                <span className="text-xs text-muted-foreground">{item.descripcion}</span>
                {kind === "cabys" && item.impuesto != null ? (
                  <span className="text-[10px] text-muted-foreground">IVA {item.impuesto}%</span>
                ) : null}
                {kind === "actividad" && item.origen === "contribuyente" ? (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300">Registrada en Hacienda</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
