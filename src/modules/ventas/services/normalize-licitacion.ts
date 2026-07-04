/** Normaliza número de licitación para comparación y unicidad. */
export function normalizeLicitacionNo(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}
