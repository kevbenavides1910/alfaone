type FeCostaRicaParts = {
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
  second: string;
};

/** Partes de fecha/hora en zona America/Costa_Rica (alineado a clave y FechaEmision XML). */
export function fePartsInCostaRica(date: Date): FeCostaRicaParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: get("hour").padStart(2, "0"),
    minute: get("minute").padStart(2, "0"),
    second: get("second").padStart(2, "0"),
  };
}

/** Día civil en Costa Rica (para clave numérica). */
export function feCalendarParts(date: Date): { year: number; month: number; day: number } {
  const { year, month, day } = fePartsInCostaRica(date);
  return { year, month, day };
}

/**
 * FechaEmision XML v4.4 — mismo instante que clave y API recepción.
 * Formato Hacienda CR (igual a Tico Factura aceptado): YYYY-MM-DDTHH:mm:ss-06:00
 */
export function formatFeFechaEmisionXml(date: Date): string {
  const { year, month, day, hour, minute, second } = fePartsInCostaRica(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hour}:${minute}:${second}.000`;
}

/**
 * Fecha para el payload JSON del API de Hacienda.
 * Sin offset: Hacienda interpreta la hora como local CR y la compara contra la fecha de la clave.
 * El XML usa -06:00 (schema v4.4), pero el API field 'fecha' debe ser sin zona.
 */
export function formatFeFechaApi(date: Date): string {
  const { year, month, day, hour, minute, second } = fePartsInCostaRica(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${hour}:${minute}:${second}`;
}
