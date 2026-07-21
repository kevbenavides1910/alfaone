"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, LayoutGrid, List, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { toast } from "@/components/ui/toaster";
import {
  ExpedienteDocGrid,
  docKey,
} from "@/components/expediente-digital/ExpedienteDocGrid";
import { ExpedientePdfPreviewDialog } from "@/components/expediente-digital/ExpedientePdfPreviewDialog";
import { formatExpedienteVigencia } from "@/components/expediente-digital/expediente-display";
import type {
  ExpedienteDocumento,
  ExpedientePersona,
  ExpedienteTipoDoc,
} from "@/modules/expediente-digital/business/types";

type ViewMode = "grid" | "list";

export default function ExpedienteDigitalDetallePage() {
  const params = useParams();
  const cedulaParam = decodeURIComponent(String(params.cedula ?? ""));
  const { data: session } = useSession();
  const canUpload = hasPermission(session ?? null, "expedienteDigital.upload", "edit");
  const qc = useQueryClient();

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [previewDoc, setPreviewDoc] = useState<ExpedienteDocumento | null>(null);

  const [tipoDoc, setTipoDoc] = useState("");
  const [noEmple, setNoEmple] = useState("");
  const [venceDesde, setVenceDesde] = useState("");
  const [venceHasta, setVenceHasta] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const detailQuery = useQuery({
    queryKey: ["expediente-digital", "detail", cedulaParam],
    enabled: Boolean(cedulaParam),
    queryFn: async (): Promise<ExpedientePersona> => {
      const res = await fetch(`/api/expediente-digital/${encodeURIComponent(cedulaParam)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al cargar expediente");
      return json.data as ExpedientePersona;
    },
  });

  const tiposQuery = useQuery({
    queryKey: ["expediente-digital", "tipos"],
    enabled: canUpload,
    queryFn: async (): Promise<ExpedienteTipoDoc[]> => {
      const res = await fetch("/api/expediente-digital/tipos");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al listar tipos");
      return (json.data?.tipos ?? []) as ExpedienteTipoDoc[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !tipoDoc) throw new Error("Seleccione tipo y archivo PDF");
      const tipoMeta = (tiposQuery.data ?? []).find((t) => t.tipoDocumento === tipoDoc);
      const requiereVigencia = Boolean(tipoMeta?.vence);
      if (requiereVigencia && !venceDesde) {
        throw new Error("Este tipo de documento requiere vigencia desde");
      }
      const fd = new FormData();
      fd.set("tipoDoc", tipoDoc);
      fd.set("file", file);
      if (noEmple.trim()) fd.set("noEmple", noEmple.trim());
      if (requiereVigencia) {
        fd.set("venceDesde", venceDesde);
        if (venceHasta) fd.set("venceHasta", venceHasta);
      }
      const res = await fetch(
        `/api/expediente-digital/${encodeURIComponent(cedulaParam)}/upload`,
        { method: "POST", body: fd },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al subir");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Documento guardado en el expediente");
      setFile(null);
      setTipoDoc("");
      setVenceDesde("");
      setVenceHasta("");
      qc.invalidateQueries({ queryKey: ["expediente-digital", "detail", cedulaParam] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tipoSeleccionado = (tiposQuery.data ?? []).find((t) => t.tipoDocumento === tipoDoc);
  const requiereVigencia = Boolean(tipoSeleccionado?.vence);
  const detail = detailQuery.data;
  const docs = detail?.documentos ?? [];

  const columnDefs: TableColumnFilterDef<ExpedienteDocumento>[] = useMemo(
    () => [
      {
        key: "tipoDoc",
        label: "Tipo",
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
        getValue: (r) => r.tipoDoc,
      },
      {
        key: "desc",
        label: "Descripción",
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
        getValue: (r) => r.tipoDescripcion,
      },
      {
        key: "noEmple",
        label: "Código",
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
        getValue: (r) => r.noEmple,
      },
      {
        key: "version",
        label: "Ver.",
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
        getValue: (r) => String(r.nVersion),
      },
      {
        key: "estado",
        label: "Estado",
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
        getValue: (r) => r.estado ?? "",
      },
      {
        key: "vigencia",
        label: "Vigencia",
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
        getValue: (r) => formatExpedienteVigencia(r.venceDesde, r.venceHasta),
      },
      {
        key: "actions",
        label: "",
        filterable: false,
        headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2",
        getValue: () => "",
      },
    ],
    [],
  );

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? docs.filter(
          (d) =>
            d.tipoDoc.toLowerCase().includes(q) ||
            d.tipoDescripcion.toLowerCase().includes(q) ||
            d.noEmple.toLowerCase().includes(q),
        )
      : docs;
    return filterRowsByColumnFilters(base, columnFilters, columnDefs);
  }, [docs, search, columnFilters, columnDefs]);

  const fileUrl = (doc: ExpedienteDocumento, inline: boolean) => {
    const sp = new URLSearchParams({
      tipoDoc: doc.tipoDoc,
      noEmple: doc.noEmple,
      nVersion: String(doc.nVersion),
    });
    if (inline) sp.set("inline", "1");
    return `/api/expediente-digital/${encodeURIComponent(cedulaParam)}/file?${sp}`;
  };

  const openPreview = (doc: ExpedienteDocumento) => setPreviewDoc(doc);

  return (
    <ModulePage wide>
      <ModulePageHeader
        title={detail?.nombre || "Expediente digital"}
        description={
          detail
            ? `Cédula ${detail.cedula} · ${detail.empleos.length} código(s) NAF · canónico ${detail.noEmpleCanonico ?? "—"} (cía ${detail.noCiaCanonica ?? "—"})`
            : `Cédula ${cedulaParam}`
        }
        actions={
          <Button asChild variant="outline">
            <Link href="/expediente-digital">Volver a búsqueda</Link>
          </Button>
        }
      />

      {detailQuery.isError ? (
        <p className="text-sm text-red-600">{(detailQuery.error as Error).message}</p>
      ) : null}
      {detailQuery.isLoading ? <p className="text-sm text-gray-500">Cargando…</p> : null}

      {detail ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-gray-800">Códigos de empleo</h2>
            <div className="flex flex-wrap gap-2">
              {detail.empleos.map((e) => (
                <Badge
                  key={`${e.noCia}-${e.noEmple}`}
                  variant={e.estado === "A" ? "default" : "secondary"}
                  className="tabular-nums"
                >
                  {e.noCia}-{e.noEmple}
                  {e.estado ? ` (${e.estado})` : ""}
                </Badge>
              ))}
            </div>
          </div>

          {canUpload ? (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Upload className="h-4 w-4" />
                Agregar documento
              </h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Tipo de documento
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={tipoDoc}
                    onChange={(e) => setTipoDoc(e.target.value)}
                  >
                    <option value="">Seleccione…</option>
                    {(tiposQuery.data ?? []).map((t) => (
                      <option key={t.tipoDocumento} value={t.tipoDocumento}>
                        {t.tipoDocumento} — {t.descripcion}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Código empleado (opcional)
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={noEmple}
                    onChange={(e) => setNoEmple(e.target.value)}
                  >
                    <option value="">Canónico ({detail.noEmpleCanonico ?? "—"})</option>
                    {detail.empleos.map((e) => (
                      <option key={`${e.noCia}-${e.noEmple}`} value={e.noEmple}>
                        {e.noCia}-{e.noEmple} {e.estado ? `(${e.estado})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  Archivo PDF
                  <Input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {requiereVigencia ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                      Vigencia desde *
                      <Input
                        type="date"
                        value={venceDesde}
                        onChange={(e) => setVenceDesde(e.target.value)}
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                      Vigencia hasta
                      <Input
                        type="date"
                        value={venceHasta}
                        onChange={(e) => setVenceHasta(e.target.value)}
                      />
                    </label>
                  </>
                ) : tipoDoc ? (
                  <p className="col-span-full text-xs text-gray-500">
                    Vigencia indefinida (según catálogo NAF del tipo).
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                disabled={!file || !tipoDoc || uploadMutation.isPending}
                onClick={() => uploadMutation.mutate()}
              >
                {uploadMutation.isPending ? "Guardando…" : "Guardar en expediente"}
              </Button>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#e8eef5] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  Documentos ({displayed.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Vista tipo expediente NAF · clic para previsualizar
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar tipo o descripción…"
                    className="h-9 w-52 bg-white pl-8 text-sm"
                  />
                </div>
                <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    className={viewMode === "grid" ? "bg-slate-800 hover:bg-slate-800" : ""}
                    onClick={() => setViewMode("grid")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewMode === "list" ? "default" : "ghost"}
                    className={viewMode === "list" ? "bg-slate-800 hover:bg-slate-800" : ""}
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 bg-white"
                  disabled={docs.length === 0}
                  onClick={() =>
                    exportRowsToExcel({
                      filename: `expediente-${detail.cedula}`,
                      sheetName: "Documentos",
                      rows: displayed.map((d) => ({
                        Tipo: d.tipoDoc,
                        Descripcion: d.tipoDescripcion,
                        Codigo: d.noEmple,
                        Version: d.nVersion,
                        Estado: d.estado ?? "",
                        VenceDesde: d.venceDesde ?? "",
                        VenceHasta: d.venceHasta ?? "",
                      })),
                      columnWidths: [10, 40, 12, 8, 10, 12, 12],
                    })
                  }
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </div>

            <div className="p-4">
              {viewMode === "grid" ? (
                <ExpedienteDocGrid
                  docs={displayed}
                  selectedKey={previewDoc ? docKey(previewDoc) : null}
                  onSelect={openPreview}
                />
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="max-h-[min(65vh,680px)] overflow-auto">
                    <table data-table-id="expediente-digital-detalle" className="min-w-full text-left text-sm">
                      <thead>
                        <TableColumnFilterHead
                          tableId="expediente-digital-detalle"
                          defaultColumnWidths={{
                            tipoDoc: 140,
                            desc: 220,
                            noEmple: 120,
                            version: 90,
                            estado: 100,
                            vigencia: 110,
                            actions: 90,
                          }}
                          columns={columnDefs}
                          rows={docs}
                          filters={columnFilters}
                          onFilterChange={(k, v) =>
                            setColumnFilters((s) => ({ ...s, [k]: v }))
                          }
                        />
                      </thead>
                      <tbody>
                        {displayed.map((d) => (
                          <tr
                            key={docKey(d)}
                            className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                            onClick={() => openPreview(d)}
                          >
                            <td className="px-3 py-2 font-medium tabular-nums">{d.tipoDoc}</td>
                            <td className="px-3 py-2 text-gray-700">{d.tipoDescripcion}</td>
                            <td className="px-3 py-2 tabular-nums">{d.noEmple}</td>
                            <td className="px-3 py-2 tabular-nums">{d.nVersion}</td>
                            <td className="px-3 py-2">
                              {d.estado ? <Badge variant="secondary">{d.estado}</Badge> : "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-600">
                              {formatExpedienteVigencia(d.venceDesde, d.venceHasta)}
                            </td>
                            <td className="space-x-2 whitespace-nowrap px-3 py-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPreview(d);
                                }}
                              >
                                Ver
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={fileUrl(d, false)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Descargar
                                </a>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {displayed.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">Sin documentos registrados.</p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ExpedientePdfPreviewDialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        doc={previewDoc}
        previewUrl={previewDoc ? fileUrl(previewDoc, true) : null}
        downloadUrl={previewDoc ? fileUrl(previewDoc, false) : null}
      />
    </ModulePage>
  );
}
