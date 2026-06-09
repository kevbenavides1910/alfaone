/** Estado inactivo asignado a empleados ausentes en la última importación. */
export const EMPLOYEE_ESTADO_INACTIVO = "I";

/** Normaliza cédula/identificación para cruce entre importaciones (solo dígitos). */
export function normalizeCedula(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  return digits.replace(/^0+/, "") || digits;
}

export function isEmployeeEstadoActivo(estado: string | null | undefined): boolean {
  if (!estado) return true;
  const s = estado.trim().toUpperCase();
  return s !== EMPLOYEE_ESTADO_INACTIVO && s !== "INACTIVO" && s !== "INACTIVE";
}
