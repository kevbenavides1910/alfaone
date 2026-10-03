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
  recurrence: CalendarioRecurrence;
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
  /** Cuántas fechas se crearon en esta guardada. Solo viene al crear una serie. */
  seriesCreated?: number;
};

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date UTC medianoche (columna @db.Date). */
export function fromIsoDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export type CalendarioDigestKind = "DUE_DAY" | "REMINDER";

/** Correo del día de la tarea, o recordatorio si ya pasó y sigue pendiente. */
export function calendarioDigestKind(eventDay: string, today: string): CalendarioDigestKind | null {
  if (eventDay > today) return null;
  if (eventDay === today) return "DUE_DAY";
  return "REMINDER";
}

/** Días entre la fecha de la tarea y hoy (0 si es hoy o aún no llega). */
export function calendarioDaysPending(eventDay: string, today: string): number {
  const start = Date.parse(`${eventDay}T00:00:00.000Z`);
  const end = Date.parse(`${today}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86_400_000);
}

export const CALENDARIO_RECURRENCES = ["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "YEARLY"] as const;
export type CalendarioRecurrence = (typeof CALENDARIO_RECURRENCES)[number];

export const CALENDARIO_RECURRENCE_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  YEARLY: 12,
} as const;

export const CALENDARIO_RECURRENCE_LABELS: Record<CalendarioRecurrence, string> = {
  NONE: "Una vez",
  WEEKLY: "Cada semana",
  MONTHLY: "Cada mes",
  QUARTERLY: "Cada 3 meses",
  SEMIANNUAL: "Cada 6 meses",
  YEARLY: "Cada año",
};

/** Horizonte al crear la serie: desde la fecha inicial hasta 24 meses después. */
const SERIES_HORIZON_MONTHS = 24;

/** Suma meses de calendario y recorta el día si el mes destino es más corto. */
export function addMonthsIso(iso: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const shifted = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0)).getUTCDate();
  return toIsoDate(new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), Math.min(day, lastDay))));
}

/** Suma días de calendario en UTC. */
export function addDaysIso(iso: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toIsoDate(shifted);
}

/** Día del aviso «falta un mes» para la fecha del evento. */
export function monthBeforeIso(eventDay: string): string {
  return addMonthsIso(eventDay, -1);
}

/** Siguiente fecha de una serie ya iniciada. */
export function nextCalendarioOccurrence(iso: string, recurrence: Exclude<CalendarioRecurrence, "NONE">): string {
  if (recurrence === "WEEKLY") return addDaysIso(iso, 7);
  return addMonthsIso(iso, CALENDARIO_RECURRENCE_MONTHS[recurrence]);
}

/** Fechas de la serie, incluida la inicial, hasta 24 meses después. */
export function calendarioOccurrenceDates(startIso: string, recurrence: CalendarioRecurrence): string[] {
  if (recurrence === "NONE") return [startIso];
  const limit = addMonthsIso(startIso, SERIES_HORIZON_MONTHS);
  const maxDates = recurrence === "WEEKLY" ? 120 : 36;
  const dates = [startIso];
  let cursor = startIso;
  while (dates.length < maxDates) {
    cursor = nextCalendarioOccurrence(cursor, recurrence);
    if (cursor > limit) break;
    dates.push(cursor);
  }
  return dates;
}

export function formatCalendarioDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
