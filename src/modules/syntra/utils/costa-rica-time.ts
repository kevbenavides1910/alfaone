const CR_TZ = "America/Costa_Rica";

export { CR_TZ };

/** Fecha local Costa Rica como Date UTC midnight (para columnas @db.Date). */
export function todayInCostaRica(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

/** dd/MM/yyyy del dia actual en Costa Rica (sin desfase por UTC). */
export function legacyDateTodayCostaRica(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${d}/${m}/${y}`;
}

/** dd/MM/yyyy en zona Costa Rica. */
export function formatLegacyDate(date: Date): string {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: CR_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** dd/MM/yyyy HH:mm:ss en zona Costa Rica. */
export function formatLegacyDateTime(date: Date): string {
  const datePart = formatLegacyDate(date);
  const timePart = new Intl.DateTimeFormat("es-CR", {
    timeZone: CR_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} ${timePart}`;
}

export function normalizePatrolImei(imei: string): string {
  const digits = imei.replace(/\D/g, "");
  let trimmed = digits.replace(/^0+/, "") || "0";
  // Algunos Android envían 16 dígitos con un '1' extra al inicio.
  if (trimmed.length === 16 && trimmed.startsWith("1")) {
    trimmed = trimmed.slice(1);
  }
  return trimmed;
}

export function patrolImeisMatch(a: string, b: string): boolean {
  return normalizePatrolImei(a) === normalizePatrolImei(b);
}

/** Parse timestamp enviado por la app Android (yyyy/MM/dd HH:mm en Costa Rica). */
export function parsePatrolMarkTimestamp(raw: string | undefined): Date {
  if (!raw?.trim()) return new Date();
  const s = raw.trim().replace("T", " ");
  const m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}-06:00`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function patrolMarkWallTimeInCr(markedAt: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CR_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(markedAt);
}

export function patrolMarkDateIsoInCr(markedAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(markedAt);
}

/** Hora HH:mm cuando markedAt guardó reloj CR en campos UTC (legado). */
export function patrolMarkLegacyWallTime(markedAt: Date): string {
  const h = String(markedAt.getUTCHours()).padStart(2, "0");
  const min = String(markedAt.getUTCMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

/** Hora para comparar contra ventana programada (compatible legado + UTC correcto). */
export function patrolMarkWallTimeForSchedule(markedAt: Date): string {
  const legacy = patrolMarkLegacyWallTime(markedAt);
  const cr = patrolMarkWallTimeInCr(markedAt);
  if (legacy === cr) return cr;

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  let diff = Math.abs(toMin(legacy) - toMin(cr));
  if (diff > 12 * 60) diff = 24 * 60 - diff;
  if (diff >= 5 * 60 && diff <= 7 * 60) return legacy;
  return cr;
}

/** True si la marca cae en la ventana usando hora legada o Costa Rica (marcas nuevas y viejas). */
export function patrolMarkWithinScheduleWindow(
  markedAt: Date,
  startTime: string,
  endTime: string,
): boolean {
  const candidates = new Set([patrolMarkLegacyWallTime(markedAt), patrolMarkWallTimeInCr(markedAt)]);
  return [...candidates].some((t) => t >= startTime && t <= endTime);
}

export function patrolMarkDateForSchedule(markedAt: Date, fechaEsperada: string): string {
  const cr = patrolMarkDateIsoInCr(markedAt);
  const legacy = `${markedAt.getUTCFullYear()}-${String(markedAt.getUTCMonth() + 1).padStart(2, "0")}-${String(markedAt.getUTCDate()).padStart(2, "0")}`;
  if (cr === fechaEsperada || legacy === fechaEsperada) {
    return fechaEsperada;
  }
  return cr;
}
