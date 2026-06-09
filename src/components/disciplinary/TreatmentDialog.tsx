"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { calendarDateInputValue, formatCurrency, formatDate } from "@/lib/utils/format";
import { formatCycleClosureLabel } from "@/modules/disciplinario/business/cycle-display";

/**
 * Acciones canónicas para el tratamiento del empleado:
 *  - PENDIENTE: convocatoria definida, aún sin resolver. Solo guarda el tratamiento.
 *  - COBRADO: resuelve con cobro y monto. Guarda tratamiento + cierra el ciclo automáticamente.
 *  - BAJA: resuelve con dado de baja. Guarda tratamiento + cierra el ciclo automáticamente.
 *  - OTRO: texto libre. Solo guarda el tratamiento.
 */
type AccionKey = "PENDIENTE" | "COBRADO" | "BAJA" | "OTRO";

const ACCION_OPTIONS: { value: AccionKey; label: string; treatmentLabel: string }[] = [
  { value: "PENDIENTE", label: "Pendiente", treatmentLabel: "Pendiente" },
  { value: "COBRADO", label: "Cobrado", treatmentLabel: "Cobrado" },
  { value: "BAJA", label: "Dado de baja", treatmentLabel: "Dado de baja" },
  { value: "OTRO", label: "Otro", treatmentLabel: "" },
];

interface TreatmentInitial {
  fechaConvocatoria: string | null;
  horaConvocatoria?: string | null;
  accion: string | null;
  cobradoDate: string | null;
  convocatoriaEnviadaAt?: string | null;
}

export interface TreatmentEmployeeContext {
  nombreEmpleado?: string | null;
  ubicacion?: string | null;
  sucursal?: string | null;
}

export interface TreatmentUltimoCierre {
  cerradoEl: string | null;
  accion: string;
  accionRaw: string | null;
  monto: number | null;
}

export interface TreatmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  codigo: string;
  initial: TreatmentInitial | null;
  ultimoCierre?: TreatmentUltimoCierre | null;
  employee?: TreatmentEmployeeContext | null;
}

function toTimeInputValue(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function inferAccionKey(raw: string | null | undefined, hasCobrado: boolean): AccionKey {
  if (hasCobrado) return "COBRADO";
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "PENDIENTE";
  if (t.includes("cobr")) return "COBRADO";
  if (t.includes("baja")) return "BAJA";
  if (t.includes("pendi")) return "PENDIENTE";
  return "OTRO";
}

function formatSentAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" });
}

export function TreatmentDialog({
  open,
  onOpenChange,
  codigo,
  initial,
  ultimoCierre,
  employee,
}: TreatmentDialogProps) {
  const [fechaConvocatoria, setFechaConvocatoria] = useState("");
  const [horaConvocatoria, setHoraConvocatoria] = useState("");
  const [accionKey, setAccionKey] = useState<AccionKey>("PENDIENTE");
  const [accionLibre, setAccionLibre] = useState("");
  const [cobradoDate, setCobradoDate] = useState("");
  const [monto, setMonto] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setFechaConvocatoria(calendarDateInputValue(initial?.fechaConvocatoria ?? null));
    setHoraConvocatoria(toTimeInputValue(initial?.horaConvocatoria ?? null));
    setCobradoDate(calendarDateInputValue(initial?.cobradoDate ?? null));
    const inferred = inferAccionKey(initial?.accion, !!initial?.cobradoDate);
    setAccionKey(inferred);
    setAccionLibre(inferred === "OTRO" ? (initial?.accion ?? "") : "");
    setMonto("");
  }, [open, initial]);

  const isCobrado = accionKey === "COBRADO";
  const isBaja = accionKey === "BAJA";
  const closesCycle = isCobrado || isBaja;
  const accionTexto =
    accionKey === "OTRO"
      ? accionLibre.trim()
      : ACCION_OPTIONS.find((o) => o.value === accionKey)?.treatmentLabel ?? "";

  const montoNumber = monto.trim() ? Number(monto.replace(",", ".")) : null;
  const montoInvalid =
    isCobrado && (monto.trim() === "" || montoNumber === null || Number.isNaN(montoNumber));
  const accionLibreInvalid = accionKey === "OTRO" && !accionLibre.trim();
  const convocatoriaIncomplete = !fechaConvocatoria.trim() || !horaConvocatoria.trim();
  const ultimoEnvio = formatSentAt(initial?.convocatoriaEnviadaAt);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["disciplinary-detail", codigo] });
    queryClient.invalidateQueries({ queryKey: ["disciplinary-detail"] });
    queryClient.invalidateQueries({ queryKey: ["disciplinary-resumen"] });
    queryClient.invalidateQueries({ queryKey: ["disciplinary-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["disciplinary-list"] });
  };

  const saveTreatment = async () => {
    const treatmentBody = {
      fechaConvocatoria: fechaConvocatoria || null,
      horaConvocatoria: horaConvocatoria || null,
      accion: accionTexto || null,
      cobradoDate: isCobrado ? cobradoDate || todayIso() : null,
    };
    const t = await fetch(
      `/api/disciplinary/empleados/${encodeURIComponent(codigo)}/treatment`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(treatmentBody),
      },
    );
    const tJson = await t.json();
    if (!t.ok) throw new Error(tJson.error?.message ?? "Error al guardar tratamiento");
    return tJson.data;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await saveTreatment();
      if (closesCycle) {
        const closeBody = {
          accion: isCobrado ? "Cobrado" : "Dado de baja",
          monto: isCobrado ? montoNumber : null,
          cerradoEl: (isCobrado ? cobradoDate : "") || todayIso(),
          notas: null,
          resetTreatment: true,
        };
        const c = await fetch(
          `/api/disciplinary/empleados/${encodeURIComponent(codigo)}/treatment/close-cycle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(closeBody),
          },
        );
        const cJson = await c.json();
        if (!c.ok) throw new Error(cJson.error?.message ?? "Error al cerrar ciclo");
      }
    },
    onSuccess: () => {
      toast.success(closesCycle ? "Ciclo cerrado y contador reiniciado" : "Tratamiento actualizado");
      invalidateAll();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(
        `/api/disciplinary/empleados/${encodeURIComponent(codigo)}/treatment/send-convocatoria`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fechaConvocatoria,
            horaConvocatoria,
            accion: accionTexto || "Pendiente",
          }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar convocatoria");
      return j.data as { enviadoA: string; cc?: string | null };
    },
    onSuccess: (data) => {
      const cc = data.cc ? ` (CC: ${data.cc})` : "";
      toast.success(`Convocatoria enviada a ${data.enviadoA}${cc}`);
      invalidateAll();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = mutation.isPending || sendMutation.isPending;
  const canSave = !busy && !montoInvalid && !accionLibreInvalid;
  const canSend = !busy && !convocatoriaIncomplete && !closesCycle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tratamiento del empleado</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm space-y-1">
          <div>
            <span className="text-slate-500">Código: </span>
            <span className="font-mono font-medium">{codigo}</span>
          </div>
          {employee?.nombreEmpleado && (
            <div>
              <span className="text-slate-500">Empleado: </span>
              <span className="font-medium">{employee.nombreEmpleado}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div>
              <span className="text-slate-500">Ubicación: </span>
              <span className="text-slate-800">{employee?.ubicacion?.trim() || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500">Sucursal: </span>
              <span className="text-slate-800">{employee?.sucursal?.trim() || "—"}</span>
            </div>
          </div>
        </div>

        {ultimoCierre && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm space-y-1">
            <div className="text-xs font-medium uppercase text-emerald-800">
              Último cierre de ciclo
            </div>
            <div>
              <span className="text-slate-500">Acción: </span>
              <span className="font-medium text-slate-800">
                {formatCycleClosureLabel(ultimoCierre.accion, ultimoCierre.accionRaw)}
              </span>
            </div>
            {ultimoCierre.monto != null && (
              <div>
                <span className="text-slate-500">Monto cobrado: </span>
                <span className="font-medium text-slate-800">
                  {formatCurrency(ultimoCierre.monto)}
                </span>
              </div>
            )}
            {ultimoCierre.cerradoEl && (
              <div className="text-xs text-slate-600">
                Cerrado el {formatDate(ultimoCierre.cerradoEl)}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Fecha convocatoria</label>
              <Input
                type="date"
                value={fechaConvocatoria}
                onChange={(e) => setFechaConvocatoria(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Hora convocatoria</label>
              <Input
                type="time"
                value={horaConvocatoria}
                onChange={(e) => setHoraConvocatoria(e.target.value)}
              />
            </div>
          </div>

          {ultimoEnvio && (
            <p className="text-xs text-slate-500">
              Última convocatoria enviada por correo: <strong>{ultimoEnvio}</strong>
            </p>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">Acción *</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm"
              value={accionKey}
              onChange={(e) => setAccionKey(e.target.value as AccionKey)}
            >
              {ACCION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {accionKey === "OTRO" && (
              <Input
                className="mt-2"
                value={accionLibre}
                onChange={(e) => setAccionLibre(e.target.value)}
                placeholder="Describa la acción…"
              />
            )}
          </div>

          {isCobrado && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium block mb-1">Monto cobrado *</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                />
                {montoInvalid && (
                  <div className="text-xs text-rose-600 mt-1">Indique un monto numérico</div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Fecha de cobrado</label>
                <Input
                  type="date"
                  value={cobradoDate}
                  onChange={(e) => setCobradoDate(e.target.value)}
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  Si lo deja vacío se usa la fecha de hoy.
                </div>
              </div>
            </div>
          )}

          {closesCycle ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
              Al guardar con acción «{isCobrado ? "Cobrado" : "Dado de baja"}» se cerrará el ciclo
              automáticamente y el contador de apercibimientos vigentes del empleado quedará en
              cero. El próximo apercibimiento iniciará un ciclo nuevo.
            </div>
          ) : (
            <div className="text-xs text-slate-500 space-y-1">
              <p>
                Estos campos describen el ciclo <strong>vigente</strong>. Cuando el caso quede
                resuelto como Cobrado o Dado de baja, esa selección cerrará el ciclo aquí mismo.
              </p>
              <p>
                <strong>Enviar convocatoria</strong> guarda fecha y hora, genera un PDF y envía
                correo al empleado (maestro RRHH) con copia al administrador de zona y al CC fijo
                configurado en Disciplinario → Ajustes.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-2 justify-end">
            {!closesCycle && (
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={!canSend}
                onClick={() => sendMutation.mutate()}
                title={
                  convocatoriaIncomplete
                    ? "Indique fecha y hora de convocatoria"
                    : "Enviar correo con PDF adjunto"
                }
              >
                <Mail className="h-4 w-4" />
                {sendMutation.isPending ? "Enviando…" : "Enviar convocatoria"}
              </Button>
            )}
            <Button onClick={() => mutation.mutate()} disabled={!canSave}>
              {mutation.isPending
                ? "Guardando…"
                : closesCycle
                  ? "Guardar y cerrar ciclo"
                  : "Guardar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
