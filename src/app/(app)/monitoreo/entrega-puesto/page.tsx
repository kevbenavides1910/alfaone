"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, FileSpreadsheet, FileText, Loader2, Printer, Upload } from "lucide-react";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import {
  ENTREGA_PUESTO_GROUPS,
  entregaPuestoItems,
  entregaResultado,
  fallaCount,
  validateEntrega,
  type EntregaCheck,
} from "@/modules/monitoreo/business/entrega-puesto";

type EntregaRow = {
  id: string;
  fecha: string;
  hora: string;
  saliente: string;
  entrante: string;
  observaciones: string;
  checks: EntregaCheck[];
  resultado: string;
  createdAt: string;
};

const ITEMS = entregaPuestoItems();
const STATUS_LABEL: Record<string, string> = {
  "": "Sin verificar",
  OK: "En orden / en línea",
  FALLA: "Falla / pendiente",
  NA: "No aplica",
};

function todayStamp() {
  const d = new Date();
  const fecha = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join(
    "-",
  );
  const hora = [String(d.getHours()).padStart(2, "0"), String(d.getMinutes()).padStart(2, "0")].join(":");
  return { fecha, hora };
}

function statusClass(status: string) {
  if (status === "OK") return "border-emerald-400 text-emerald-800";
  if (status === "FALLA") return "border-red-400 text-red-700";
  if (status === "NA") return "border-slate-300 text-slate-500";
  return "";
}

export default function EntregaPuestoPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "monitoreo.operacion", "edit");
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = todayStamp();
  const [fecha, setFecha] = useState(initial.fecha);
  const [hora, setHora] = useState(initial.hora);
  const [saliente, setSaliente] = useState("");
  const [entrante, setEntrante] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [statuses, setStatuses] = useState<string[]>(() => ITEMS.map(() => ""));
  const [notice, setNotice] = useState("");
  const [viewing, setViewing] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ id: string; title: string } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ data: EntregaRow[] }>({
    queryKey: ["monitoreo-entrega-puesto"],
    queryFn: () => fetch("/api/monitoreo/entrega-puesto?limit=300", { credentials: "same-origin" }).then((r) => r.json()),
  });
  const rows = data?.data ?? [];

  const draftChecks = ITEMS.map((item, i) => ({
    ...item,
    status: statuses[i] ?? "",
  }));
  const verified = statuses.filter(Boolean).length;
  const fallas = fallaCount(draftChecks);

  function resetForm() {
    const stamp = todayStamp();
    setFecha(stamp.fecha);
    setHora(stamp.hora);
    setSaliente("");
    setEntrante("");
    setObservaciones("");
    setStatuses(ITEMS.map(() => ""));
    setViewing(false);
    setRecordId(null);
    setNotice("Formulario nuevo listo.");
  }

  function openPdf(row: Pick<EntregaRow, "id" | "fecha" | "hora" | "saliente" | "entrante">) {
    setPdfPreview({
      id: row.id,
      title: `${row.fecha} ${row.hora} · ${row.saliente} entrega a ${row.entrante}`,
    });
  }

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    if (!pdfPreview) {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfError(null);
      setPdfLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPdfLoading(true);
    setPdfError(null);
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    void (async () => {
      try {
        const res = await fetch(`/api/monitoreo/entrega-puesto/${pdfPreview.id}/pdf`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("No se pudo cargar el PDF");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPdfBlobUrl(objectUrl);
      } catch (e) {
        if (!cancelled) setPdfError(e instanceof Error ? e.message : "No se pudo cargar el PDF");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfPreview]);

  const save = useMutation({
    mutationFn: async (payload: {
      fecha: string;
      hora: string;
      saliente: string;
      entrante: string;
      observaciones: string;
      checks: Array<{ group: string; label: string; status: string }>;
    }) => {
      const r = await fetch("/api/monitoreo/entrega-puesto", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      return json;
    },
    onSuccess: (json: { data?: { id?: string } }) => {
      toast.success("Entrega guardada");
      setNotice("Entrega guardada. Quedó en el historial del centro de monitoreo.");
      setViewing(false);
      if (json.data?.id) setRecordId(json.data.id);
      void qc.invalidateQueries({ queryKey: ["monitoreo-entrega-puesto"] });
    },
    onError: (e: Error) => {
      setNotice(e.message);
      toast.error(e.message);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/monitoreo/entrega-puesto/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo eliminar");
    },
    onSuccess: () => {
      toast.success("Entrega eliminada");
      void qc.invalidateQueries({ queryKey: ["monitoreo-entrega-puesto"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function loadRow(row: EntregaRow) {
    setFecha(row.fecha);
    setHora(row.hora.slice(0, 5));
    setSaliente(row.saliente);
    setEntrante(row.entrante);
    setObservaciones(row.observaciones);
    setStatuses(
      ITEMS.map((item) => {
        const found = row.checks.find((c) => c.group === item.group && c.label === item.label);
        return found?.status ?? "";
      }),
    );
    setViewing(true);
    setRecordId(row.id);
    setNotice("Registro histórico cargado para consulta. Guardar creará una entrega nueva.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onImportFile(file: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast.error("El archivo no es un JSON válido.");
      return;
    }
    if (!Array.isArray(parsed)) {
      toast.error("El respaldo debe ser una lista de entregas.");
      return;
    }
    if (!window.confirm(`¿Importar ${parsed.length} registros? Los que ya existan se omiten.`)) return;
    const r = await fetch("/api/monitoreo/entrega-puesto/import", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    const json = await r.json();
    if (!r.ok) {
      toast.error(json.error?.message ?? "No se pudo importar");
      return;
    }
    const inserted = json.data?.inserted ?? 0;
    const skipped = json.data?.skipped ?? 0;
    toast.success(`Importados ${inserted}. Omitidos ${skipped}.`);
    setNotice(`Respaldo importado: ${inserted} nuevos, ${skipped} ya estaban.`);
    void qc.invalidateQueries({ queryKey: ["monitoreo-entrega-puesto"] });
  }

  const columnDefs: TableColumnFilterDef<EntregaRow>[] = useMemo(
    () => [
      {
        key: "fecha",
        label: "Fecha / hora",
        headerClassName: "px-3 py-2",
        getValue: (r) => `${r.fecha} ${r.hora}`,
      },
      { key: "entrega", label: "Entrega", headerClassName: "px-3 py-2", getValue: (r) => r.saliente },
      { key: "recibe", label: "Recibe", headerClassName: "px-3 py-2", getValue: (r) => r.entrante },
      { key: "resultado", label: "Resultado", headerClassName: "px-3 py-2", getValue: (r) => r.resultado },
      { key: "acciones", label: "Acciones", headerClassName: "px-3 py-2", filterable: false, getValue: () => "" },
    ],
    [],
  );
  const displayed = filterRowsByColumnFilters(rows, columnFilters, columnDefs);

  function exportExcel() {
    exportRowsToExcel({
      filename: "grupo-alfa-entregas-puesto",
      sheetName: "Entregas",
      rows: displayed.map((r) => {
        const base: Record<string, string> = {
          Fecha: r.fecha,
          Hora: r.hora,
          Entrega: r.saliente,
          Recibe: r.entrante,
          Resultado: r.resultado || entregaResultado(r.checks),
          Observaciones: r.observaciones,
        };
        for (const item of ITEMS) {
          const found = r.checks.find((c) => c.group === item.group && c.label === item.label);
          base[`${item.group} - ${item.label}`] = found?.status ?? "";
        }
        return base;
      }),
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-start gap-3 border-b-2 border-amber-400 pb-3">
        <ClipboardCheck className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h1 className="text-xl font-semibold">GRUPO ALFA · Entrega de puesto</h1>
          <p className="text-sm text-slate-500">
            Centro de Monitoreo · Checklist de entrega y recepción de puesto. Control operativo de cambio de turno.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Datos del turno</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hora">Hora de entrega</Label>
            <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="saliente">Operador que entrega</Label>
            <Input
              id="saliente"
              placeholder="Nombre completo"
              value={saliente}
              onChange={(e) => setSaliente(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entrante">Operador que recibe</Label>
            <Input
              id="entrante"
              placeholder="Nombre completo"
              value={entrante}
              onChange={(e) => setEntrante(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {ENTREGA_PUESTO_GROUPS.map(([name, labels], groupIndex) => (
        <Card key={name}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {groupIndex + 1}. {name}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {labels.map((label) => {
              const idx = ITEMS.findIndex((item) => item.group === name && item.label === label);
              const value = statuses[idx] ?? "";
              return (
                <div key={label} className="grid gap-2 py-2.5 sm:grid-cols-[1fr_180px] sm:items-center">
                  <Label htmlFor={`c${idx}`} className="font-normal">
                    {label}
                  </Label>
                  <select
                    id={`c${idx}`}
                    value={value}
                    onChange={(e) =>
                      setStatuses((prev) => {
                        const next = [...prev];
                        next[idx] = e.target.value;
                        return next;
                      })
                    }
                    className={`h-10 rounded-md border bg-card px-2 text-sm ${statusClass(value)}`}
                  >
                    <option value="">Sin verificar</option>
                    <option value="OK">En orden / en línea</option>
                    <option value="FALLA">Falla / pendiente</option>
                    <option value="NA">No aplica</option>
                  </select>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Observaciones, fallas y pendientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="observaciones">Detalle de cualquier novedad y acciones pendientes</Label>
          <Textarea
            id="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Indique equipo, ubicación, incidencia, responsable y seguimiento..."
            className="min-h-[110px]"
          />
          <p className="text-sm text-slate-500">
            El operador entrante confirma el estado de los sistemas y recibe las novedades documentadas. El registro es
            una constancia operativa, no una firma digital.
          </p>
          <p className="text-sm font-semibold text-amber-700">
            Verificaciones: {verified} de {ITEMS.length} · Fallas: {fallas}
          </p>
          {notice ? (
            <p className="text-sm text-amber-700" role="status">
              {notice}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button
              disabled={!canEdit || save.isPending}
              onClick={() => {
                const payload = { fecha, hora, saliente, entrante, observaciones, checks: draftChecks };
                const err = validateEntrega(payload);
                if (err) {
                  setNotice(err);
                  toast.error(err);
                  return;
                }
                save.mutate(payload);
              }}
            >
              Guardar entrega
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (recordId) {
                  openPdf({ id: recordId, fecha, hora, saliente, entrante });
                  return;
                }
                window.print();
              }}
            >
              <Printer className="h-4 w-4" />
              {recordId ? "Ver PDF" : "Imprimir / guardar PDF"}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Nuevo formulario
            </Button>
          </div>
          {!canEdit ? (
            <p className="text-sm text-slate-500 print:hidden">Su perfil puede consultar el historial, no registrar entregas.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Historial de entregas</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={displayed.length === 0} onClick={exportExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
              {canEdit ? (
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Importar respaldo JSON
                </Button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onImportFile(file);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <p className="px-4 pb-3 text-sm text-slate-500">
            Los registros quedan en Alfa One y se ven desde cualquier equipo del centro de monitoreo. Si tenía el
            formulario suelto, puede traer el JSON de respaldo.
          </p>
          {isLoading ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-400">Todavía no hay entregas guardadas.</p>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <table data-table-id="monitoreo-entrega-puesto" className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <TableColumnFilterHead
                    tableId="monitoreo-entrega-puesto"
                    defaultColumnWidths={{ fecha: 160, entrega: 180, recibe: 180, resultado: 180, acciones: 250 }}
                    columns={columnDefs}
                    rows={rows}
                    filters={columnFilters}
                    onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                  />
                </thead>
                <tbody>
                  {displayed.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50/60">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.fecha} {r.hora}
                      </td>
                      <td className="px-3 py-2">{r.saliente}</td>
                      <td className="px-3 py-2">{r.entrante}</td>
                      <td className="px-3 py-2">{r.resultado}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openPdf(r)}>
                          <FileText className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => loadRow(r)}>
                          Ver
                        </Button>
                        {canEdit ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-700"
                            onClick={() => {
                              if (window.confirm("¿Eliminar esta entrega del historial? Esta acción no se puede deshacer.")) {
                                remove.mutate(r.id);
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {viewing ? <span className="sr-only">Consulta de registro histórico</span> : null}

      <Dialog open={pdfPreview != null} onOpenChange={(open) => { if (!open) setPdfPreview(null); }}>
        <DialogContent className="flex h-[88vh] w-[95vw] max-w-4xl flex-col gap-3 p-4">
          <DialogHeader className="pr-8">
            <DialogTitle>Entrega de puesto</DialogTitle>
            <DialogDescription>{pdfPreview?.title}</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-slate-100">
            {pdfLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando PDF…
              </div>
            ) : pdfError ? (
              <div className="flex h-full items-center justify-center p-6 text-sm text-red-600">{pdfError}</div>
            ) : pdfBlobUrl ? (
              <object data={pdfBlobUrl} type="application/pdf" title="PDF de entrega de puesto" className="h-full w-full bg-white">
                <iframe title="PDF de entrega de puesto" src={pdfBlobUrl} className="h-full w-full bg-white" />
              </object>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
