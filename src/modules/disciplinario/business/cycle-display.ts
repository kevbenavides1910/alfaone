/** Etiquetas legibles para `DisciplinaryCycleAccion`. */
export const ACCION_CICLO_LABEL: Record<string, string> = {
  COBRADO: "Cobrado",
  DADO_DE_BAJA: "Dado de baja",
  OTRO: "Otro",
};

export function formatCycleClosureLabel(
  accion: string,
  accionRaw?: string | null,
): string {
  return ACCION_CICLO_LABEL[accion] ?? accionRaw?.trim() ?? accion;
}

export type TreatmentStateInput = {
  fechaConvocatoria?: string | null;
  accion?: string | null;
  cobradoDate?: string | null;
} | null;

export type UltimoCierreStateInput = {
  accion: string;
  accionRaw?: string | null;
} | null;

/** Claves canónicas para filtrar por estado de tratamiento. */
export type TreatmentFilterKey =
  | "COBRADO"
  | "DADO_DE_BAJA"
  | "PENDIENTE"
  | "OTRO"
  | "SIN_DEFINIR";

export const TREATMENT_FILTER_OPTIONS: { value: "" | TreatmentFilterKey; label: string }[] = [
  { value: "", label: "Todos los tratamientos" },
  { value: "COBRADO", label: "Cobrado" },
  { value: "DADO_DE_BAJA", label: "Dado de baja" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "OTRO", label: "Otro" },
  { value: "SIN_DEFINIR", label: "Sin definir" },
];

const TREATMENT_FILTER_KEYS = new Set<TreatmentFilterKey>([
  "COBRADO",
  "DADO_DE_BAJA",
  "PENDIENTE",
  "OTRO",
  "SIN_DEFINIR",
]);

export function parseTreatmentFilterParam(raw: string | null): TreatmentFilterKey | null {
  if (!raw?.trim()) return null;
  const k = raw.trim().toUpperCase().replace(/-/g, "_");
  if (k === "BAJA") return "DADO_DE_BAJA";
  if (TREATMENT_FILTER_KEYS.has(k as TreatmentFilterKey)) {
    return k as TreatmentFilterKey;
  }
  return null;
}

/** Clave de filtro alineada con `describeTreatmentState`. */
export function getTreatmentFilterKey(
  treatment: TreatmentStateInput,
  ultimoCierre?: UltimoCierreStateInput,
): TreatmentFilterKey {
  if (treatment?.cobradoDate) return "COBRADO";
  if ((treatment?.accion ?? "").toLowerCase().includes("baja")) return "DADO_DE_BAJA";
  if (treatment?.fechaConvocatoria || treatment?.accion) return "PENDIENTE";
  if (ultimoCierre?.accion === "COBRADO") return "COBRADO";
  if (ultimoCierre?.accion === "DADO_DE_BAJA") return "DADO_DE_BAJA";
  if (ultimoCierre?.accion === "OTRO") return "OTRO";
  return "SIN_DEFINIR";
}

/** Etiqueta y color del badge en Tratamiento (ciclo vigente o último cierre). */
export function describeTreatmentState(
  treatment: TreatmentStateInput,
  ultimoCierre?: UltimoCierreStateInput,
): { label: string; color: string } {
  if (treatment?.cobradoDate) {
    return { label: "Cobrado", color: "bg-emerald-100 text-emerald-800" };
  }
  if ((treatment?.accion ?? "").toLowerCase().includes("baja")) {
    return { label: "Dado de baja", color: "bg-rose-100 text-rose-700" };
  }
  if (treatment?.fechaConvocatoria || treatment?.accion) {
    return { label: "Pendiente", color: "bg-amber-100 text-amber-800" };
  }

  if (ultimoCierre) {
    if (ultimoCierre.accion === "COBRADO") {
      return { label: "Cobrado", color: "bg-emerald-100 text-emerald-800" };
    }
    if (ultimoCierre.accion === "DADO_DE_BAJA") {
      return { label: "Dado de baja", color: "bg-rose-100 text-rose-700" };
    }
    if (ultimoCierre.accion === "OTRO") {
      return {
        label: formatCycleClosureLabel(ultimoCierre.accion, ultimoCierre.accionRaw),
        color: "bg-slate-200 text-slate-700",
      };
    }
  }

  return { label: "Sin definir", color: "bg-slate-100 text-slate-600" };
}
