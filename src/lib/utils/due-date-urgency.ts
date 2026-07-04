export type DueDateUrgency = "overdue" | "due_soon" | "ok";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Días hasta vencimiento (negativo = vencido). */
export function daysUntilDue(dueDate: Date | string, asOf: Date = new Date()): number {
  const due = startOfLocalDay(typeof dueDate === "string" ? new Date(dueDate) : dueDate);
  const today = startOfLocalDay(asOf);
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Rojo: vencido · Amarillo: faltan menos de 7 días (0–6) · Verde: 7 días o más.
 */
export function dueDateUrgency(dueDate: Date | string, asOf: Date = new Date()): DueDateUrgency {
  const days = daysUntilDue(dueDate, asOf);
  if (days < 0) return "overdue";
  if (days < 7) return "due_soon";
  return "ok";
}

export const DUE_DATE_URGENCY_CLASS: Record<DueDateUrgency, string> = {
  overdue: "text-red-700 font-semibold",
  due_soon: "text-amber-700 font-semibold",
  ok: "text-green-700 font-medium",
};
