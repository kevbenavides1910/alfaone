"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FolderOpen, Loader2, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { feApiUrl, withFeCompanyBody } from "@/components/facturacion-electronica/fe-company-context";
import { cn } from "@/lib/utils/cn";

type CabysItem = {
  codigo: string;
  descripcion: string;
  impuesto?: number | null;
};

type CabysFavorito = CabysItem & {
  id: string;
};

type BrowseCategory = {
  nombre: string;
};

type FeCabysPickerProps = {
  companyCode: string;
  value: string;
  selectedDescription?: string;
  onSelect: (item: CabysItem) => void;
  disabled?: boolean;
};

const QUICK_SEARCHES = [
  "seguridad",
  "vigilancia",
  "consultoría",
  "software",
  "transporte",
  "alimentos",
  "construcción",
  "limpieza",
];

export function FeCabysPicker({
  companyCode,
  value,
  selectedDescription,
  onSelect,
  disabled,
}: FeCabysPickerProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CabysItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [favBusy, setFavBusy] = useState<string | null>(null);

  const [browseOpen, setBrowseOpen] = useState(false);
  const [browsePath, setBrowsePath] = useState<string[]>([]);
  const [browseCategories, setBrowseCategories] = useState<BrowseCategory[]>([]);
  const [browseProducts, setBrowseProducts] = useState<CabysItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const favoritosQuery = useQuery({
    queryKey: ["fe-cabys-favoritos", companyCode],
    enabled: Boolean(companyCode),
    queryFn: async () => {
      const r = await fetch(feApiUrl("/api/fe/catalogos/cabys/favoritos", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar favoritos");
      return (j.data?.items ?? []) as CabysFavorito[];
    },
  });

  const favByCodigo = useMemo(() => {
    const map = new Map<string, CabysFavorito>();
    for (const f of favoritosQuery.data ?? []) map.set(f.codigo, f);
    return map;
  }, [favoritosQuery.data]);

  const invalidateFavoritos = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["fe-cabys-favoritos", companyCode] });
  }, [companyCode, queryClient]);

  const toggleFavorite = useCallback(
    async (item: CabysItem) => {
      if (!companyCode || disabled) return;
      const codigo = item.codigo.replace(/\D/g, "").slice(0, 13);
      if (codigo.length !== 13) return;

      setFavBusy(codigo);
      try {
        const existing = favByCodigo.get(codigo);
        if (existing) {
          const r = await fetch(feApiUrl(`/api/fe/catalogos/cabys/favoritos/${existing.id}`, companyCode), {
            method: "DELETE",
          });
          if (!r.ok) {
            const j = await r.json();
            throw new Error(j.error?.message ?? "No se pudo quitar el favorito");
          }
        } else {
          const r = await fetch(feApiUrl("/api/fe/catalogos/cabys/favoritos", companyCode), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              withFeCompanyBody(
                {
                  codigo,
                  descripcion: item.descripcion,
                  impuesto: item.impuesto ?? null,
                },
                companyCode
              )
            ),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error?.message ?? "No se pudo guardar el favorito");
        }
        invalidateFavoritos();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al actualizar favorito");
      } finally {
        setFavBusy(null);
      }
    },
    [companyCode, disabled, favByCodigo, invalidateFavoritos]
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function runSearch(searchQ: string) {
    const q = searchQ.trim();
    if (q.length < 3) {
      setItems([]);
      setError("Ingrese al menos 3 caracteres");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, top: "20" });
      const r = await fetch(feApiUrl(`/api/fe/catalogos/cabys?${params}`, companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al buscar");

      const rows = (j.data?.items ?? []) as CabysItem[];
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

  const loadBrowse = useCallback(
    async (path: string[]) => {
      setBrowseLoading(true);
      setBrowseError(null);
      try {
        const params = new URLSearchParams({ browse: "1", top: "25" });
        if (path.length) params.set("path", path.join("|"));

        const r = await fetch(feApiUrl(`/api/fe/catalogos/cabys?${params}`, companyCode));
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar categorías");

        setBrowsePath((j.data?.path ?? path) as string[]);
        setBrowseCategories((j.data?.categories ?? []) as BrowseCategory[]);
        setBrowseProducts((j.data?.products ?? []) as CabysItem[]);
      } catch (e) {
        setBrowseCategories([]);
        setBrowseProducts([]);
        setBrowseError(e instanceof Error ? e.message : "Error al cargar categorías");
      } finally {
        setBrowseLoading(false);
      }
    },
    [companyCode]
  );

  useEffect(() => {
    if (!open || query.trim().length < 3) return;
    const t = setTimeout(() => void runSearch(query), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open, companyCode]);

  function pickItem(item: CabysItem) {
    onSelect(item);
    setQuery("");
    setItems([]);
    setOpen(false);
    setError(null);
    setBrowseOpen(false);
    setBrowsePath([]);
  }

  function renderFavoritosList(compact = false) {
    const favoritos = favoritosQuery.data ?? [];
    if (!favoritos.length) return null;

    return (
      <div className={compact ? "space-y-1" : "space-y-2"}>
        <p className="text-xs font-medium text-muted-foreground">Favoritos</p>
        <ul className={cn("rounded-md border bg-background text-sm", compact ? "max-h-36 overflow-y-auto" : "")}>
          {favoritos.map((f) => (
            <li key={f.id} className="flex border-b last:border-0">
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/60"
                onClick={() => pickItem(f)}
              >
                <span className="font-mono text-xs font-medium">{f.codigo}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{f.descripcion}</span>
                {f.impuesto != null ? (
                  <span className="text-[10px] text-muted-foreground">IVA {f.impuesto}%</span>
                ) : null}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 self-center"
                disabled={disabled || favBusy === f.codigo}
                title="Quitar de favoritos"
                onClick={() => void toggleFavorite(f)}
              >
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function renderItemRow(item: CabysItem, key: string) {
    const codigo = item.codigo.replace(/\D/g, "").slice(0, 13);
    const isFav = favByCodigo.has(codigo);

    return (
      <li key={key} className="flex border-b last:border-0">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/60"
          onClick={() => pickItem(item)}
        >
          <span className="font-mono text-xs font-medium">{item.codigo}</span>
          <span className="text-xs text-muted-foreground">{item.descripcion}</span>
          {item.impuesto != null ? (
            <span className="text-[10px] text-muted-foreground">IVA {item.impuesto}%</span>
          ) : null}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 self-center"
          disabled={disabled || favBusy === codigo}
          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          onClick={() => void toggleFavorite(item)}
        >
          <Star
            className={cn("h-4 w-4", isFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground")}
          />
        </Button>
      </li>
    );
  }

  const selectedCodigo = value.replace(/\D/g, "").slice(0, 13);
  const selectedIsFav = selectedCodigo.length === 13 && favByCodigo.has(selectedCodigo);

  return (
    <div ref={wrapRef} className="space-y-2">
      {renderFavoritosList()}

      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-[200px] flex-1 gap-2">
          <Input
            value={query}
            disabled={disabled}
            placeholder="Buscar CABYS por código o descripción…"
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

        <Dialog
          open={browseOpen}
          onOpenChange={(next) => {
            setBrowseOpen(next);
            if (!next) {
              setBrowsePath([]);
              setBrowseCategories([]);
              setBrowseProducts([]);
              setBrowseError(null);
            } else {
              void loadBrowse([]);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" variant="secondary" disabled={disabled} className="shrink-0">
              <FolderOpen className="mr-2 h-4 w-4" />
              Explorar catálogo
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-3 overflow-hidden">
            <DialogHeader>
              <DialogTitle>Catálogo CABYS</DialogTitle>
              <DialogDescription>
                Navegue por categorías, use favoritos o busque por palabra clave. Seleccione el código de 13 dígitos.
              </DialogDescription>
            </DialogHeader>

            {renderFavoritosList(true)}

            <div className="flex flex-wrap gap-1.5">
              {QUICK_SEARCHES.map((term) => (
                <Button
                  key={term}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setQuery(term);
                    setOpen(true);
                    setBrowseOpen(false);
                    void runSearch(term);
                  }}
                >
                  {term}
                </Button>
              ))}
            </div>

            <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => {
                  setBrowsePath([]);
                  void loadBrowse([]);
                }}
              >
                Inicio
              </button>
              {browsePath.map((segment, i) => (
                <span key={`${segment}-${i}`} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button
                    type="button"
                    className="max-w-[220px] truncate text-left hover:text-foreground"
                    title={segment}
                    onClick={() => {
                      const nextPath = browsePath.slice(0, i + 1);
                      setBrowsePath(nextPath);
                      void loadBrowse(nextPath);
                    }}
                  >
                    {segment}
                  </button>
                </span>
              ))}
            </nav>

            {browseLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando categorías…
              </div>
            ) : browseError ? (
              <p className="text-sm text-amber-700 dark:text-amber-300">{browseError}</p>
            ) : (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {browseCategories.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Categorías</p>
                    <ul className="rounded-md border bg-background text-sm">
                      {browseCategories.map((cat) => (
                        <li key={cat.nombre}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/60"
                            onClick={() => {
                              const nextPath = [...browsePath, cat.nombre];
                              setBrowsePath(nextPath);
                              void loadBrowse(nextPath);
                            }}
                          >
                            <span className="text-sm">{cat.nombre}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {browseProducts.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">
                      Productos y servicios ({browseProducts.length})
                    </p>
                    <ul className="max-h-64 overflow-y-auto rounded-md border bg-background text-sm">
                      {browseProducts.map((item) => renderItemRow(item, item.codigo))}
                    </ul>
                  </div>
                ) : null}

                {!browseCategories.length && !browseProducts.length ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No hay subcategorías visibles en este nivel. Use favoritos, la búsqueda por palabra clave o
                    retroceda en el breadcrumb.
                  </p>
                ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {value ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <p className="min-w-0 flex-1">
            Seleccionado: <span className="font-mono text-foreground">{value}</span>
            {selectedDescription ? ` — ${selectedDescription}` : null}
          </p>
          {selectedCodigo.length === 13 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={disabled || favBusy === selectedCodigo}
              title={selectedIsFav ? "Quitar de favoritos" : "Guardar como favorito"}
              onClick={() =>
                void toggleFavorite({
                  codigo: selectedCodigo,
                  descripcion: selectedDescription ?? selectedCodigo,
                  impuesto: favByCodigo.get(selectedCodigo)?.impuesto ?? null,
                })
              }
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  selectedIsFav ? "fill-amber-400 text-amber-500" : "text-muted-foreground"
                )}
              />
            </Button>
          ) : null}
        </div>
      ) : null}

      {error && !loading ? <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p> : null}

      {open && items.length > 0 ? (
        <ul
          id={listId}
          className="max-h-52 overflow-y-auto rounded-md border bg-background text-sm shadow-sm"
          role="listbox"
        >
          {items.map((item) => renderItemRow(item, `${item.codigo}-${item.descripcion}`))}
        </ul>
      ) : null}
    </div>
  );
}
