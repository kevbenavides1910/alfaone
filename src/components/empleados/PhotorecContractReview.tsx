"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SkipForward,
  Trash2,
  UserRound,
  X,
  AlertTriangle,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { cn } from "@/lib/utils/cn";

type PhotorecTipo =
  | "E5"
  | "E20"
  | "E28"
  | "E59"
  | "E22"
  | "E79"
  | "E7"
  | "OTRO"
  | "BASURA"
  | "PENDIENTE";

type Item = {
  id: string;
  folder: string;
  fileName: string;
  sizeMb: number;
  classification: {
    tipo: PhotorecTipo;
    noEmple: string;
    cedula: string;
    nombre: string;
    notas: string;
  } | null;
  suggestion: {
    extractedName: string;
    confidence: string;
    topScore: number;
    kind?: string;
    existing?: {
      noEmple: string;
      cedula: string;
      nombre: string;
      estado?: string;
      hasE5?: boolean;
    };
    candidates: {
      score: number;
      noEmple: string;
      cedula: string;
      nombre: string;
      overlap?: string;
    }[];
  } | null;
};

type ListResponse = {
  data: {
    root: string;
    items: Item[];
    summary: {
      total: number;
      pendientes: number;
      E5: number;
      otros: number;
      conSugerencia?: number;
      sugerenciaAlta?: number;
      sugerenciaMedia?: number;
    };
  };
};

type NafHit = {
  noEmple: string;
  nombre: string;
  cedula: string;
  estado: string;
  noCia: string;
  puesto: string;
  hasE5?: boolean;
  e5Path?: string | null;
};

const FOLDER_LABEL: Record<string, string> = {
  "00_todos_contratos_pendientes": "Todos contratos pendientes",
  "01_contratos_sin_empleado": "Contratos (lote anterior)",
  "02_posibles_contratos_otros": "Posibles contratos",
  "06_otros_grandes": "Otros grandes",
};

const QUICK_TIPOS: { tipo: PhotorecTipo; label: string; key: string }[] = [
  { tipo: "E5", label: "E5 Contrato laboral", key: "1" },
  { tipo: "E20", label: "E20 Paquete", key: "2" },
  { tipo: "E28", label: "E28 Acción ingreso", key: "3" },
  { tipo: "OTRO", label: "Otro", key: "9" },
  { tipo: "BASURA", label: "Basura", key: "0" },
];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `Error ${res.status}`);
  }
  return body as T;
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function PhotorecContractReview() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "empleados.contratos", "edit");
  const queryClient = useQueryClient();

  const [folder, setFolder] = useState<string>("00_todos_contratos_pendientes");
  const [onlyPending, setOnlyPending] = useState(true);
  const [onlySuggested, setOnlySuggested] = useState(true);
  const [minConfidence, setMinConfidence] = useState<"alta" | "media" | "baja">("media");
  const [suggestionKind, setSuggestionKind] = useState<"all" | "missing_e5" | "probable_duplicate">(
    "probable_duplicate",
  );
  const [index, setIndex] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [noEmple, setNoEmple] = useState("");
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");

  const [empQuery, setEmpQuery] = useState("");
  const [showEmpDrop, setShowEmpDrop] = useState(false);
  const empInputRef = useRef<HTMLInputElement>(null);
  const empDropRef = useRef<HTMLDivElement>(null);
  const debouncedEmpQuery = useDebounced(empQuery, 250);

  const listQuery = useQuery({
    queryKey: [
      "photorec-review",
      folder,
      onlyPending,
      onlySuggested,
      minConfidence,
      suggestionKind,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        folder,
        onlyPending: onlyPending ? "1" : "0",
        onlySuggested: onlySuggested ? "1" : "0",
        minConfidence,
        suggestionKind,
      });
      return fetchJson<ListResponse>(`/api/empleados/contratos/photorec?${params}`);
    },
  });

  const empSearch = useQuery({
    queryKey: ["photorec-naf-search", debouncedEmpQuery],
    queryFn: async () => {
      const body = await fetchJson<{ data: NafHit[] }>(
        `/api/empleados/contratos/photorec/empleados-search?q=${encodeURIComponent(debouncedEmpQuery)}&limit=15`,
      );
      return body.data;
    },
    enabled: debouncedEmpQuery.trim().length >= 2,
  });

  const e5StatusQuery = useQuery({
    queryKey: ["photorec-e5-status", noEmple],
    queryFn: async () => {
      const body = await fetchJson<{
        data: { noEmple: string; hasE5: boolean; remotePath: string | null };
      }>(
        `/api/empleados/contratos/photorec/e5-status?noEmple=${encodeURIComponent(noEmple)}`,
      );
      return body.data;
    },
    enabled: noEmple.trim().length > 0,
    staleTime: 30_000,
  });

  const selectedHasE5 = e5StatusQuery.data?.hasE5 === true;
  const selectedE5Path = e5StatusQuery.data?.remotePath ?? null;

  const items = listQuery.data?.data.items ?? [];
  const summary = listQuery.data?.data.summary;
  const current = items[index] ?? null;
  const empResults = empSearch.data ?? [];

  useEffect(() => {
    setIndex(0);
  }, [folder, onlyPending, onlySuggested, minConfidence, suggestionKind, listQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!current) {
      setNoEmple("");
      setCedula("");
      setNombre("");
      setNotas("");
      setEmpQuery("");
      return;
    }
    const sug = current.suggestion;
    const dup = sug?.kind === "probable_duplicate" ? sug.existing : null;
    const cand = sug?.kind === "missing_e5" ? sug.candidates?.[0] : null;
    const n = current.classification?.nombre || cand?.nombre || dup?.nombre || "";
    const c = current.classification?.noEmple || cand?.noEmple || dup?.noEmple || "";
    const d = current.classification?.cedula || cand?.cedula || dup?.cedula || "";
    setNoEmple(c);
    setCedula(d);
    setNombre(n);
    if (current.classification?.notas) {
      setNotas(current.classification.notas);
    } else if (dup) {
      setNotas(
        `Duplicado OCR: «${sug?.extractedName}» = ${dup.nombre} (${dup.noEmple}) que YA tiene E5`,
      );
    } else if (cand) {
      setNotas(
        `Sugerencia ${sug?.confidence} (score ${cand.score}): OCR «${sug?.extractedName}»`,
      );
    } else {
      setNotas("");
    }
    setEmpQuery(n || c || "");
  }, [current?.id]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        empDropRef.current?.contains(e.target as Node) ||
        empInputRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setShowEmpDrop(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!current) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfError(null);
      setPdfLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setPdfLoading(true);
      setPdfError(null);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      try {
        const res = await fetch(
          `/api/empleados/contratos/photorec/file?id=${encodeURIComponent(current.id)}`,
          { credentials: "same-origin" },
        );
        if (!res.ok) throw new Error(`No se pudo cargar (${res.status})`);
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          blob.type.includes("pdf") ? blob : new Blob([blob], { type: "application/pdf" }),
        );
        setBlobUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          setPdfError(e instanceof Error ? e.message : "Error al cargar PDF");
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current?.id]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const selectEmployee = useCallback((hit: NafHit) => {
    setNoEmple(hit.noEmple);
    setCedula(hit.cedula);
    setNombre(hit.nombre);
    setEmpQuery(`${hit.noEmple} · ${hit.nombre}`);
    setShowEmpDrop(false);
  }, []);

  const clearEmployee = useCallback(() => {
    setNoEmple("");
    setCedula("");
    setNombre("");
    setEmpQuery("");
    empInputRef.current?.focus();
  }, []);

  const classifyMut = useMutation({
    mutationFn: async (input: PhotorecTipo | {
      tipo: PhotorecTipo;
      noEmple?: string;
      cedula?: string;
      nombre?: string;
      notas?: string;
    }) => {
      if (!current) throw new Error("Sin documento");
      const tipo = typeof input === "string" ? input : input.tipo;
      const body =
        typeof input === "string"
          ? { id: current.id, tipo, noEmple, cedula, nombre, notas }
          : {
              id: current.id,
              tipo,
              noEmple: input.noEmple ?? noEmple,
              cedula: input.cedula ?? cedula,
              nombre: input.nombre ?? nombre,
              notas: input.notas ?? notas,
            };
      return fetchJson("/api/empleados/contratos/photorec/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: async (_data, input) => {
      const tipo = typeof input === "string" ? input : input.tipo;
      toast.success(
        tipo === "E5" ? "Marcado como contrato E5" : `Marcado: ${tipo}`,
        current?.fileName,
      );
      await queryClient.invalidateQueries({ queryKey: ["photorec-review"] });
      if (!onlyPending) goNext();
    },
    onError: (e: Error) => toast.error("Error al clasificar", e.message),
  });

  type ApplyE5Response = {
    data: {
      status: "applied" | "skipped_exists" | "error";
      message: string;
      remotePath?: string;
      existingFile?: string;
    };
  };

  const applyE5Mut = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Sin documento");
      if (!noEmple.trim()) throw new Error("Selecciona un empleado NAF");
      return fetchJson<ApplyE5Response>("/api/empleados/contratos/photorec/apply-e5", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          noEmple,
          cedula,
          nombre,
          notas,
        }),
      });
    },
    onSuccess: async (body) => {
      const { status, message, remotePath } = body.data;
      if (status === "applied") {
        toast.success("Agregado al expediente E5", remotePath || message);
      } else if (status === "skipped_exists") {
        toast.info("E5 ya existía — no se sobrescribió", message);
      } else {
        toast.error("No se pudo agregar", message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["photorec-review"] });
      await queryClient.invalidateQueries({ queryKey: ["photorec-e5-status"] });
      if (!onlyPending) goNext();
    },
    onError: (e: Error) => toast.error("Error al agregar E5", e.message),
  });

  const classify = useCallback(
    (tipo: PhotorecTipo) => {
      if (!canEdit) {
        toast.error(
          "Sin permiso",
          "Necesitas permiso edit en Conciliación contratos",
        );
        return;
      }
      if (tipo === "E5" && !noEmple.trim()) {
        toast.error("Falta empleado", "Busca y selecciona un empleado NAF arriba");
        empInputRef.current?.focus();
        return;
      }
      classifyMut.mutate(tipo);
    },
    [canEdit, classifyMut, noEmple],
  );

  const applyE5 = useCallback(() => {
    if (!canEdit) {
      toast.error(
        "Sin permiso",
        "Necesitas permiso edit en Conciliación contratos",
      );
      return;
    }
    if (!current) {
      toast.error("Sin documento", "Selecciona un PDF de la lista");
      return;
    }
    if (!noEmple.trim()) {
      toast.error("Falta empleado", "Busca y selecciona un empleado NAF arriba");
      empInputRef.current?.focus();
      return;
    }
    applyE5Mut.mutate();
  }, [canEdit, current, noEmple, applyE5Mut]);

  const busy = classifyMut.isPending || applyE5Mut.isPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Enter con empleado seleccionado → Agregar a E5 (también desde el buscador)
      if (e.key === "Enter" && noEmple.trim() && current && canEdit && !busy) {
        if (inField && tag === "TEXTAREA") return;
        if (inField && tag === "INPUT" && e.target !== empInputRef.current) return;
        e.preventDefault();
        setShowEmpDrop(false);
        applyE5();
        return;
      }

      if (inField) return;
      if (e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "1") {
        e.preventDefault();
        classify("E5");
      } else if (e.key === "2") {
        e.preventDefault();
        classify("E20");
      } else if (e.key === "3") {
        e.preventDefault();
        classify("E28");
      } else if (e.key === "9") {
        e.preventDefault();
        classify("OTRO");
      } else if (e.key === "0") {
        e.preventDefault();
        classify("BASURA");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        goNext();
      } else if (e.key === "/" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        empInputRef.current?.focus();
        setShowEmpDrop(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyE5, busy, canEdit, classify, current, goNext, goPrev, noEmple]);

  const progressLabel = useMemo(() => {
    if (!items.length) return "0 / 0";
    return `${index + 1} / ${items.length}`;
  }, [index, items.length]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <Topbar title="Revisión PhotoRec — contratos" />

      {/* Encabezado: asignación de empleado NAF */}
      <div className="border-b border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <UserRound className="h-4 w-4 text-red-600" />
            Asignar empleado NAF
          </div>
          <span className="text-[11px] text-slate-500">
            Busca por nombre, cédula o código · atajo <kbd className="rounded bg-slate-100 px-1">/</kbd>
          </span>
          {summary ? (
            <div className="ml-auto flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Total {summary.total}</Badge>
              <Badge variant="warning">Pendientes {summary.pendientes}</Badge>
              <Badge variant="success">E5 {summary.E5}</Badge>
              {typeof summary.conSugerencia === "number" ? (
                <Badge variant="secondary">
                  Sugerencias {summary.conSugerencia}
                  {summary.sugerenciaAlta ? ` · alta ${summary.sugerenciaAlta}` : ""}
                  {summary.sugerenciaMedia ? ` · media ${summary.sugerenciaMedia}` : ""}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto_auto]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              ref={empInputRef}
              className="h-11 pl-9 pr-9 text-sm"
              placeholder="Buscar empleado NAF (nombre, cédula o código)…"
              value={empQuery}
              disabled={!canEdit}
              onChange={(e) => {
                setEmpQuery(e.target.value);
                setShowEmpDrop(true);
                // Si edita a mano, no forzar selección previa
                if (noEmple && e.target.value !== `${noEmple} · ${nombre}`) {
                  /* keep codes until new selection */
                }
              }}
              onFocus={() => setShowEmpDrop(true)}
            />
            {empQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={clearEmployee}
                aria-label="Limpiar empleado"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}

            {showEmpDrop && debouncedEmpQuery.trim().length >= 2 ? (
              <div
                ref={empDropRef}
                className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
              >
                {empSearch.isFetching ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
                  </div>
                ) : empResults.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500">Sin resultados</div>
                ) : (
                  <ul>
                    {empResults.map((hit) => (
                      <li key={`${hit.noCia}-${hit.noEmple}`}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-red-50",
                            hit.hasE5 && "bg-amber-50/60",
                          )}
                          onClick={() => selectEmployee(hit)}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                            <span className="min-w-0 truncate">
                              {hit.nombre || "(sin nombre)"}
                            </span>
                            {hit.hasE5 ? (
                              <Badge variant="warning" className="shrink-0 text-[10px]">
                                Ya tiene E5
                              </Badge>
                            ) : (
                              <Badge variant="success" className="shrink-0 text-[10px]">
                                Sin E5
                              </Badge>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {hit.noEmple}
                            {hit.cedula ? ` · ced ${hit.cedula}` : ""}
                            {hit.estado ? ` · ${hit.estado}` : ""}
                            {hit.puesto ? ` · ${hit.puesto}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Código</div>
              <div className="font-mono font-semibold text-slate-800">{noEmple || "—"}</div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Cédula</div>
              <div className="font-mono font-semibold text-slate-800">{cedula || "—"}</div>
            </div>
            {noEmple ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  e5StatusQuery.isFetching
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : selectedHasE5
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : "border-emerald-300 bg-emerald-50 text-emerald-900",
                )}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-70">E5 vivo</div>
                <div className="flex items-center gap-1 font-semibold">
                  {e5StatusQuery.isFetching ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Consultando…
                    </>
                  ) : selectedHasE5 ? (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" /> Ya existe
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Falta — se puede agregar
                    </>
                  )}
                </div>
              </div>
            ) : null}
            <Button
              size="sm"
              className={cn(
                "h-11 gap-1.5 px-4 text-sm font-semibold",
                selectedHasE5
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-emerald-600 hover:bg-emerald-700",
              )}
              disabled={!current || !noEmple.trim() || busy || !canEdit}
              onClick={applyE5}
              title={
                selectedHasE5
                  ? "Este empleado ya tiene E5: solo clasificará el PDF, no sobrescribe"
                  : "Clasifica como E5 y copia el PDF al expediente digital vivo"
              }
            >
              {applyE5Mut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : selectedHasE5 ? (
                <SkipForward className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {selectedHasE5 ? "Clasificar (ya tiene E5)" : "Agregar"}
              <kbd className="ml-1 rounded bg-black/15 px-1 text-[10px]">Enter</kbd>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            >
              {Object.entries(FOLDER_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlyPending}
                onChange={(e) => setOnlyPending(e.target.checked)}
              />
              Solo pendientes
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={onlySuggested}
                onChange={(e) => setOnlySuggested(e.target.checked)}
              />
              Solo con sugerencia
            </label>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={suggestionKind}
              onChange={(e) =>
                setSuggestionKind(
                  e.target.value as "all" | "missing_e5" | "probable_duplicate",
                )
              }
              title="Tipo de sugerencia"
            >
              <option value="probable_duplicate">Duplicados (ya tienen E5)</option>
              <option value="missing_e5">Posible faltante E5</option>
              <option value="all">Todas las sugerencias</option>
            </select>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={minConfidence}
              onChange={(e) =>
                setMinConfidence(e.target.value as "alta" | "media" | "baja")
              }
              title="Confianza mínima de la sugerencia OCR"
            >
              <option value="alta">Confianza ≥ alta</option>
              <option value="media">Confianza ≥ media</option>
              <option value="baja">Confianza ≥ baja</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              className="h-11 gap-1"
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", listQuery.isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {noEmple ? (
          <div
            className={cn(
              "mt-2 rounded-md px-2.5 py-2 text-xs",
              selectedHasE5
                ? "border border-amber-200 bg-amber-50 text-amber-900"
                : "text-emerald-700",
            )}
          >
            Seleccionado: <span className="font-semibold">{nombre || "(sin nombre)"}</span>
            <span className="font-mono text-slate-600"> · {noEmple}</span>
            {cedula ? <span className="font-mono text-slate-600"> · {cedula}</span> : null}
            {e5StatusQuery.isFetching ? (
              <span className="ml-2 text-slate-500">· consultando E5 vivo…</span>
            ) : selectedHasE5 ? (
              <span className="ml-2">
                · <strong>Ya tiene E5</strong>
                {selectedE5Path ? (
                  <span className="font-mono text-[10px] text-amber-800"> ({selectedE5Path})</span>
                ) : null}
                . El botón solo clasifica el PDF de PhotoRec; <strong>no sobrescribe</strong> el
                expediente.
              </span>
            ) : (
              <span className="ml-2 text-slate-500">
                · <strong className="font-medium text-emerald-800">Agregar</strong> copia el PDF al
                expediente E5 vivo
              </span>
            )}
          </div>
        ) : (
          <div className="mt-2 text-xs text-amber-700">
            Selecciona un empleado arriba y pulsa <strong>Agregar</strong> para enviarlo al
            expediente E5. En la lista verás quién ya tiene E5.
          </div>
        )}

        {current?.suggestion ? (
          current.suggestion.kind === "probable_duplicate" && current.suggestion.existing ? (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <div className="flex flex-wrap items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="font-semibold">Probable duplicado</span>
                <Badge variant="warning">
                  {current.suggestion.confidence} · score {current.suggestion.topScore}
                </Badge>
              </div>
              <p className="mt-1.5">
                OCR: <strong>{current.suggestion.extractedName}</strong>
                <br />
                Coincide con{" "}
                <strong>{current.suggestion.existing.nombre}</strong> (
                <span className="font-mono">{current.suggestion.existing.noEmple}</span>) que{" "}
                <strong>ya tiene E5</strong>. No uses Agregar a otro empleado.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
                  disabled={!canEdit || busy}
                  onClick={() => {
                    const ex = current.suggestion!.existing!;
                    classifyMut.mutate({
                      tipo: "OTRO",
                      noEmple: ex.noEmple,
                      cedula: ex.cedula,
                      nombre: ex.nombre,
                      notas: `Duplicado OCR: «${current.suggestion!.extractedName}» = ${ex.nombre} (${ex.noEmple}) YA tiene E5`,
                    });
                  }}
                >
                  Marcar duplicado (sacar de pendientes)
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Sugerencia OCR (faltante E5)</span>
                <Badge
                  variant={
                    current.suggestion.confidence === "alta"
                      ? "success"
                      : current.suggestion.confidence === "media"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {current.suggestion.confidence} · score {current.suggestion.topScore}
                </Badge>
                <span className="text-sky-800">
                  Nombre en PDF:{" "}
                  <strong className="font-semibold">{current.suggestion.extractedName}</strong>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {current.suggestion.candidates.map((cand) => (
                  <button
                    key={`${cand.noEmple}-${cand.score}`}
                    type="button"
                    className={cn(
                      "rounded border px-2 py-1 text-left hover:bg-white",
                      noEmple === cand.noEmple
                        ? "border-sky-500 bg-white ring-1 ring-sky-400"
                        : "border-sky-200 bg-sky-100/60",
                    )}
                    onClick={() => {
                      setNoEmple(cand.noEmple);
                      setCedula(cand.cedula);
                      setNombre(cand.nombre);
                      setEmpQuery(`${cand.noEmple} · ${cand.nombre}`);
                      setNotas(
                        `Sugerencia ${current.suggestion?.confidence} (score ${cand.score}): OCR «${current.suggestion?.extractedName}»`,
                      );
                      setShowEmpDrop(false);
                    }}
                  >
                    <div className="font-medium text-slate-900">{cand.nombre}</div>
                    <div className="font-mono text-[10px] text-slate-600">
                      {cand.noEmple}
                      {cand.cedula ? ` · ${cand.cedula}` : ""} · score {cand.score}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-sky-800">
                Solo si el mejor match global aún no tiene E5. Revisa el PDF antes de Agregar.
              </p>
            </div>
          )
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="max-h-[35vh] overflow-y-auto border-b border-slate-200 lg:max-h-none lg:border-b-0 lg:border-r">
          {listQuery.isLoading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : listQuery.isError ? (
            <div className="p-4 text-sm text-red-600">
              {(listQuery.error as Error)?.message || "Error al cargar"}
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No hay PDFs
              {onlySuggested ? " con sugerencia" : ""}
              {onlyPending ? " pendientes" : ""}
              {onlySuggested || onlyPending ? " con estos filtros" : " en esta carpeta"}.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it, i) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-xs hover:bg-slate-50",
                      i === index && "bg-red-50 ring-1 ring-inset ring-red-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-700 line-clamp-2">
                        {it.fileName}
                      </span>
                      <span className="shrink-0 text-slate-400">{it.sizeMb} MB</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {it.suggestion ? (
                        <Badge
                          variant={
                            it.suggestion.kind === "probable_duplicate"
                              ? "warning"
                              : it.suggestion.confidence === "alta"
                                ? "success"
                                : it.suggestion.confidence === "media"
                                  ? "warning"
                                  : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {it.suggestion.kind === "probable_duplicate"
                            ? `dup · ${it.suggestion.existing?.noEmple || "?"}`
                            : `${it.suggestion.confidence}${
                                it.suggestion.candidates[0]
                                  ? ` · ${it.suggestion.candidates[0].noEmple}`
                                  : ""
                              }`}
                        </Badge>
                      ) : null}
                      {it.classification ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {it.classification.tipo}
                          {it.classification.noEmple
                            ? ` · ${it.classification.noEmple}`
                            : ""}
                        </Badge>
                      ) : !it.suggestion ? (
                        <span className="text-[10px] text-amber-600">pendiente</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[55vh] flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <Button size="sm" variant="outline" onClick={goPrev} disabled={index <= 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[5rem] text-center text-sm font-medium tabular-nums">
              {progressLabel}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={goNext}
              disabled={index >= items.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {current ? (
              <span className="truncate text-xs text-slate-500 font-mono">
                {current.fileName}
              </span>
            ) : null}
          </div>

          <div className="relative min-h-0 flex-1 bg-slate-200">
            {pdfLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando PDF…
              </div>
            ) : pdfError ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-sm text-red-600">
                <FileWarning className="h-6 w-6" />
                {pdfError}
              </div>
            ) : blobUrl ? (
              <object
                key={blobUrl}
                data={blobUrl}
                type="application/pdf"
                title="PDF PhotoRec"
                className="h-full w-full bg-white"
              >
                <iframe title="PDF PhotoRec" src={blobUrl} className="h-full w-full bg-white" />
              </object>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Selecciona un PDF
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 bg-white p-3">
            <Input
              placeholder="Notas (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={!canEdit}
            />
            <div className="flex flex-wrap gap-2">
              {QUICK_TIPOS.map((t) => (
                <Button
                  key={t.tipo}
                  size="sm"
                  variant={t.tipo === "E5" ? "default" : "outline"}
                  className={cn(
                    "gap-1",
                    t.tipo === "E5" && "bg-red-600 hover:bg-red-700",
                    t.tipo === "BASURA" && "text-red-700",
                  )}
                  disabled={!current || busy || !canEdit}
                  onClick={() => classify(t.tipo)}
                >
                  {t.tipo === "E5" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : t.tipo === "BASURA" ? (
                    <Trash2 className="h-3.5 w-3.5" />
                  ) : null}
                  <kbd className="mr-1 rounded bg-black/10 px-1 text-[10px]">{t.key}</kbd>
                  {t.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="gap-1" onClick={goNext}>
                <SkipForward className="h-3.5 w-3.5" />
                Saltar <kbd className="ml-1 rounded bg-slate-100 px-1 text-[10px]">S</kbd>
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Atajos: <kbd>/</kbd> buscar empleado · <kbd>Enter</kbd> Agregar a E5 vivo · ←/→
              navegar · 1=solo clasificar E5 · 2=E20 · 3=E28 · 9=Otro · 0=Basura · S=saltar.
              {!canEdit ? " (solo lectura)" : ""}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
