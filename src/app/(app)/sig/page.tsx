"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  hasActiveColumnFilters,
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Eye, FileText, Pencil, Plus, Search } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";
import { SIG_DOCUMENT_STATUS_LABELS } from "@/modules/sig/business/document-labels";

const STATUS_LABELS = SIG_DOCUMENT_STATUS_LABELS;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

interface DocumentRow {
  id: string;
  code: string;
  title: string;
  status: string;
  revisionIntervalDays: number | null;
  documentType: { id: string; code: string; name: string };
  process: { id: string; code: string; name: string } | null;
  searchMatch?: {
    snippet: string;
    matchedIn: "code" | "title" | "content";
    matchedVersionId: string | null;
  } | null;
  currentVersion: {
    id: string;
    versionLabel: string;
    fileName: string;
    mimeType: string;
    revisionDate: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
    downloadUrl: string;
    previewUrl: string;
    canPreview: boolean;
  } | null;
}

interface Reminder {
  documentId: string;
  code: string;
  title: string;
  lastRevisionDate: string;
  nextRevisionDue: string;
  daysUntilDue: number;
  isOverdue: boolean;
}

export default function SigBibliotecaPage() {
  const { data: session } = useSession();
  const canUpload = hasPermission(session, "sig.documentos", "edit");
  const canEditMetadata =
    hasPermission(session, "sig.biblioteca", "edit") ||
    hasPermission(session, "sig.documentos", "edit");
  const [q, setQ] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [processId, setProcessId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data: types = [] } = useQuery({
    queryKey: ["sig-tipos-filter"],
    queryFn: async () => {
      const r = await fetch("/api/sig/tipos-documento", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar tipos");
      const json = await r.json();
      return (Array.isArray(json.data) ? json.data : []) as Array<{ id: string; name: string }>;
    },
  });

  const { data: processes = [] } = useQuery({
    queryKey: ["sig-procesos-options"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar procesos");
      const json = await r.json();
      return (Array.isArray(json.data) ? json.data : []) as Array<{
        id: string;
        code?: string;
        name: string;
      }>;
    },
  });

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const debouncedColumnFilters = useDebouncedValue(columnFilters, 300);
  const columnFiltersKey = JSON.stringify(debouncedColumnFilters);
  const [filtersPageKey, setFiltersPageKey] = useState(columnFiltersKey);
  if (columnFiltersKey !== filtersPageKey) {
    setFiltersPageKey(columnFiltersKey);
    setPage(1);
  }
  const effectivePage = columnFiltersKey !== filtersPageKey ? 1 : page;

  const listUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(effectivePage));
    sp.set("pageSize", "25");
    if (q.trim()) sp.set("q", q.trim());
    if (documentTypeId) sp.set("documentTypeId", documentTypeId);
    if (processId) sp.set("processId", processId);
    if (status) sp.set("status", status);
    const cf = debouncedColumnFilters;
    if (cf.codigo?.trim()) sp.set("code", cf.codigo.trim());
    if (cf.titulo?.trim()) sp.set("title", cf.titulo.trim());
    if (cf.tipo?.trim()) {
      sp.set("typeName", cf.tipo);
      sp.set("typeExact", "1");
    }
    if (cf.proceso?.trim()) {
      sp.set("processName", cf.proceso);
      sp.set("processExact", "1");
    }
    if (cf.version?.trim()) sp.set("version", cf.version.trim());
    if (cf.ultima?.trim()) sp.set("revision", cf.ultima.trim());
    if (cf.estado?.trim()) {
      sp.set("statusLabel", cf.estado);
      sp.set("statusExact", "1");
    }
    return `/api/sig/documents?${sp}`;
  }, [q, effectivePage, documentTypeId, processId, status, debouncedColumnFilters]);

  const { data: listData, isLoading } = useQuery({
    queryKey: ["sig-documents", listUrl],
    queryFn: async () => {
      const r = await fetch(listUrl, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar documentos");
      return r.json() as Promise<{ data: { total: number; totalPages: number; rows: DocumentRow[] } }>;
    },
  });

  const { data: remindersData } = useQuery({
    queryKey: ["sig-revision-reminders"],
    queryFn: async () => {
      const r = await fetch("/api/sig/revision-reminders?withinDays=30", { credentials: "same-origin" });
      if (!r.ok) return { data: [] as Reminder[] };
      return r.json() as Promise<{ data: Reminder[] }>;
    },
  });

  const rows = listData?.data.rows ?? [];
  const totalPages = listData?.data.totalPages ?? 1;
  const reminders = remindersData?.data ?? [];

  const typeOptions = useMemo(
    () => types.map((t) => ({ value: t.name, label: t.name })),
    [types]
  );
  const processOptions = useMemo(
    () => processes.map((p) => ({ value: p.name, label: p.name })),
    [processes]
  );
  const statusOptions = useMemo(
    () => Object.values(STATUS_LABELS).map((label) => ({ value: label, label })),
    []
  );

  const documentColumnDefs = useMemo((): TableColumnFilterDef<DocumentRow>[] => [
    { key: "codigo", label: "Código", headerClassName: "px-3 py-2", mode: "search", getValue: (r) => r.code },
    { key: "titulo", label: "Título", headerClassName: "px-3 py-2", mode: "search", getValue: (r) => r.title },
    {
      key: "tipo",
      label: "Tipo",
      headerClassName: "px-3 py-2",
      mode: "select",
      options: typeOptions,
      getValue: (r) => r.documentType.name,
    },
    {
      key: "proceso",
      label: "Proceso",
      headerClassName: "px-3 py-2",
      mode: "select",
      options: processOptions,
      getValue: (r) => r.process?.name ?? "",
    },
    { key: "version", label: "Versión", headerClassName: "px-3 py-2", mode: "search", getValue: (r) => r.currentVersion?.versionLabel ?? "" },
    {
      key: "ultima",
      label: "Última revisión",
      headerClassName: "px-3 py-2",
      mode: "search",
      placeholder: "dd/mm/aaaa",
      getValue: (r) => (r.currentVersion ? formatDate(r.currentVersion.revisionDate) : ""),
    },
    {
      key: "estado",
      label: "Estado",
      headerClassName: "px-3 py-2",
      mode: "select",
      options: statusOptions,
      getValue: (r) => STATUS_LABELS[r.status] ?? r.status,
    },
    { key: "acciones", label: "Acciones", headerClassName: "px-3 py-2 text-right", align: "right", filterable: false, getValue: () => "" },
  ], [typeOptions, processOptions, statusOptions]);

  const resetFilters = () => {
    setDocumentTypeId("");
    setProcessId("");
    setStatus("");
    setQ("");
    setColumnFilters({});
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    documentTypeId || processId || status || q.trim() || hasActiveColumnFilters(columnFilters)
  );

  return (
    <>
      <Topbar title="SIG — Biblioteca documental" />
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {reminders.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2 text-amber-900 font-medium">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Recordatorios de revisión ({reminders.length})
                </span>
                <Link href="/sig/vigencias" className="text-xs font-normal text-teal-800 hover:underline">
                  Ver todas las vigencias
                </Link>
              </div>
              <ul className="space-y-1 text-sm">
                {reminders.slice(0, 5).map((r) => (
                  <li key={r.documentId}>
                    <Link href={`/sig/documentos/${r.documentId}`} className="text-teal-800 hover:underline">
                      {r.code}
                    </Link>
                    {" — "}
                    {r.isOverdue ? (
                      <span className="text-red-700 font-medium">Revisión vencida</span>
                    ) : (
                      <span>Revisar en {r.daysUntilDue} día(s)</span>
                    )}
                    {" · última revisión "}
                    {formatDate(r.lastRevisionDate)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          La búsqueda incluye el texto dentro de PDF, Word, Excel e imágenes (OCR en español e inglés).
          Tras subir un documento, la indexación puede tardar unos segundos.
        </p>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Label className="text-xs mb-1 block">Buscar</Label>
            <Search className="absolute left-3 top-8 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Código, título o contenido…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">Tipo documental</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm bg-background"
              value={documentTypeId}
              onChange={(e) => {
                setDocumentTypeId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <Label className="text-xs mb-1 block">Proceso</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm bg-background"
              value={processId}
              onChange={(e) => {
                setProcessId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {processes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <Label className="text-xs mb-1 block">Estado</Label>
            <select
              className="w-full h-10 rounded-md border px-3 text-sm bg-background"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          )}
          {canUpload && (
            <Button asChild className="ml-auto">
              <Link href="/sig/documentos/nuevo">
                <Plus className="h-4 w-4 mr-1" />
                Nuevo documento
              </Link>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table data-table-id="sig-documentos" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="sig-documentos"
                  defaultColumnWidths={{
                    codigo: 120,
                    titulo: 220,
                    tipo: 120,
                    proceso: 140,
                    version: 90,
                    ultima: 110,
                    estado: 100,
                    acciones: 90,
                  }}
                  columns={documentColumnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                />
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No hay documentos con los filtros seleccionados
                    </td>
                  </tr>
                )}
                {rows.map((row) => {
                  const v = row.currentVersion;
                  const detailHref = `/sig/documentos/${row.id}#procedimiento`;
                  return (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-muted/20 cursor-pointer"
                      onClick={(e) => {
                        const t = e.target as HTMLElement;
                        if (t.closest("a,button")) return;
                        window.location.href = detailHref;
                      }}
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link href={detailHref} className="hover:underline text-foreground">
                          {row.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={detailHref} className="text-teal-800 hover:underline font-medium">
                          {row.title}
                        </Link>
                        {row.searchMatch?.matchedIn === "content" && row.searchMatch.snippet && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            <span className="font-medium text-slate-600">Contenido: </span>
                            {row.searchMatch.snippet}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.documentType.name}</td>
                      <td className="px-3 py-2">{row.process?.name ?? "—"}</td>
                      <td className="px-3 py-2">{v?.versionLabel ?? "—"}</td>
                      <td className="px-3 py-2">{v ? formatDate(v.revisionDate) : "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.status === "APPROVED" ? "default" : "secondary"}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Ver procedimiento">
                            <Link href={detailHref}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {v ? (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Descargar archivo">
                              <a href={v.downloadUrl} download={v.fileName}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="Sin archivo">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          {canEditMetadata && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Editar">
                              <Link href={detailHref}>
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Ver ficha">
                            <Link href={detailHref}>
                              <FileText className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={effectivePage <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm self-center">
              Página {effectivePage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={effectivePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
