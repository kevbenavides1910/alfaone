"use client";

import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState, useCallback } from "react";
import { FileStack, Loader2, Trash2, Upload, FileUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { useCompanies } from "@/lib/hooks/use-companies";
import { parseSigFilename } from "@/modules/sig/services/parse-filename";

type BulkRow = {
  id: string;
  file: File;
  code: string;
  title: string;
  versionLabel: string;
};

type BulkImportResult = {
  total: number;
  created: number;
  failed: number;
  results: {
    index: number;
    fileName: string;
    code: string;
    success: boolean;
    documentId?: string;
    error?: string;
  }[];
};

function newRow(file: File): BulkRow {
  const parsed = parseSigFilename(file.name);
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    code: parsed.code,
    title: parsed.title,
    versionLabel: parsed.versionLabel,
  };
}

const ACCEPTED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".txt",
  ".csv",
]);

function isAcceptedBulkFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return ACCEPTED_EXTENSIONS.has(ext);
}

function filesFromList(list: FileList | File[]): File[] {
  return Array.from(list).filter(isAcceptedBulkFile);
}

export default function SigCargaMasivaPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.data ?? [];

  const { data: typesData } = useQuery({
    queryKey: ["sig-tipos"],
    queryFn: async () => {
      const r = await fetch("/api/sig/tipos-documento", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar tipos");
      return r.json() as Promise<{ data: { id: string; code: string; name: string }[] }>;
    },
  });

  const { data: processesData } = useQuery({
    queryKey: ["sig-procesos"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar procesos");
      return r.json() as Promise<{ data: { id: string; code: string; name: string }[] }>;
    },
  });

  const types = typesData?.data ?? [];
  const processes = processesData?.data ?? [];

  const [shared, setShared] = useState({
    documentTypeId: "",
    processId: "",
    company: "",
    revisionIntervalDays: "365",
    changeSummary: "Carga masiva",
  });
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    const incoming = files.map(newRow);
    setRows((prev) => {
      const names = new Set(prev.map((r) => r.file.name));
      const merged = [...prev];
      for (const row of incoming) {
        if (!names.has(row.file.name)) {
          merged.push(row);
          names.add(row.file.name);
        }
      }
      return merged;
    });
    setResult(null);
  }, []);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!shared.documentTypeId) throw new Error("Seleccione el tipo documental");
      if (rows.length === 0) throw new Error("Agregue al menos un archivo");

      const codes = rows.map((r) => r.code.trim().toUpperCase());
      const dup = codes.find((c, i) => codes.indexOf(c) !== i);
      if (dup) throw new Error(`Hay códigos duplicados en la lista (${dup})`);

      for (const row of rows) {
        if (!row.code.trim()) throw new Error(`Falta código en ${row.file.name}`);
        if (!row.title.trim()) throw new Error(`Falta título en ${row.file.name}`);
      }

      const fd = new FormData();
      fd.append(
        "metadata",
        JSON.stringify({
          documentTypeId: shared.documentTypeId,
          processId: shared.processId || null,
          company: shared.company || null,
          revisionIntervalDays: shared.revisionIntervalDays
            ? Number(shared.revisionIntervalDays)
            : null,
          changeSummary: shared.changeSummary || "Carga masiva",
          items: rows.map((r) => ({
            code: r.code.trim(),
            title: r.title.trim(),
            versionLabel: r.versionLabel.trim() || "1",
          })),
        }),
      );
      rows.forEach((r) => fd.append("files", r.file));

      const r = await fetch("/api/sig/documents/bulk", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error en la carga masiva");
      return json.data as BulkImportResult;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.failed === 0) {
        toast.success("Carga completada", `${data.created} documento(s) publicados en la biblioteca.`);
        setRows([]);
      } else if (data.created > 0) {
        toast.info(
          "Carga parcial",
          `${data.created} creado(s), ${data.failed} con error. Revise el detalle.`,
        );
      } else {
        toast.error("Sin documentos creados", "Revise los errores en el detalle.");
      }
    },
    onError: (e: Error) => toast.error("Error", e.message),
  });

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length) return;
    const accepted = filesFromList(fileList);
    if (accepted.length === 0) {
      toast.error("Archivos no válidos", "Use PDF, Word, Excel, imágenes o CSV.");
      return;
    }
    if (accepted.length < fileList.length) {
      toast.info(
        "Algunos archivos omitidos",
        `${fileList.length - accepted.length} archivo(s) con formato no permitido.`,
      );
    }
    addFiles(accepted);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFilesSelected(e.dataTransfer.files);
    }
  }

  function updateRow(
    id: string,
    patch: Partial<Pick<BulkRow, "code" | "title" | "versionLabel">>,
  ) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function reparseRow(id: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const parsed = parseSigFilename(r.file.name);
        return {
          ...r,
          code: parsed.code,
          title: parsed.title,
          versionLabel: parsed.versionLabel,
        };
      }),
    );
  }

  const todayLabel = new Date().toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const canUpload = rows.length > 0 && shared.documentTypeId && !uploadMutation.isPending;

  return (
    <>
      <Topbar title="SIG — Carga masiva" />
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileStack className="h-5 w-5 text-teal-700" />
              Configuración del lote
            </CardTitle>
            <CardDescription>
              Defina tipo documental y proceso para todo el grupo. El código y título se detectan
              del nombre de cada archivo; puede editarlos antes de subir. Los documentos se publican
              directamente en la biblioteca (sin aprobación). La fecha de revisión será{" "}
              <strong>{todayLabel}</strong> (fecha de carga).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo documental *</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={shared.documentTypeId}
                  onChange={(e) => setShared((s) => ({ ...s, documentTypeId: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Proceso</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={shared.processId}
                  onChange={(e) => setShared((s) => ({ ...s, processId: e.target.value }))}
                >
                  <option value="">Sin proceso</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Empresa</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={shared.company}
                  onChange={(e) => setShared((s) => ({ ...s, company: e.target.value }))}
                >
                  <option value="">Todas / corporativo</option>
                  {companies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Intervalo revisión (días)</Label>
                <Input
                  type="number"
                  min={1}
                  value={shared.revisionIntervalDays}
                  onChange={(e) =>
                    setShared((s) => ({ ...s, revisionIntervalDays: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <Label>Resumen de cambios (opcional)</Label>
              <Input
                value={shared.changeSummary}
                onChange={(e) => setShared((s) => ({ ...s, changeSummary: e.target.value }))}
                placeholder="Carga masiva"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archivos</CardTitle>
            <CardDescription>
              Seleccione varios archivos (PDF, Word, Excel, imágenes — máx. 50 MB c/u). Nombre
              sugerido:{" "}
              <code className="text-xs bg-muted px-1 rounded">
                PO-RH-06 Código de Vestimenta V1.pdf
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
              }}
              className={cn(
                "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                isDragging
                  ? "border-teal-500 bg-teal-50"
                  : "border-muted-foreground/30 bg-muted/20 hover:border-teal-400 hover:bg-muted/40",
              )}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp
                className={cn(
                  "h-10 w-10 mx-auto mb-3",
                  isDragging ? "text-teal-600" : "text-muted-foreground",
                )}
              />
              <p className="text-sm font-medium text-slate-700">
                Arrastre documentos aquí o haga clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Puede soltar varios archivos a la vez
              </p>
              <Input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.csv"
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {rows.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setRows([])}>
                  Limpiar lista ({rows.length})
                </Button>
              )}
            </div>

            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-medium">Archivo</th>
                      <th className="text-left p-2 font-medium min-w-[140px]">Código</th>
                      <th className="text-left p-2 font-medium min-w-[200px]">Título</th>
                      <th className="text-left p-2 font-medium w-24">Versión</th>
                      <th className="p-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2 align-top">
                          <span className="line-clamp-2 break-all" title={row.file.name}>
                            {row.file.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {(row.file.size / 1024).toFixed(0)} KB
                          </span>
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            value={row.code}
                            onChange={(e) => updateRow(row.id, { code: e.target.value })}
                            className="h-9 font-mono text-xs"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            value={row.title}
                            onChange={(e) => updateRow(row.id, { title: e.target.value })}
                            className="h-9"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Input
                            value={row.versionLabel}
                            onChange={(e) => updateRow(row.id, { versionLabel: e.target.value })}
                            className="h-9 font-mono text-xs w-20"
                            placeholder="1"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Redetectar desde nombre de archivo"
                              onClick={() => reparseRow(row.id)}
                            >
                              ↺
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => removeRow(row.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button disabled={!canUpload} onClick={() => uploadMutation.mutate()}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Subiendo {rows.length} documento(s)…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Subir {rows.length > 0 ? rows.length : ""} documento(s)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado</CardTitle>
              <CardDescription>
                {result.created} creado(s) · {result.failed} con error · {result.total} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {result.results.map((r) => (
                  <li
                    key={`${r.index}-${r.fileName}`}
                    className={`rounded-md border p-2 ${r.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
                  >
                    <div className="font-medium">
                      {r.success ? "✓" : "✗"} {r.code}{" "}
                      <span className="font-normal text-muted-foreground">({r.fileName})</span>
                    </div>
                    {r.success && r.documentId ? (
                      <Link
                        href={`/sig/documentos/${r.documentId}`}
                        className="text-teal-700 hover:underline text-xs"
                      >
                        Ver documento
                      </Link>
                    ) : (
                      r.error && <p className="text-red-700 text-xs mt-1">{r.error}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
