export const CALENDARIO_EVENT_STATUSES = ["SCHEDULED", "DONE", "CANCELLED"] as const;
export type CalendarioEventStatus = (typeof CALENDARIO_EVENT_STATUSES)[number];

/** Paleta para los tipos de evento (clave guardada en el catálogo → clases Tailwind del chip). */
export const CALENDARIO_COLORS = {
  blue: { label: "Azul", className: "bg-blue-100 text-blue-800 border-blue-200" },
  sky: { label: "Celeste", className: "bg-sky-100 text-sky-800 border-sky-200" },
  indigo: { label: "Índigo", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  purple: { label: "Morado", className: "bg-purple-100 text-purple-800 border-purple-200" },
  pink: { label: "Rosado", className: "bg-pink-100 text-pink-800 border-pink-200" },
  red: { label: "Rojo", className: "bg-red-100 text-red-800 border-red-200" },
  orange: { label: "Naranja", className: "bg-orange-100 text-orange-800 border-orange-200" },
  amber: { label: "Ámbar", className: "bg-amber-100 text-amber-800 border-amber-200" },
  lime: { label: "Lima", className: "bg-lime-100 text-lime-800 border-lime-200" },
  emerald: { label: "Verde", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  teal: { label: "Turquesa", className: "bg-teal-100 text-teal-800 border-teal-200" },
  gray: { label: "Gris", className: "bg-gray-100 text-gray-800 border-gray-200" },
} as const;
export type CalendarioColor = keyof typeof CALENDARIO_COLORS;
export const CALENDARIO_COLOR_KEYS = Object.keys(CALENDARIO_COLORS) as [CalendarioColor, ...CalendarioColor[]];

export function calendarioColorClass(color: string): string {
  return (CALENDARIO_COLORS as Record<string, { className: string }>)[color]?.className ?? CALENDARIO_COLORS.gray.className;
}

export type CalendarioEventTypeRef = { id: string; name: string; color: string };

export type CalendarioEventTypeOption = CalendarioEventTypeRef & { isActive: boolean };

export type CalendarioEventTypeRow = CalendarioEventTypeOption & {
  sortOrder: number;
  eventsCount: number;
};

export const CALENDARIO_STATUS_LABELS: Record<CalendarioEventStatus, string> = {
  SCHEDULED: "Pendiente",
  DONE: "Realizada",
  CANCELLED: "Cancelada",
};

export const CALENDARIO_STATUS_BADGE: Record<CalendarioEventStatus, string> = {
  SCHEDULED: "bg-amber-100 text-amber-800 border-amber-200",
  DONE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-600 border-gray-200",
};

export type CalendarioUserRef = { id: string; name: string };

/** Evidencias: fotos, PDF, Office y video corto. */
export const CALENDARIO_EVIDENCE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "mp4",
  "mov",
] as const;
export const CALENDARIO_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
export const CALENDARIO_EVIDENCE_MAX_FILES = 10;

export type CalendarioAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  contract: { id: string; label: string } | null;
  uploadedByName: string | null;
  createdAt: string;
  url: string;
};

/** Zonas NAF que no son operativas (desuso / finalizado). */
export const CALENDARIO_EXCLUDED_NAF_ZONES = ["00014", "00000"];

export type CalendarioZoneRef = { id: string; name: string };

export type CalendarioContractOption = {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
  zones: CalendarioZoneRef[];
};

export type CalendarioEventContract = CalendarioContractOption & {
  completedAt: string | null;
};

export type CalendarioEventSummary = {
  id: string;
  date: string;
  title: string;
  type: CalendarioEventTypeRef;
  status: CalendarioEventStatus;
  zone: CalendarioZoneRef | null;
  appliesToAllContracts: boolean;
  contractsCount: number;
  completedCount: number;
  admins: CalendarioUserRef[];
  attachmentsCount: number;
};

export type CalendarioEventDetail = CalendarioEventSummary & {
  description: string | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
  completedByName: string | null;
  contracts: CalendarioEventContract[];
  attachments: CalendarioAttachment[];
};

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date UTC medianoche (columna @db.Date). */
export function fromIsoDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
