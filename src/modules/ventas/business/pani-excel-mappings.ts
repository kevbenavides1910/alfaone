import type { VentasEquipamiento } from "@prisma/client";

/** Horario en hoja DETALLE → código MO (fórmula H = 'MOx'!$E$46). */
export const PANI_HORARIO_TO_JORNADA: Record<string, string> = {
  "L-D (24hrs)": "MO1",
  "L-V (07:00 a 16:30)": "MO2",
  "L-V (06:30 a 16:30)": "MO3",
  "L-D (12hrs NOCT.)": "MO4",
  "L-V (12hrs DIURN)": "MO5",
};

/** Hoja de insumos (columna L en DETALLE) → equipamiento y factor de oficiales. */
export const PANI_HOJA_INSUMO_MAP: Record<
  string,
  { equipamiento: VentasEquipamiento; factorOficiales: number }
> = {
  "3,89AF": { equipamiento: "AF", factorOficiales: 3.89 },
  "3,89AF-L": { equipamiento: "L", factorOficiales: 3.89 },
  "1AF": { equipamiento: "AF", factorOficiales: 1 },
  "3,89ANL": { equipamiento: "ANL", factorOficiales: 3.89 },
  "1ANL": { equipamiento: "ANL", factorOficiales: 1 },
  "1,5SA": { equipamiento: "SA", factorOficiales: 1.5 },
  "2,5SA": { equipamiento: "SA", factorOficiales: 2.5 },
  "3,89SA": { equipamiento: "SA", factorOficiales: 3.89 },
  "3,89AMBAS": { equipamiento: "SA", factorOficiales: 3.89 },
  "3,89AMBAS-L": { equipamiento: "SA", factorOficiales: 3.89 },
};

export const PANI_INSUMO_SHEET_NAMES = Object.keys(PANI_HOJA_INSUMO_MAP);

export const PANI_DEFAULT_FILE = "CÁLCULO COSTOS 2026 PANI.xlsx";

/** Extrae nombre de hoja desde fórmula Excel, ej. `'3,89AF'!$C$127`. */
export function parseInsumoHojaFromFormula(formula: string | undefined): string | null {
  if (!formula) return null;
  const m = formula.match(/'([^']+)'!/);
  return m ? m[1] : null;
}

/** Fórmula MO en columna H → código jornada. */
export function parseJornadaFromMoFormula(formula: string | undefined): string | null {
  if (!formula) return null;
  const m = formula.match(/'MO(\d)'!/i);
  if (!m) return null;
  const code = `MO${m[1]}`;
  return code.startsWith("MO") ? code : null;
}
