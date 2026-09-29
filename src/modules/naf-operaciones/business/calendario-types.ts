export const CALENDARIO_EVENT_TYPES = [
  "UNIFORM_CHANGE",
  "SUPPLY_DELIVERY",
  "INSPECTION",
  "TRAINING",
  "MEETING",
  "OTHER",
] as const;
export type CalendarioEventType = (typeof CALENDARIO_EVENT_TYPES)[number];

export const CALENDARIO_EVENT_STATUSES = ["SCHEDULED", "DONE", "CANCELLED"] as const;
export type CalendarioEventStatus = (typeof CALENDARIO_EVENT_STATUSES)[number];

export const CALENDARIO_TYPE_LABELS: Record<CalendarioEventType, string> = {
  UNIFORM_CHANGE: "Cambio de uniformes",
  SUPPLY_DELIVERY: "Entrega de insumos",
  INSPECTION: "Inspección / supervisión",
  TRAINING: "Capacitación",
  MEETING: "Reunión con cliente",
  OTHER: "Otro",
};

/** Clases Tailwind del chip del evento en el calendario. */
export const CALENDARIO_TYPE_COLORS: Record<CalendarioEventType, string> = {
  UNIFORM_CHANGE: "bg-blue-100 text-blue-800 border-blue-200",
  SUPPLY_DELIVERY: "bg-amber-100 text-amber-800 border-amber-200",
  INSPECTION: "bg-purple-100 text-purple-800 border-purple-200",
  TRAINING: "bg-emerald-100 text-emerald-800 border-emerald-200",
  MEETING: "bg-pink-100 text-pink-800 border-pink-200",
  OTHER: "bg-gray-100 text-gray-800 border-gray-200",
};

export const CALENDARIO_STATUS_LABELS: Record<CalendarioEventStatus, string> = {
  SCHEDULED: "Programado",
  DONE: "Realizado",
  CANCELLED: "Cancelado",
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
  type: CalendarioEventType;
  status: CalendarioEventStatus;
  zone: CalendarioZoneRef | null;
  appliesToAllContracts: boolean;
  contractsCount: number;
  completedCount: number;
};

export type CalendarioEventDetail = CalendarioEventSummary & {
  description: string | null;
  createdByName: string | null;
  createdAt: string;
  contracts: CalendarioEventContract[];
};

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date UTC medianoche (columna @db.Date). */
export function fromIsoDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
