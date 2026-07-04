const CR_TZ = "America/Costa_Rica";

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
