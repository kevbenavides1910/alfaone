"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { calendarDateInputValue } from "@/lib/utils/format";

export type ConvocatoriaAgendaEvent = {
  codigoEmpleado: string;
  nombre: string;
  zona: string | null;
  fecha: string;
  horaRaw: string | null;
  convocatoriaEnviadaAt: string | null;
  accion: string | null;
};

function toTimeInputValue(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

function formatSentAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" });
}

export interface ConvocatoriaAgendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ConvocatoriaAgendaEvent | null;
}

export function ConvocatoriaAgendaDialog({ open, onOpenChange, event }: ConvocatoriaAgendaDialogProps) {
  const [fechaConvocatoria, setFechaConvocatoria] = useState("");
  const [horaConvocatoria, setHoraConvocatoria] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open || !event) return;
    setFechaConvocatoria(calendarDateInputValue(event.fecha) || event.fecha);
    setHoraConvocatoria(toTimeInputValue(event.horaRaw));
  }, [open, event]);

  const ultimoEnvio = formatSentAt(event?.convocatoriaEnviadaAt);
  const incomplete = !fechaConvocatoria.trim() || !horaConvocatoria.trim();
  const accion = event?.accion?.trim() || "Pendiente";

  const invalidateAgenda = () => {
    queryClient.invalidateQueries({ queryKey: ["disciplinary-convocatoria-agenda"] });
    queryClient.invalidateQueries({ queryKey: ["disciplinary-resumen"] });
    if (event?.codigoEmpleado) {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-detail", event.codigoEmpleado] });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const codigo = event!.codigoEmpleado;
      const r = await fetch(
        `/api/disciplinary/convocatorias/${encodeURIComponent(codigo)}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fechaConvocatoria, horaConvocatoria }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Fecha y hora actualizadas en el cronograma");
      invalidateAgenda();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const codigo = event!.codigoEmpleado;
      const r = await fetch(
        `/api/disciplinary/empleados/${encodeURIComponent(codigo)}/treatment/send-convocatoria`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fechaConvocatoria,
            horaConvocatoria,
            accion,
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
      invalidateAgenda();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = saveMutation.isPending || sendMutation.isPending;

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convocatoria en cronograma</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm space-y-1">
          <div className="font-medium text-slate-900">{event.nombre}</div>
          <div className="text-xs text-slate-600 font-mono">{event.codigoEmpleado}</div>
          {event.zona && <div className="text-xs text-slate-500">{event.zona}</div>}
        </div>

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

        {ultimoEnvio ? (
          <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
            Correo enviado el <strong>{ultimoEnvio}</strong>. Puede cambiar fecha/hora y{" "}
            <strong>reenviar</strong> el PDF si hubo un error o no se había enviado antes.
          </p>
        ) : (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            Aún no se ha enviado el correo con el PDF F-RH-42. Ajuste fecha y hora y use{" "}
            <strong>Enviar convocatoria</strong>.
          </p>
        )}

        <p className="text-xs text-slate-500">
          «Guardar» solo mueve la cita en el cronograma. «Enviar convocatoria» guarda fecha/hora,
          genera el PDF y envía correo al empleado (con copias configuradas en Ajustes).
        </p>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-2 justify-end items-center">
            <Button variant="link" size="sm" className="h-8 px-0 text-slate-600" asChild>
              <Link
                href={`/disciplinario/empleados/${encodeURIComponent(event.codigoEmpleado)}`}
                className="gap-1"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ficha completa
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || incomplete}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={busy || incomplete}
              onClick={() => sendMutation.mutate()}
              title={incomplete ? "Indique fecha y hora" : "Enviar correo con PDF adjunto"}
            >
              <Mail className="h-4 w-4" />
              {sendMutation.isPending
                ? "Enviando…"
                : ultimoEnvio
                  ? "Reenviar convocatoria"
                  : "Enviar convocatoria"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
