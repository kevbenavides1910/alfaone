export const LEGAL_DOCUMENT_TYPES = [
  {
    value: "GARANTIA",
    label: "Garantías",
    chip: "bg-amber-100 text-amber-950 border-amber-300",
    dot: "bg-amber-500",
  },
  {
    value: "PERSONERIA",
    label: "Personerías",
    chip: "bg-indigo-100 text-indigo-950 border-indigo-300",
    dot: "bg-indigo-500",
  },
  {
    value: "CERTIFICACION",
    label: "Certificaciones",
    chip: "bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300",
    dot: "bg-fuchsia-500",
  },
  {
    value: "LICENCIA",
    label: "Licencias",
    chip: "bg-sky-100 text-sky-950 border-sky-300",
    dot: "bg-sky-500",
  },
  {
    value: "PERMISO",
    label: "Permisos",
    chip: "bg-orange-100 text-orange-950 border-orange-300",
    dot: "bg-orange-500",
  },
  {
    value: "FRECUENCIA",
    label: "Frecuencias",
    chip: "bg-teal-100 text-teal-950 border-teal-300",
    dot: "bg-teal-500",
  },
  {
    value: "CEDULA",
    label: "Cédulas",
    chip: "bg-cyan-100 text-cyan-950 border-cyan-300",
    dot: "bg-cyan-500",
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
] as const;

/** Mismos campos que el formulario general, sin Etiqueta ni Referencia. */
const TYPES_WITHOUT_REFERENCE = new Set<string>([
  "PERSONERIA",
  "CERTIFICACION",
  "LICENCIA",
  "PERMISO",
  "FRECUENCIA",
  "CEDULA",
]);

export function legalTypeOmitsReference(type: string): boolean {
  return TYPES_WITHOUT_REFERENCE.has(type);
}

export type LegalDocumentTypeValue = (typeof LEGAL_DOCUMENT_TYPES)[number]["value"];

const UNKNOWN_TYPE = {
  value: "OTRO",
  label: "Otros",
  chip: "bg-slate-100 text-slate-800 border-slate-300",
  dot: "bg-slate-500",
};

export function legalDocumentTypeMeta(type: string) {
  return (
    LEGAL_DOCUMENT_TYPES.find((item) => item.value === type) ?? {
      ...UNKNOWN_TYPE,
      value: type,
      label: type === "OTRO" ? "Otros" : type,
    }
  );
}

/** Etiqueta visible. En «Otros» usa la etiqueta libre si existe. */
export function legalDocumentTypeLabel(type: string, otherTypeLabel?: string | null): string {
  if (type === "OTRO") {
    const custom = otherTypeLabel?.trim();
    return custom ? `Otros · ${custom}` : "Otros";
  }
  return legalDocumentTypeMeta(type).label;
}
