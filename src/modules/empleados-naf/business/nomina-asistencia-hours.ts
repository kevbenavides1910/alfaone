/**
 * Extrae horas de un texto de horario NAF, p. ej.
 * "04651 > Propietario 06:00-14:00 Marca S" → 8
 * "04707 > Propietario 23:00-05:00 Marca S" → 6 (cruza medianoche)
 */
export function parseHorarioHours(horario: string | null | undefined): number {
  if (!horario) return 0;
  const match = String(horario).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return 0;

  const startH = Number(match[1]);
  const startM = Number(match[2]);
  const endH = Number(match[3]);
  const endM = Number(match[4]);
  if (![startH, startM, endH, endM].every((n) => Number.isFinite(n))) return 0;
  if (startH > 23 || endH > 23 || startM > 59 || endM > 59) return 0;

  let minutes = endH * 60 + endM - (startH * 60 + startM);
  if (minutes < 0) minutes += 24 * 60;
  if (minutes === 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

/** Peso para repartir salario: pago del rol NAF → horas → marcas. */
export function asistenciaAllocationWeight(row: {
  pagoRol?: number;
  horas?: number;
  marcas?: number;
  dias?: number;
}): number {
  const pagoRol = Number(row.pagoRol) || 0;
  if (pagoRol > 0) return pagoRol;
  const horas = Number(row.horas) || 0;
  if (horas > 0) return horas;
  return Number(row.marcas) || Number(row.dias) || 0;
}
