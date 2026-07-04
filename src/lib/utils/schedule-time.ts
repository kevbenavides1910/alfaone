export function normalizeScheduleTime(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("INVALID_TIME");
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error("INVALID_TIME");
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function scheduleTimeToMinutes(hhmm: string): number {
  const [h, m] = normalizeScheduleTime(hhmm).split(":").map(Number);
  return h * 60 + m;
}

export function minutesToScheduleTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(wrapped / 60);
  const nm = wrapped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** Suma minutos a HH:mm (24h). Si cruza medianoche, continúa al día siguiente (p. ej. 23:55 + 15 → 00:10). */
export function addMinutesToScheduleTime(startTime: string, minutes: number): string {
  const start = normalizeScheduleTime(startTime);
  return minutesToScheduleTime(scheduleTimeToMinutes(start) + minutes);
}

export function computeEndTimeFromDuration(startTime: string, durationMinutes: number): string {
  if (durationMinutes <= 0) return normalizeScheduleTime(startTime);
  return addMinutesToScheduleTime(startTime, durationMinutes);
}

/** True cuando la hora de fin es anterior a la de inicio (ventana cruza medianoche). */
export function scheduleWindowCrossesMidnight(startTime: string, endTime: string): boolean {
  return scheduleTimeToMinutes(endTime) < scheduleTimeToMinutes(startTime);
}

/** Comprueba si una hora HH:mm cae dentro de la ventana [inicio, fin], inclusive. */
export function isTimeWithinScheduleWindow(
  time: string,
  startTime: string,
  endTime: string,
): boolean {
  const t = scheduleTimeToMinutes(time);
  const start = scheduleTimeToMinutes(startTime);
  const end = scheduleTimeToMinutes(endTime);

  if (start === end) return t === start;

  if (end > start) {
    return t >= start && t <= end;
  }

  return t >= start || t <= end;
}

/** Día usado como plantilla cuando sameScheduleEveryDay está activo (lunes). */
export const TEMPLATE_SCHEDULE_DAY = 1;

export type ScheduleSlotLike = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

export function collapseSlotsToTemplate(
  slots: ScheduleSlotLike[],
  templateDay = TEMPLATE_SCHEDULE_DAY,
): ScheduleSlotLike[] {
  const template = slots.filter((s) => s.dayOfWeek === templateDay);
  if (template.length > 0) {
    return template.map((s, i) => ({ ...s, sortOrder: i }));
  }
  const firstDay = slots[0]?.dayOfWeek;
  if (firstDay == null) return [];
  return slots
    .filter((s) => s.dayOfWeek === firstDay)
    .map((s, i) => ({ ...s, dayOfWeek: templateDay, sortOrder: i }));
}

export function expandScheduleTemplateToAllDays(
  templateSlots: ScheduleSlotLike[],
  templateDay = TEMPLATE_SCHEDULE_DAY,
): ScheduleSlotLike[] {
  const base = templateSlots.filter((s) => s.dayOfWeek === templateDay);
  const template =
    base.length > 0 ? base : templateSlots.map((s, i) => ({ ...s, dayOfWeek: templateDay, sortOrder: i }));

  const result: ScheduleSlotLike[] = [];
  for (let day = 0; day <= 6; day++) {
    template.forEach((s, i) => {
      result.push({
        startTime: s.startTime,
        endTime: s.endTime,
        dayOfWeek: day,
        sortOrder: i,
      });
    });
  }
  return result;
}
