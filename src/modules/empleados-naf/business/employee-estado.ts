/** Estado inactivo típico en NAF. */
export const NAF_EMPLOYEE_ESTADO_INACTIVO = "I";

export function isNafEstadoActivo(estado: string | null | undefined): boolean {
  if (!estado) return true;
  const s = estado.trim().toUpperCase();
  return (
    s !== NAF_EMPLOYEE_ESTADO_INACTIVO &&
    s !== "INACTIVO" &&
    s !== "INACTIVE" &&
    s !== "E"
  );
}
