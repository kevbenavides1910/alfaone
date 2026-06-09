"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Eye, FileText, Plus, Search } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING_APPROVAL: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  SUPERSEDED: "Superseded",
  OBSOLETE: "Obsoleto",
};

interface DocumentRow {
  id: string;
  code: string;
  title: string;
  status: string;
  revisionIntervalDays: number | null;
  documentType: { id: string; code: string; name: string };
  process: { id: string; code: string; name: string } | null;
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
  const [q, setQ] = useState("");
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [processId, setProcessId] = useState("");
  const [page, setPage] = useState(1);

  const { data: typesData } = useQuery({
    queryKey: ["sig-tipos-filter"],
    queryFn: async () => {
      const r = await fetch("/api/sig/tipos-documento", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar tipos");
      return r.json() as Promise<{ data: { id: string; name: string }[] }>;
    },
  });

  const { data: processesData } = useQuery({
    queryKey: ["sig-procesos-filter"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar procesos");
      return r.json() as Promise<{ data: { id: string; name: string }[] }>;
    },
  });

  const types = typesData?.data ?? [];
  const processes = processesData?.data ?? [];

  const listUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (q.trim()) sp.set("q", q.trim());
    if (documentTypeId) sp.set("documentTypeId", documentTypeId);
    if (processId) sp.set("processId", processId);
    return `/api/sig/documents?${sp}`;
  }, [q, page, documentTypeId, processId]);

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

  const resetFilters = () => {
    setDocumentTypeId("");
    setProcessId("");
    setQ("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(documentTypeId || processId || q.trim());

  return (
    <>
      <Topbar title="SIG — Biblioteca documental" />
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {reminders.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 text-amber-900 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Recordatorios de revisión ({reminders.length})
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Proceso</th>
                  <th className="px-3 py-2">Versión</th>
                  <th className="px-3 py-2">Última revisión</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
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
                  return (
                    <tr key={row.id} className="border-b hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">{row.documentType.name}</td>
                      <td className="px-3 py-2">{row.process?.name ?? "—"}</td>
                      <td className="px-3 py-2">{v?.versionLabel ?? "—"}</td>
                      <td className="px-3 py-2">{v ? formatDate(v.revisionDate) : "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.status === "APPROVED" ? "default" : "secondary"}>
                          {STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {v?.canPreview ? (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Previsualizar">
                              <a href={v.previewUrl} target="_blank" rel="noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-40"
                              disabled
                              title="Vista previa solo para PDF e imágenes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {v ? (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Descargar">
                              <a href={v.downloadUrl} download={v.fileName}>
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="Sin archivo">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild title="Ver ficha">
                            <Link href={`/sig/documentos/${row.id}`}>
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
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-sm self-center">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
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
