function parseCalendarDate(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

function shiftUtcDays(value: Date, days: number): Date {
  const shifted = new Date(value);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

function toOracleDateKey(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * En NAF el calendario de asistencia (Oficiales Roles) corre 3 días antes
 * que el rango de planilla ARPLHCP. Ej.: planilla 16/06–30/06 → asistencia 13/06–27/06.
 */
export function deriveAsistenciaDateRange(
  payrollFDesde: string,
  payrollFHasta: string,
): { fDesde: string; fHasta: string } {
  const desde = shiftUtcDays(parseCalendarDate(payrollFDesde), -3);
  const hasta = shiftUtcDays(parseCalendarDate(payrollFHasta), -3);
  return {
    fDesde: toOracleDateKey(desde),
    fHasta: toOracleDateKey(hasta),
  };
}

export function formatAsistenciaRangeLabel(fDesde: string, fHasta: string): string {
  const desde = parseCalendarDate(fDesde);
  const hasta = parseCalendarDate(fHasta);
  const fmt = (date: Date) =>
    `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  return `${fmt(desde)} – ${fmt(hasta)}`;
}
