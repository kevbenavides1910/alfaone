/** Catálogo fijo de secciones del formato documental Alfa (títulos no editables). */

export type AlfaSectionKey =
  | "OBJETIVO_GENERAL"
  | "ALCANCE"
  | "REFERENCIAS_NORMATIVAS"
  | "DEFINICIONES"
  | "RESPONSABILIDADES"
  | "DOCUMENTOS_RELACIONADOS"
  | "DIAGRAMA_FLUJO"
  | "DESCRIPCION_ACTIVIDADES"
  | "PROCESOS_INTERACTUAN"
  | "CONTROL_CAMBIOS"
  | "ANEXOS";

export type AlfaSectionDef = {
  key: AlfaSectionKey;
  /** Numeración típica en procedimientos Alfa (P-*). */
  number: string;
  title: string;
  kind: "prose" | "flowchart" | "activities";
  /** Si false, solo se muestra cuando hay contenido. */
  alwaysShow?: boolean;
};

/**
 * Orden canónico alineado a procedimientos corporativos
 * (ej. P-FI-11: … 5. Diagrama, 6. Descripción de Actividades).
 * Referencias/Responsabilidades son opcionales (manuales).
 */
export const ALFA_FIXED_SECTIONS: AlfaSectionDef[] = [
  { key: "OBJETIVO_GENERAL", number: "1", title: "Objetivo General", kind: "prose", alwaysShow: true },
  { key: "ALCANCE", number: "2", title: "Alcance", kind: "prose", alwaysShow: true },
  { key: "REFERENCIAS_NORMATIVAS", number: "3", title: "Referencias Normativas", kind: "prose" },
  { key: "DEFINICIONES", number: "3", title: "Definiciones", kind: "prose", alwaysShow: true },
  { key: "RESPONSABILIDADES", number: "4", title: "Responsabilidades", kind: "prose" },
  { key: "DOCUMENTOS_RELACIONADOS", number: "4", title: "Documentos Relacionados", kind: "prose", alwaysShow: true },
  { key: "DIAGRAMA_FLUJO", number: "5", title: "Diagrama de Flujo", kind: "flowchart", alwaysShow: true },
  { key: "DESCRIPCION_ACTIVIDADES", number: "6", title: "Descripción de Actividades", kind: "activities", alwaysShow: true },
  { key: "PROCESOS_INTERACTUAN", number: "7", title: "Procesos que Interactúan", kind: "prose", alwaysShow: true },
  { key: "CONTROL_CAMBIOS", number: "8", title: "Control de Cambios", kind: "prose", alwaysShow: true },
  { key: "ANEXOS", number: "9", title: "Anexos", kind: "prose", alwaysShow: true },
];

const TITLE_TO_KEY: Array<{ re: RegExp; key: AlfaSectionKey }> = [
  { re: /^objetivo(\s+general)?$/i, key: "OBJETIVO_GENERAL" },
  { re: /^alcance$/i, key: "ALCANCE" },
  { re: /^referencias?\s+normativas?$/i, key: "REFERENCIAS_NORMATIVAS" },
  { re: /^definiciones?$/i, key: "DEFINICIONES" },
  { re: /^responsabilidades?$/i, key: "RESPONSABILIDADES" },
  { re: /^documentos?\s+relacionados?$/i, key: "DOCUMENTOS_RELACIONADOS" },
  { re: /^diagrama\s+de\s+flujo$/i, key: "DIAGRAMA_FLUJO" },
  { re: /^descripci[oó]n\s+de\s+(actividades|lineamientos)$/i, key: "DESCRIPCION_ACTIVIDADES" },
  { re: /^procesos?\s+que\s+interact[uú]an$/i, key: "PROCESOS_INTERACTUAN" },
  { re: /^control\s+de\s+cambios$/i, key: "CONTROL_CAMBIOS" },
  { re: /^anexos?$/i, key: "ANEXOS" },
  { re: /^finalidad$/i, key: "OBJETIVO_GENERAL" },
];

export function sectionDef(key: AlfaSectionKey): AlfaSectionDef {
  return ALFA_FIXED_SECTIONS.find((s) => s.key === key)!;
}

export function displaySectionTitle(key: AlfaSectionKey): string {
  const d = sectionDef(key);
  return `${d.number}. ${d.title}`;
}

export function matchSectionKeyFromTitle(rawTitle: string): AlfaSectionKey | null {
  const t = rawTitle
    .replace(/^\d+(?:\.\d+)*\s*[.)]?\s*/, "")
    .trim()
    .replace(/:+$/, "");
  for (const { re, key } of TITLE_TO_KEY) {
    if (re.test(t)) return key;
  }
  return null;
}

export const ACTIVITY_TABLE_HEADERS = ["Actividad", "Descripción", "Documentos", "Responsable"] as const;
