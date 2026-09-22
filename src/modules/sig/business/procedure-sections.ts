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
  number: string;
  title: string;
  /** prose | flowchart | activities */
  kind: "prose" | "flowchart" | "activities";
};

export const ALFA_FIXED_SECTIONS: AlfaSectionDef[] = [
  { key: "OBJETIVO_GENERAL", number: "1", title: "Objetivo General", kind: "prose" },
  { key: "ALCANCE", number: "2", title: "Alcance", kind: "prose" },
  { key: "REFERENCIAS_NORMATIVAS", number: "3", title: "Referencias Normativas", kind: "prose" },
  { key: "DEFINICIONES", number: "4", title: "Definiciones", kind: "prose" },
  { key: "RESPONSABILIDADES", number: "5", title: "Responsabilidades", kind: "prose" },
  { key: "DOCUMENTOS_RELACIONADOS", number: "6", title: "Documentos Relacionados", kind: "prose" },
  { key: "DIAGRAMA_FLUJO", number: "7", title: "Diagrama de Flujo", kind: "flowchart" },
  { key: "DESCRIPCION_ACTIVIDADES", number: "8", title: "Descripción de Actividades", kind: "activities" },
  { key: "PROCESOS_INTERACTUAN", number: "9", title: "Procesos que Interactúan", kind: "prose" },
  { key: "CONTROL_CAMBIOS", number: "10", title: "Control de Cambios", kind: "prose" },
  { key: "ANEXOS", number: "11", title: "Anexos", kind: "prose" },
];

/** Numeración típica en PDFs Alfa (varía: a veces Definiciones es 3). */
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
