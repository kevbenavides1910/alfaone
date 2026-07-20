"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import {
  ArrowLeft, AlertTriangle, FileText, FileSpreadsheet, Pencil, ClipboardCheck, CheckCircle2, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatDate, formatCurrency } from "@/lib/utils/format";
import { canManageDisciplinarySession } from "@/modules/core/permissions";
import {
  describeTreatmentState,
  formatCycleClosureLabel,
} from "@/modules/disciplinario/business/cycle-display";
import { ApercibimientoStatusDialog } from "@/components/disciplinary/StatusDialog";
import { TreatmentDialog } from "@/components/disciplinary/TreatmentDialog";
import { CloseCycleDialog } from "@/components/disciplinary/CloseCycleDialog";
import { ContractClientDialog } from "@/components/disciplinary/ContractClientDialog";
import { toast } from "@/components/ui/toaster";

const ESTADO_LABEL: Record<string, string> = {
  EMITIDO: "Emitido",
  ENTREGADO: "Entregado",
  FIRMADO: "Firmado",
  ANULADO: "Anulado",
};
const ESTADO_COLOR: Record<string, string> = {
  EMITIDO: "bg-blue-100 text-red-600",
  ENTREGADO: "bg-amber-100 text-amber-800",
  FIRMADO: "bg-emerald-100 text-emerald-800",
  ANULADO: "bg-rose-100 text-rose-700",
};
const VIGENCIA_LABEL: Record<string, string> = {
  VIGENTE: "Vigente",
  VENCIDO: "Vencido",
  PRESCRITO: "Prescrito",
  FINALIZADO: "Finalizado",
  ANULADO: "Anulado",
};
const VIGENCIA_COLOR: Record<string, string> = {
  VIGENTE: "bg-blue-100 text-red-600",
  VENCIDO: "bg-amber-100 text-amber-800",
  PRESCRITO: "bg-slate-200 text-slate-700",
  FINALIZADO: "bg-emerald-100 text-emerald-800",
  ANULADO: "bg-rose-100 text-rose-700",
};
const ACCION_CICLO_LABEL: Record<string, string> = {
  COBRADO: "Cobrado",
  DADO_DE_BAJA: "Dado de baja",
  OTRO: "Otro",
};

interface ApercibimientoFull {
  id: string;
  numero: string;
  fechaEmision: string;
  codigoEmpleado: string;
  nombreEmpleado: string;
  zona: string | null;
  sucursal: string | null;
  cantidadOmisiones: number;
  administrador: string | null;
  estado: keyof typeof ESTADO_LABEL;
  vigencia: keyof typeof VIGENCIA_LABEL;
  plantilla: string | null;
  planoOrigen: string | null;
  motivoAnulacion: string | null;
  contrato: string | null;
  cliente: string | null;
  clienteSetManual: boolean;
  omisiones?: { id: string; fecha: string; hora: string | null }[];
  pdfDisponible: boolean;
  evidenciaDisponible: boolean;
}
interface ClosedCycle {
  id: string;
  cerradoEl: string | null;
  accion: string;
  accionRaw: string | null;
  monto: string | number | null;
  count: number | null;
  omissions: number | null;
  lastDate: string | null;
  fechaConvocatoria: string | null;
  nombre: string | null;
  zona: string | null;
}
interface DetailResponse {
  data: {
    codigoEmpleado: string;
    nombreEmpleado: string | null;
    zona: string | null;
    ubicacion: string | null;
    sucursal: string | null;
    apercibimientos: ApercibimientoFull[];
    treatment: {
      fechaConvocatoria: string | null;
      horaConvocatoria: string | null;
      accion: string | null;
      cobradoDate: string | null;
      convocatoriaEnviadaAt: string | null;
      updatedAt: string;
    } | null;
    closedCycles: ClosedCycle[];
    resumen: {
      totalApercibimientos: number;
      totalNoAnulados: number;
      fechaTercerApercibimiento: string | null;
      administradorTercerApercibimiento: string | null;
    };
  };
}

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = use(params);
  const codigoDecoded = decodeURIComponent(codigo);
  const { data: session } = useSession();
  const canManage = canManageDisciplinarySession(session ?? null);

  const [statusTarget, setStatusTarget] = useState<{
    id: string;
    numero: string;
    estado: string;
    motivoAnulacion: string | null;
  } | null>(null);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [closeCycleOpen, setCloseCycleOpen] = useState(false);
  const [contractTarget, setContractTarget] = useState<{
    id: string;
    numero: string;
    contrato: string | null;
    cliente: string | null;
    clienteSetManual: boolean;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<DetailResponse>({
    queryKey: ["disciplinary-detail", codigoDecoded],
    queryFn: () =>
      fetch(`/api/disciplinary/empleados/${encodeURIComponent(codigoDecoded)}`).then((r) => r.json()),
  });

  const reopenMutation = useMutation({
    mutationFn: async (cycleId?: string) => {
      const res = await fetch(
        `/api/disciplinary/empleados/${encodeURIComponent(codigoDecoded)}/treatment/reopen-cycle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cycleId ? { cycleId } : {}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al reabrir el ciclo");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Ciclo reabierto");
      queryClient.invalidateQueries({ queryKey: ["disciplinary-detail", codigoDecoded] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleReopenCycle(cycleId: string) {
    if (!window.confirm("¿Reabrir este ciclo? Se restaurará el tratamiento y el ciclo se eliminará del historial.")) return;
    reopenMutation.mutate(cycleId);
  }

  function handleExport() {
    if (!data?.data) return;
    const rows = data.data.apercibimientos.map((a) => ({
      "N° Apercibimiento": a.numero,
      "Fecha Emisión": formatDate(a.fechaEmision),
      Zona: a.zona ?? "",
      Sucursal: a.sucursal ?? "",
      Omisiones: a.cantidadOmisiones,
      Administrador: a.administrador ?? "",
      Estado: ESTADO_LABEL[a.estado] ?? a.estado,
      Vigencia: VIGENCIA_LABEL[a.vigencia] ?? a.vigencia,
      Contrato: a.contrato ?? "",
      Cliente: a.cliente ?? "",
      Plantilla: a.plantilla ?? "",
      "Motivo Anulación": a.motivoAnulacion ?? "",
    }));
    exportRowsToExcel({
      filename: `apercibimientos_${codigoDecoded}`,
      sheetName: "Historial",
      rows,
      columnWidths: [22, 14, 18, 18, 12, 22, 14, 14, 22, 28, 14, 30],
    });
  }

  return (
    <>
      <div className="p-4 sm:p-6 space-y-4">
        <Link href="/disciplinario" className="inline-flex items-center text-sm text-slate-600 hover:text-red-600 gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver al listado
        </Link>

        {isLoading && <div className="text-slate-400">Cargando…</div>}
        {error && <div className="text-rose-600">No se pudo cargar el empleado.</div>}

        {data?.data && (() => {
          const ultimoCierre = data.data.closedCycles[0] ?? null;
          const ultimoCierreMonto =
            ultimoCierre?.monto != null && ultimoCierre.monto !== undefined
              ? typeof ultimoCierre.monto === "string"
                ? parseFloat(ultimoCierre.monto)
                : ultimoCierre.monto
              : null;
          const totalMontoCobrado = data.data.closedCycles.reduce((sum, c) => {
            if (c.accion !== "COBRADO" || c.monto == null) return sum;
            const n = typeof c.monto === "string" ? parseFloat(c.monto) : c.monto;
            return Number.isNaN(n) ? sum : sum + n;
          }, 0);
          return (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-slate-500">Empleado</div>
                <h1 className="text-2xl font-semibold text-slate-800">
                  {data.data.nombreEmpleado ?? "(sin nombre)"}
                </h1>
                <div className="text-sm text-slate-600">
                  Código: <span className="font-mono">{data.data.codigoEmpleado}</span>
                  {data.data.ubicacion && <span> · Ubicación: {data.data.ubicacion}</span>}
                  {data.data.sucursal && <span> · Sucursal: {data.data.sucursal}</span>}
                  {!data.data.ubicacion && data.data.zona && (
                    <span> · Zona: {data.data.zona}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setTreatmentOpen(true)}
                    >
                      <ClipboardCheck className="h-4 w-4" /> Tratamiento
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => setCloseCycleOpen(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Cerrar ciclo
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={data.data.apercibimientos.length === 0}
                  onClick={handleExport}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Exportar
                </Button>
              </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-slate-500">Total apercibimientos</div>
                  <div className="text-2xl font-semibold">{data.data.resumen.totalApercibimientos}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-slate-500">Vigentes (no anulados)</div>
                  <div className="text-2xl font-semibold">{data.data.resumen.totalNoAnulados}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-slate-500">3.er apercibimiento</div>
                  <div className="text-base font-semibold">
                    {data.data.resumen.fechaTercerApercibimiento
                      ? formatDate(data.data.resumen.fechaTercerApercibimiento)
                      : "—"}
                  </div>
                  {data.data.resumen.administradorTercerApercibimiento && (
                    <div className="text-xs text-slate-500">
                      Adm.: {data.data.resumen.administradorTercerApercibimiento}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-slate-500">Tratamiento</div>
                  {data.data.treatment || ultimoCierre ? (
                    <>
                      <div className="text-sm font-medium">
                        {describeTreatmentState(data.data.treatment, ultimoCierre).label}
                      </div>
                      {data.data.treatment && (
                        <>
                          <div className="text-xs text-slate-500">
                            Acción: {data.data.treatment.accion ?? "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Conv.:{" "}
                            {data.data.treatment.fechaConvocatoria
                              ? formatDate(data.data.treatment.fechaConvocatoria)
                              : "—"}
                            {data.data.treatment.horaConvocatoria
                              ? ` · ${data.data.treatment.horaConvocatoria}`
                              : ""}
                          </div>
                          <div className="text-xs text-slate-500">
                            Ubic.: {data.data.ubicacion ?? "—"} · Suc.: {data.data.sucursal ?? "—"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Cobrado: {data.data.treatment.cobradoDate ? formatDate(data.data.treatment.cobradoDate) : "—"}
                          </div>
                        </>
                      )}
                      {ultimoCierre && (
                        <div className="text-xs text-slate-600 mt-1 pt-1 border-t border-slate-200">
                          <span className="text-slate-500">Último cierre: </span>
                          {formatCycleClosureLabel(ultimoCierre.accion, ultimoCierre.accionRaw)}
                          {ultimoCierreMonto != null && !Number.isNaN(ultimoCierreMonto) && (
                            <span> · {formatCurrency(ultimoCierreMonto)}</span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-400">Sin tratamiento registrado</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-xs text-slate-500">Total cobrado (histórico)</div>
                  <div className="text-2xl font-semibold text-emerald-700">
                    {totalMontoCobrado > 0 ? formatCurrency(totalMontoCobrado) : "—"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {data.data.closedCycles.filter((c) => c.accion === "COBRADO").length}{" "}
                    {data.data.closedCycles.filter((c) => c.accion === "COBRADO").length === 1
                      ? "cobro registrado"
                      : "cobros registrados"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Historial de apercibimientos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial de apercibimientos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">N°</th>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Zona / Sucursal</th>
                      <th className="px-3 py-2 text-center">Omisiones</th>
                      <th className="px-3 py-2 text-left">Administrador</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-left">Vigencia</th>
                      <th className="px-3 py-2 text-left">Contrato / Cliente</th>
                      <th className="px-3 py-2 text-left">Adjuntos / Notas</th>
                      {canManage && <th className="px-3 py-2 text-right" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.data.apercibimientos.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-mono text-xs">{a.numero}</td>
                        <td className="px-3 py-2">{formatDate(a.fechaEmision)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {[a.zona, a.sucursal].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">{a.cantidadOmisiones}</td>
                        <td className="px-3 py-2 text-xs">{a.administrador ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge className={`${ESTADO_COLOR[a.estado] ?? ""} text-xs`}>
                            {ESTADO_LABEL[a.estado] ?? a.estado}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`${VIGENCIA_COLOR[a.vigencia] ?? ""} text-xs`}>
                            {VIGENCIA_LABEL[a.vigencia] ?? a.vigencia}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-700">
                          <div className="font-mono">{a.contrato || <span className="text-slate-400">—</span>}</div>
                          <div className="text-slate-600">
                            {a.cliente ? (
                              <span title={a.clienteSetManual ? "Cliente editado manualmente" : undefined}>
                                {a.cliente}
                                {a.clienteSetManual && <span className="ml-1 text-amber-600">●</span>}
                              </span>
                            ) : (
                              <span className="text-slate-400">sin cliente</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          <div className="flex flex-col">
                            {a.pdfDisponible && (
                              <span className="inline-flex items-center gap-1">
                                <FileText className="h-3 w-3" /> PDF en archivo interno
                              </span>
                            )}
                            {a.evidenciaDisponible && (
                              <span className="inline-flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Evidencia interna
                              </span>
                            )}
                            {a.omisiones && a.omisiones.length > 0 && (
                              <span className="text-[11px] text-slate-600 mt-1">
                                <span className="font-medium">Omisiones ({a.omisiones.length}):</span>{" "}
                                {a.omisiones
                                  .map((o) =>
                                    o.hora
                                      ? `${formatDate(o.fecha)} ${o.hora}`
                                      : formatDate(o.fecha),
                                  )
                                  .join(", ")}
                              </span>
                            )}
                            {!a.pdfDisponible &&
                              !a.evidenciaDisponible &&
                              (!a.omisiones || a.omisiones.length === 0) &&
                              "—"}
                          </div>
                          {a.motivoAnulacion && (
                            <div className="text-xs text-rose-600 mt-1">
                              Motivo anulación: {a.motivoAnulacion}
                            </div>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-slate-600 hover:text-red-600"
                                onClick={() =>
                                  setContractTarget({
                                    id: a.id,
                                    numero: a.numero,
                                    contrato: a.contrato,
                                    cliente: a.cliente,
                                    clienteSetManual: a.clienteSetManual,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" /> Contrato
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-red-600 hover:text-red-600"
                                onClick={() =>
                                  setStatusTarget({
                                    id: a.id,
                                    numero: a.numero,
                                    estado: a.estado,
                                    motivoAnulacion: a.motivoAnulacion,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" /> Estado
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>

            {/* Ciclos cerrados */}
            {data.data.closedCycles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ciclos cerrados</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Cerrado el</th>
                        <th className="px-3 py-2 text-left">Acción</th>
                        <th className="px-3 py-2 text-right">Monto</th>
                        <th className="px-3 py-2 text-center">Cantidad</th>
                        <th className="px-3 py-2 text-center">Omisiones</th>
                        <th className="px-3 py-2 text-left">Última fecha</th>
                        <th className="px-3 py-2 text-left">Convocatoria</th>
                        <th className="px-3 py-2 text-left">Zona</th>
                        {canManage && <th className="px-3 py-2 text-right" />}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.data.closedCycles.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/50">
                          <td className="px-3 py-2">{c.cerradoEl ? formatDate(c.cerradoEl) : "—"}</td>
                          <td className="px-3 py-2">
                            {ACCION_CICLO_LABEL[c.accion] ?? c.accionRaw ?? c.accion}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {c.monto !== null && c.monto !== undefined
                              ? formatCurrency(typeof c.monto === "string" ? parseFloat(c.monto) : c.monto)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-center">{c.count ?? "—"}</td>
                          <td className="px-3 py-2 text-center">{c.omissions ?? "—"}</td>
                          <td className="px-3 py-2">{c.lastDate ? formatDate(c.lastDate) : "—"}</td>
                          <td className="px-3 py-2">
                            {c.fechaConvocatoria ? formatDate(c.fechaConvocatoria) : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{c.zona ?? "—"}</td>
                          {canManage && (
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-amber-700"
                                disabled={reopenMutation.isPending}
                                onClick={() => handleReopenCycle(c.id)}
                                title="Reabrir este ciclo"
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
          );
        })()}
      </div>

      {canManage && (
        <>
          <ApercibimientoStatusDialog
            open={statusTarget !== null}
            onOpenChange={(o) => { if (!o) setStatusTarget(null); }}
            apercibimiento={statusTarget}
          />
          <TreatmentDialog
            open={treatmentOpen}
            onOpenChange={setTreatmentOpen}
            codigo={codigoDecoded}
            initial={data?.data.treatment ?? null}
            ultimoCierre={
              data?.data.closedCycles[0]
                ? {
                    cerradoEl: data.data.closedCycles[0].cerradoEl,
                    accion: data.data.closedCycles[0].accion,
                    accionRaw: data.data.closedCycles[0].accionRaw,
                    monto: (() => {
                      const m = data.data.closedCycles[0].monto;
                      if (m == null) return null;
                      const n = typeof m === "string" ? parseFloat(m) : m;
                      return Number.isNaN(n) ? null : n;
                    })(),
                  }
                : null
            }
            totalMontoCobrado={
              data?.data.closedCycles.reduce((sum, c) => {
                if (c.accion !== "COBRADO" || c.monto == null) return sum;
                const n = typeof c.monto === "string" ? parseFloat(c.monto) : c.monto;
                return Number.isNaN(n) ? sum : sum + n;
              }, 0)
            }
            employee={
              data?.data
                ? {
                    nombreEmpleado: data.data.nombreEmpleado,
                    ubicacion: data.data.ubicacion ?? data.data.zona,
                    sucursal: data.data.sucursal,
                  }
                : null
            }
          />
          <CloseCycleDialog
            open={closeCycleOpen}
            onOpenChange={setCloseCycleOpen}
            codigo={codigoDecoded}
          />
          <ContractClientDialog
            open={contractTarget !== null}
            onOpenChange={(o) => { if (!o) setContractTarget(null); }}
            apercibimiento={contractTarget}
          />
        </>
      )}
    </>
  );
}
