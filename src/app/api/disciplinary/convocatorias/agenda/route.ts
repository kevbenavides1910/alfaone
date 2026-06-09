import { NextRequest } from "next/server";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { prisma } from "@/modules/core/db/prisma";
import { parseHoraConvocatoria } from "@/modules/disciplinario/services/disciplinary-convocatoria-send";

function parseWeekStartParam(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Lunes 00:00 local del servidor (misma convención que filtros disciplinarios). */
function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function dateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function fechaConvocatoriaYmd(fecha: Date): string {
  return dateToYmd(fecha);
}

function normalizeSlotKey(hora: string | null): string {
  if (!hora) return "__sin_hora__";
  const norm = parseHoraConvocatoria(hora);
  if (!norm) return "__sin_hora__";
  const [h, m] = norm.split(":");
  return `${String(Number(h)).padStart(2, "0")}:${m}`;
}

const DEFAULT_SLOTS = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 17; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    if (h < 17) out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "disciplinario.convocatoria", "view")) return forbidden();

  const sp = req.nextUrl.searchParams;
  const weekParam = sp.get("week");
  const weekStart = weekParam ? parseWeekStartParam(weekParam) : mondayOfWeek(new Date());
  if (!weekStart) return badRequest("Parámetro week inválido (use YYYY-MM-DD, lunes de la semana)");

  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  const treatments = await prisma.disciplinaryTreatment.findMany({
    where: {
      fechaConvocatoria: { gte: weekStart, lte: weekEnd },
    },
    select: {
      codigoEmpleado: true,
      nombre: true,
      zona: true,
      fechaConvocatoria: true,
      horaConvocatoria: true,
      convocatoriaEnviadaAt: true,
      accion: true,
    },
    orderBy: [{ fechaConvocatoria: "asc" }, { horaConvocatoria: "asc" }, { nombre: "asc" }],
  });

  const events = treatments
    .filter((t) => t.fechaConvocatoria)
    .map((t) => ({
      codigoEmpleado: t.codigoEmpleado,
      nombre: (t.nombre?.trim() || t.codigoEmpleado) as string,
      zona: t.zona,
      fecha: fechaConvocatoriaYmd(t.fechaConvocatoria!),
      hora: normalizeSlotKey(t.horaConvocatoria),
      horaRaw: t.horaConvocatoria,
      convocatoriaEnviadaAt: t.convocatoriaEnviadaAt?.toISOString() ?? null,
      accion: t.accion,
    }));

  const slotSet = new Set<string>(DEFAULT_SLOTS);
  for (const e of events) {
    if (e.hora !== "__sin_hora__") slotSet.add(e.hora);
  }
  const slots = [...slotSet].filter((s) => s !== "__sin_hora__").sort();
  if (events.some((e) => e.hora === "__sin_hora__")) {
    slots.push("__sin_hora__");
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const ymd = format(d, "yyyy-MM-dd");
    return {
      date: ymd,
      label: format(d, "EEE d/M", { locale: es }),
      weekday: format(d, "EEEE", { locale: es }),
    };
  });

  return ok({
    weekStart: format(weekStart, "yyyy-MM-dd"),
    weekEnd: format(addDays(weekStart, 6), "yyyy-MM-dd"),
    days,
    slots,
    slotLabels: Object.fromEntries(
      slots.map((s) => [s, s === "__sin_hora__" ? "Sin hora" : s]),
    ),
    events,
    total: events.length,
  });
}
