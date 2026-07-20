"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { cn } from "@/lib/utils/cn";

type ReviewRow = {
  estado: "APROBADO" | "OBSERVADO";
  observacion: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

type Item = {
  id: string;
  fileName: string;
  sizeMb: number;
  noEmple: string;
  nombre: string;
  cia: string;
  empresa: string;
  puesto: string;
  fIngreso: string;
  salario: string;
  anioPlantilla: string;
  camposEnBlanco: string[];
  review: ReviewRow | null;
};

type ListResponse = {
  data: {
    root: string;
    items: Item[];
    summary: {
      total: number;
      aprobados: number;
      conObservaciones: number;
      pendientes: number;
    };
  };
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `Error ${res.status}`);
  }
  return body as T;
}

export function ReconstruccionE5Review() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "empleados.contratos", "edit");
  const queryClient = useQueryClient();

  const [index, setIndex] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [observacion, setObservacion] = useState("");

  const listQuery = useQuery({
    queryKey: ["reconstruccion-e5-review"],
    queryFn: () => fetchJson<ListResponse>("/api/empleados/contratos/reconstruccion"),
  });

  const items = listQuery.data?.data.items ?? [];
  const summary = listQuery.data?.data.summary;
  const current = items[index] ?? null;

  useEffect(() => {
    if (index >= items.length && items.length > 0) setIndex(items.length - 1);
  }, [index, items.length]);

  useEffect(() => {
    setObservacion(current?.review?.observacion ?? "");
  }, [current?.id]);

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
          `/api/empleados/contratos/reconstruccion/file?id=${encodeURIComponent(current.id)}`,
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

  const reviewMut = useMutation({
    mutationFn: async (estado: "APROBADO" | "OBSERVADO") => {
      if (!current) throw new Error("Sin documento");
      return fetchJson("/api/empleados/contratos/reconstruccion/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, estado, observacion }),
      });
    },
    onSuccess: async (_data, estado) => {
      toast.success(
        estado === "APROBADO" ? "Contrato aprobado" : "Marcado con observaciones",
        current?.fileName,
      );
      await queryClient.invalidateQueries({ queryKey: ["reconstruccion-e5-review"] });
      goNext();
    },
    onError: (e: Error) => toast.error("Error al guardar revisión", e.message),
  });

  const review = useCallback(
    (estado: "APROBADO" | "OBSERVADO") => {
      if (!canEdit) {
        toast.error("Sin permiso", "Necesitas permiso edit en Conciliación contratos");
        return;
      }
      if (estado === "OBSERVADO" && !observacion.trim()) {
        toast.error("Falta la observación", "Escribe la observación antes de guardar");
        return;
      }
      reviewMut.mutate(estado);
    },
    [canEdit, observacion, reviewMut],
  );

  const busy = reviewMut.isPending;

  const progressLabel = useMemo(() => {
    if (!items.length) return "0 / 0";
    return `${index + 1} / ${items.length}`;
  }, [index, items.length]);

  const fIngresoLabel = current?.fIngreso ? current.fIngreso.slice(0, 10) : "—";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <Topbar title="Contratos E5 reconstruidos — revisión" />

      <div className="border-b border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-slate-800">
            Borradores reconstruidos desde NAF (re-firma)
          </div>
          <span className="text-[11px] text-slate-500">
            Marca de agua «REIMPRESIÓN PARA FIRMA» · no sustituyen al expediente vivo
          </span>
          {summary ? (
            <div className="ml-auto flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Total {summary.total}</Badge>
              <Badge variant="success">Aprobados {summary.aprobados}</Badge>
              <Badge variant="warning">Con observaciones {summary.conObservaciones}</Badge>
              <Badge variant="secondary">Pendientes {summary.pendientes}</Badge>
            </div>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", listQuery.isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_1fr]">
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
              No hay PDFs reconstruidos en la carpeta.
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
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-800">
                          {it.nombre || "(sin nombre en manifiesto)"}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {it.noEmple} · {it.fileName}
                        </span>
                      </span>
                      {it.review ? (
                        <Badge
                          variant={it.review.estado === "APROBADO" ? "success" : "warning"}
                          className="shrink-0 text-[10px]"
                        >
                          {it.review.estado === "APROBADO" ? "Aprobado" : "Observado"}
                        </Badge>
                      ) : (
                        <span className="shrink-0 text-[10px] text-amber-600">pendiente</span>
                      )}
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
              <span className="truncate font-mono text-xs text-slate-500">
                {current.fileName} · {current.sizeMb} MB
              </span>
            ) : null}
          </div>

          {current ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-3 py-2 text-xs md:grid-cols-4">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Código</div>
                <div className="font-mono font-semibold text-slate-800">{current.noEmple}</div>
              </div>
              <div className="col-span-2 md:col-span-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Nombre</div>
                <div className="font-semibold text-slate-800">{current.nombre || "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Empresa</div>
                <div className="text-slate-800">
                  {current.empresa || "—"}
                  {current.cia ? (
                    <span className="ml-1 font-mono text-[10px] text-slate-500">
                      (cia {current.cia})
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Puesto</div>
                <div className="text-slate-800">{current.puesto || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Fecha ingreso
                </div>
                <div className="font-mono text-slate-800">{fIngresoLabel}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Salario (mín. TOSCG)
                </div>
                <div className="font-mono text-slate-800">{current.salario || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Año plantilla
                </div>
                <div className="font-mono text-slate-800">{current.anioPlantilla || "—"}</div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">
                  Campos en blanco (completar a mano)
                </div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {current.camposEnBlanco.length ? (
                    current.camposEnBlanco.map((c) => (
                      <Badge key={c} variant="warning" className="text-[10px]">
                        {c}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-slate-500">Ninguno</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}

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
                title="Contrato E5 reconstruido"
                className="h-full w-full bg-white"
              >
                <iframe
                  title="Contrato E5 reconstruido"
                  src={blobUrl}
                  className="h-full w-full bg-white"
                />
              </object>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Selecciona un PDF
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 bg-white p-3">
            {current?.review ? (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  current.review.estado === "APROBADO"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}
              >
                {current.review.estado === "APROBADO" ? "Aprobado" : "Con observaciones"}
                {current.review.reviewedBy ? ` por ${current.review.reviewedBy}` : ""}
                {current.review.reviewedAt
                  ? ` · ${current.review.reviewedAt.slice(0, 16).replace("T", " ")}`
                  : ""}
                {current.review.observacion ? (
                  <span className="block pt-0.5">«{current.review.observacion}»</span>
                ) : null}
              </div>
            ) : null}
            <textarea
              className="min-h-[60px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Observación (requerida para «Con observaciones», opcional al aprobar)…"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              disabled={!canEdit}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                disabled={!current || busy || !canEdit}
                onClick={() => review("APROBADO")}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Aprobado
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-50"
                disabled={!current || busy || !canEdit}
                onClick={() => review("OBSERVADO")}
              >
                <MessageSquareWarning className="h-3.5 w-3.5" />
                Con observaciones
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              La revisión se guarda en revisiones.json junto a los PDFs; no toca la base de datos
              ni el expediente vivo.{!canEdit ? " (solo lectura)" : ""}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
