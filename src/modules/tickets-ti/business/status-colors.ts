import type { TicketStatusCode } from "./status-transitions";

/** Tokens Tailwind para badges (spec UI § colores estado). */
export const TICKET_STATUS_COLOR: Record<
  TicketStatusCode,
  { bg: string; text: string; border: string }
> = {
  NUEVO: { bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-300" },
  ASIGNADO: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  EN_PROCESO: { bg: "bg-sky-100", text: "text-sky-800", border: "border-sky-300" },
  ESPERANDO_INFORMACION: {
    bg: "bg-amber-100",
    text: "text-amber-900",
    border: "border-amber-300",
  },
  ESPERANDO_PROVEEDOR: {
    bg: "bg-orange-100",
    text: "text-orange-900",
    border: "border-orange-300",
  },
  RESUELTO: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  VERIFICACION_USUARIO: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
  },
  CERRADO: { bg: "bg-green-200", text: "text-green-950", border: "border-green-400" },
  REABIERTO: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-300" },
  CANCELADO: { bg: "bg-slate-200", text: "text-slate-600", border: "border-slate-400" },
  RECHAZADO: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
};

export const TICKET_PRIORITY_COLOR: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  BAJA: { bg: "bg-green-100", text: "text-green-800", border: "border-green-300" },
  MEDIA: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  ALTA: { bg: "bg-orange-100", text: "text-orange-900", border: "border-orange-300" },
  CRITICA: { bg: "bg-red-100", text: "text-red-800", border: "border-red-300" },
};

export function statusBadgeClasses(code: string): string {
  const c = TICKET_STATUS_COLOR[code as TicketStatusCode];
  if (!c) return "bg-slate-100 text-slate-800 border-slate-300";
  return `${c.bg} ${c.text} ${c.border}`;
}

export function priorityBadgeClasses(code: string): string {
  const c = TICKET_PRIORITY_COLOR[code];
  if (!c) return "bg-slate-100 text-slate-800 border-slate-300";
  return `${c.bg} ${c.text} ${c.border}`;
}
