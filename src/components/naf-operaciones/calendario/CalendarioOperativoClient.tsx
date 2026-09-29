"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Paperclip, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { cn } from "@/lib/utils/cn";
import {
  CALENDARIO_EVENT_STATUSES,
  CALENDARIO_STATUS_BADGE,
  CALENDARIO_STATUS_LABELS,
  calendarioColorClass,
  toIsoDate,
  type CalendarioEventStatus,
  type CalendarioEventSummary,
} from "@/modules/naf-operaciones/business/calendario-types";
import {
  CALENDARIO_API,
  calendarioFetch,
  selectClass,
  type CalendarioOpciones,
} from "./calendario-api";
import { CalendarioEventoFormDialog } from "./CalendarioEventoFormDialog";
import { CalendarioEventoDetalleDialog } from "./CalendarioEventoDetalleDialog";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MAX_CHIPS = 3;

/** Celdas del mes (semanas completas, lunes a domingo) en UTC. */
function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - offset));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const cells = offset + last.getUTCDate();
  const total = Math.ceil(cells / 7) * 7;
  return Array.from({ length: total }, (_, i) => new Date(start.getTime() + i * 86_400_000));
}

function todayIso(): string {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function CalendarioOperativoClient() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "nafOperaciones.calendario", "edit");

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [zoneId, setZoneId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [adminIds, setAdminIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CalendarioEventStatus | "">("");
  const [formState, setFormState] = useState<{ open: boolean; date?: string; eventId?: string }>({
    open: false,
  });
  const [detailId, setDetailId] = useState<string | null>(null);

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const from = toIsoDate(grid[0]);
  const to = toIsoDate(grid[grid.length - 1]);
  const today = todayIso();

  const opciones = useQuery({
    queryKey: ["calendario-operativo", "opciones", ""],
    queryFn: () => calendarioFetch<CalendarioOpciones>(`${CALENDARIO_API}/opciones`),
    staleTime: 5 * 60_000,
  });

  const eventsQuery = useQuery({
    queryKey: ["calendario-operativo", "eventos", from, to, zoneId, typeId, adminIds.join(","), status],
    queryFn: () => {
      const sp = new URLSearchParams({ from, to });
      if (zoneId) sp.set("zoneId", zoneId);
      if (typeId) sp.set("typeId", typeId);
      if (adminIds.length) sp.set("adminUserIds", adminIds.join(","));
      if (status) sp.set("status", status);
      return calendarioFetch<CalendarioEventSummary[]>(`${CALENDARIO_API}?${sp}`);
    },
  });

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarioEventSummary[]>();
    for (const ev of eventsQuery.data ?? []) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [eventsQuery.data]);

  const monthEvents = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
    return (eventsQuery.data ?? []).filter((e) => e.date.startsWith(prefix));
  }, [eventsQuery.data, cursor]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("es-CR", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Calendario operativo"
        icon={CalendarDays}
        description="Eventos por fecha (cambio de uniformes, entregas, inspecciones…) aplicados a uno, varios o todos los contratos, filtrables por zona operativa."
        actions={
          canEdit ? (
            <Button type="button" onClick={() => setFormState({ open: true, date: today })}>
              <Plus className="mr-1 h-4 w-4" /> Nuevo evento
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
        >
          Hoy
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="ml-2 text-lg font-semibold capitalize">{monthLabel}</h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className={selectClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
            <option value="">Todas las zonas</option>
            {(opciones.data?.zones ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select className={selectClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Todos los tipos</option>
            {(opciones.data?.types ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isActive ? "" : " (inactivo)"}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as CalendarioEventStatus | "")}
          >
            <option value="">Todos los estados</option>
            {CALENDARIO_EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CALENDARIO_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <MultiSelect
            className="w-60"
            searchable
            placeholder="Todos los administradores"
            searchPlaceholder="Buscar administrador…"
            clearLabel="Limpiar (todos los administradores)"
            options={(opciones.data?.admins ?? []).map((u) => ({ value: u.id, label: u.name }))}
            value={adminIds}
            onChange={setAdminIds}
            quickActions={
              session?.user?.id ? [{ id: "mine", label: "Mis eventos", values: [session.user.id] }] : undefined
            }
          />
        </div>
      </div>

      {eventsQuery.isError ? (
        <p className="text-sm text-red-600">{(eventsQuery.error as Error).message}</p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-7 border-b bg-gray-50 text-center text-xs font-medium uppercase text-gray-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const iso = toIsoDate(day);
            const inMonth = day.getUTCMonth() === cursor.month;
            const events = eventsByDay.get(iso) ?? [];
            return (
              <div
                key={iso}
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onClick={() => canEdit && setFormState({ open: true, date: iso })}
                onKeyDown={(e) => {
                  if (canEdit && (e.key === "Enter" || e.key === " ")) setFormState({ open: true, date: iso });
                }}
                className={cn(
                  "min-h-[110px] border-b border-r p-1.5 text-left align-top",
                  !inMonth && "bg-gray-50/70 text-gray-400",
                  canEdit && "cursor-pointer hover:bg-red-50/40",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    iso === today && "bg-red-600 text-white",
                  )}
                >
                  {day.getUTCDate()}
                </div>
                <div className="space-y-1">
                  {events.slice(0, MAX_CHIPS).map((ev) => (
                    <EventChip key={ev.id} ev={ev} onClick={() => setDetailId(ev.id)} />
                  ))}
                  {events.length > MAX_CHIPS ? (
                    <div className="px-1 text-[11px] text-gray-500">+{events.length - MAX_CHIPS} más</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white">
        <h3 className="border-b px-4 py-2 text-sm font-semibold">
          Agenda del mes {eventsQuery.isLoading ? "· cargando…" : `· ${monthEvents.length} eventos`}
        </h3>
        {monthEvents.length === 0 && !eventsQuery.isLoading ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Sin eventos en este mes.</p>
        ) : (
          <ul className="divide-y">
            {monthEvents.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => setDetailId(ev.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="w-24 font-mono text-xs text-gray-600">{ev.date}</span>
                  <span className={cn("rounded border px-2 py-0.5 text-xs", calendarioColorClass(ev.type.color))}>
                    {ev.type.name}
                  </span>
                  <span className="font-medium">{ev.title}</span>
                  <span className="text-xs text-gray-500">{ev.zone?.name ?? "Varias zonas"}</span>
                  {ev.admins.length ? (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <Users className="h-3.5 w-3.5" />
                      {ev.admins.map((a) => a.name).join(", ")}
                    </span>
                  ) : null}
                  <span className="ml-auto flex items-center gap-2 text-xs text-gray-600">
                    {ev.attachmentsCount ? (
                      <span className="inline-flex items-center gap-0.5" title="Evidencias">
                        <Paperclip className="h-3.5 w-3.5" />
                        {ev.attachmentsCount}
                      </span>
                    ) : null}
                    <span>
                      {ev.completedCount}/{ev.contractsCount} contratos
                    </span>
                    <span className={cn("rounded border px-2 py-0.5", CALENDARIO_STATUS_BADGE[ev.status])}>
                      {CALENDARIO_STATUS_LABELS[ev.status]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formState.open ? (
        <CalendarioEventoFormDialog
          open
          onOpenChange={(open) => !open && setFormState({ open: false })}
          initialDate={formState.date}
          eventId={formState.eventId}
          zones={opciones.data?.zones ?? []}
          types={opciones.data?.types ?? []}
          admins={opciones.data?.admins ?? []}
          defaultZoneId={zoneId}
          onSaved={(id) => {
            setFormState({ open: false });
            setDetailId(id);
          }}
        />
      ) : null}

      {detailId ? (
        <CalendarioEventoDetalleDialog
          eventId={detailId}
          canEdit={canEdit}
          onClose={() => setDetailId(null)}
          onEdit={(id) => {
            setDetailId(null);
            setFormState({ open: true, eventId: id });
          }}
        />
      ) : null}
    </ModulePage>
  );
}

function EventChip({ ev, onClick }: { ev: CalendarioEventSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      title={[
        ev.type.name,
        ev.title,
        CALENDARIO_STATUS_LABELS[ev.status],
        `${ev.completedCount}/${ev.contractsCount} contratos`,
        ev.admins.length ? `Adm.: ${ev.admins.map((a) => a.name).join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium",
        calendarioColorClass(ev.type.color),
        ev.status === "CANCELLED" && "line-through opacity-60",
        ev.status === "DONE" && "ring-1 ring-emerald-500",
      )}
    >
      {ev.status === "DONE" ? "✓ " : ""}
      {ev.title}
      <span className="ml-1 opacity-70">
        {ev.completedCount}/{ev.contractsCount}
      </span>
    </button>
  );
}
