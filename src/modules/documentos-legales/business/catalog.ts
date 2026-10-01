export const LEGAL_DOCUMENT_TYPES = [
  {
    value: "GARANTIA",
    label: "Garantías",
    chip: "bg-amber-100 text-amber-950 border-amber-300",
    dot: "bg-amber-500",
  },
  {
    value: "LICENCIA",
    label: "Licencias",
    chip: "bg-sky-100 text-sky-950 border-sky-300",
    dot: "bg-sky-500",
  },
  {
    value: "PATENTE",
    label: "Patentes",
    chip: "bg-violet-100 text-violet-950 border-violet-300",
    dot: "bg-violet-500",
  },
  {
    value: "CONSTANCIA",
    label: "Constancias",
    chip: "bg-emerald-100 text-emerald-950 border-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    value: "POLIZA",
    label: "Pólizas",
    chip: "bg-rose-100 text-rose-950 border-rose-300",
    dot: "bg-rose-500",
  },
  {
    value: "OTRO",
    label: "Otros",
    chip: "bg-slate-100 text-slate-800 border-slate-300",
    dot: "bg-slate-500",
  },
] as const;

export type LegalDocumentTypeValue = (typeof LEGAL_DOCUMENT_TYPES)[number]["value"];

export function legalDocumentTypeMeta(type: string) {
  return LEGAL_DOCUMENT_TYPES.find((t) => t.value === type) ?? LEGAL_DOCUMENT_TYPES[5];
}

/** Etiqueta visible. En «Otros» usa la etiqueta libre si existe. */
export function legalDocumentTypeLabel(type: string, otherTypeLabel?: string | null): string {
  if (type === "OTRO") {
    const custom = otherTypeLabel?.trim();
    return custom ? `Otros · ${custom}` : "Otros";
  }
  return legalDocumentTypeMeta(type).label;
}
