"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Mail,
  MailX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";
import {
  ConvocatoriaAgendaDialog,
  type ConvocatoriaAgendaEvent,
} from "@/components/disciplinary/ConvocatoriaAgendaDialog";

type AgendaEvent = {
  codigoEmpleado: string;
  nombre: string;
  zona: string | null;
  fecha: string;
  hora: string;
  horaRaw: string | null;
  convocatoriaEnviadaAt: string | null;
  accion: string | null;
};

type AgendaResponse = {
  data: {
    weekStart: string;
    weekEnd: string;
    days: { date: string; label: string; weekday: string }[];
    slots: string[];
    slotLabels: Record<string, string>;
    events: AgendaEvent[];
    total: number;
  };
};

function mondayIso(d: Date): string {
  const m = startOfWeek(d, { weekStartsOn: 1 });
  return format(m, "yyyy-MM-dd");
}

export default function DisciplinarioConvocatoriaPage() {
  const [week, setWeek] = useState(() => mondayIso(new Date()));
  const [editEvent, setEditEvent] = useState<ConvocatoriaAgendaEvent | null>(null);
  const { data: session } = useSession();
  const canManage = session
    ? hasPermission(session, "disciplinario.empleados", "edit")
    : false;

  const { data, isLoading, isError, error } = useQuery<AgendaResponse>({
    queryKey: ["disciplinary-convocatoria-agenda", week],
    queryFn: async () => {
      const res = await fetch(`/api/disciplinary/convocatorias/agenda?week=${week}`);
      const json = (await res.json()) as AgendaResponse & { error?: { message?: string } };
      if (!res.ok) throw new Error(json.error?.message ?? `Error ${res.status}`);
      return json;
    },
  });

  const agenda = data?.data;
  const weekLabel = useMemo(() => {
    if (!agenda) return "";
    const start = parseISO(agenda.weekStart);
    const end = parseISO(agenda.weekEnd);
    return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
  }, [agenda]);

  const grid = useMemo(() => {
    if (!agenda) return null;
    const byCell = new Map<string, AgendaEvent[]>();
    for (const e of agenda.events) {
      const key = `${e.fecha}|${e.hora}`;
      const list = byCell.get(key) ?? [];
      list.push(e);
      byCell.set(key, list);
    }
    return byCell;
  }, [agenda]);

  function shiftWeek(delta: number) {
    const d = parseISO(week);
    setWeek(format(addDays(d, delta * 7), "yyyy-MM-dd"));
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Cronograma de convocatorias
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Agenda semanal: quién está convocado por día y horario (tratamiento disciplinario).
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/disciplinario/empleados">
            <Users className="h-4 w-4" />
            Tratamiento
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base capitalize">{weekLabel || "Semana"}</CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(-1)} aria-label="Semana anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWeek(mondayIso(new Date()))}
              >
                Hoy
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => shiftWeek(1)} aria-label="Semana siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {agenda && (
            <p className="text-sm text-slate-500 font-normal">
              {agenda.total} convocatoria(s) programada(s) esta semana
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {isLoading && (
            <p className="p-6 text-sm text-slate-500">Cargando agenda…</p>
          )}
          {isError && (
            <p className="p-6 text-sm text-rose-600">
              {error instanceof Error ? error.message : "No se pudo cargar la agenda"}
            </p>
          )}
          {agenda && grid && agenda.total === 0 && (
            <p className="p-6 text-sm text-slate-500">
              No hay convocatorias con fecha en esta semana. Defina fechas en{" "}
              <Link href="/disciplinario/empleados" className="text-blue-600 underline">
                Tratamiento
              </Link>
              .
            </p>
          )}
          {agenda && grid && agenda.total > 0 && (
            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-600 w-20">
                      Hora
                    </th>
                    {agenda.days.map((day) => (
                      <th
                        key={day.date}
                        className="border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-700 min-w-[110px]"
                      >
                        <div className="capitalize">{day.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agenda.slots.map((slot) => (
                    <tr key={slot} className="border-b border-slate-100 last:border-0">
                      <td className="sticky left-0 z-10 bg-white border-r border-slate-200 px-3 py-2 text-slate-500 font-mono text-xs align-top whitespace-nowrap">
                        {agenda.slotLabels[slot] ?? slot}
                      </td>
                      {agenda.days.map((day) => {
                        const items = grid.get(`${day.date}|${slot}`) ?? [];
                        const isToday =
                          day.date === format(new Date(), "yyyy-MM-dd");
                        return (
                          <td
                            key={day.date}
                            className={cn(
                              "align-top px-1.5 py-1.5 min-h-[52px] border-r border-slate-50 last:border-r-0",
                              isToday && "bg-blue-50/40",
                            )}
                          >
                            <ul className="space-y-1">
                              {items.map((ev) => {
                                const card = (
                                  <>
                                    <div className="font-medium text-slate-900 text-xs leading-tight line-clamp-2">
                                      {ev.nombre}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {ev.codigoEmpleado}
                                    </div>
                                    {ev.zona && (
                                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                        {ev.zona}
                                      </div>
                                    )}
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {ev.convocatoriaEnviadaAt ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1 py-0 h-4 gap-0.5 border-emerald-200 text-emerald-700 bg-emerald-50"
                                        >
                                          <Mail className="h-2.5 w-2.5" />
                                          Enviada
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] px-1 py-0 h-4 gap-0.5 border-amber-200 text-amber-800 bg-amber-50"
                                        >
                                          <MailX className="h-2.5 w-2.5" />
                                          Pendiente
                                        </Badge>
                                      )}
                                    </div>
                                  </>
                                );
                                return (
                                  <li key={`${ev.codigoEmpleado}-${ev.fecha}-${ev.horaRaw}`}>
                                    {canManage ? (
                                      <button
                                        type="button"
                                        onClick={() => setEditEvent(ev)}
                                        className="w-full text-left rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm hover:border-blue-300 hover:bg-blue-50/80 transition-colors cursor-pointer"
                                      >
                                        {card}
                                      </button>
                                    ) : (
                                      <Link
                                        href={`/disciplinario/empleados/${ev.codigoEmpleado}`}
                                        className="block rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm hover:border-blue-300 hover:bg-blue-50/80 transition-colors"
                                      >
                                        {card}
                                      </Link>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500 max-w-3xl">
        {canManage ? (
          <>
            Haga clic en una convocatoria para cambiar fecha y hora, guardar en el cronograma o
            enviar (o reenviar) el correo con el PDF F-RH-42. También puede usar{" "}
            <Link href="/disciplinario/empleados" className="text-blue-600 underline">
              Tratamiento
            </Link>{" "}
            para el ciclo completo del empleado.
          </>
        ) : (
          <>
            Los datos provienen del tratamiento disciplinario. Para editar, use{" "}
            <Link href="/disciplinario/empleados" className="text-blue-600 underline">
              resumen por empleado
            </Link>
            .
          </>
        )}
      </p>

      <ConvocatoriaAgendaDialog
        open={!!editEvent}
        onOpenChange={(o) => !o && setEditEvent(null)}
        event={editEvent}
      />
    </div>
  );
}
