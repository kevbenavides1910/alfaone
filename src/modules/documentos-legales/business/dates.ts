import { parseCalendarDateInput } from "@/lib/utils/format";

export function toIsoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIsoDay(value: string): Date | null {
  return parseCalendarDateInput(value);
}

export function monthBounds(month: string): { from: Date; to: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return {
    from: new Date(Date.UTC(y, monthIndex, 1)),
    to: new Date(Date.UTC(y, monthIndex + 1, 1)),
  };
}

export function daysOfMonth(month: string): string[] {
  const bounds = monthBounds(month);
  if (!bounds) return [];
  const y = bounds.from.getUTCFullYear();
  const m = bounds.from.getUTCMonth();
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= count; d++) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** Día calendario en Costa Rica, a medianoche UTC (mismo criterio que @db.Date). */
export function todayCostaRica(): Date {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parseCalendarDateInput(iso) ?? new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  ));
}
