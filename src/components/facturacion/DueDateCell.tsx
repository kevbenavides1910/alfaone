"use client";

import { formatDate } from "@/lib/utils/format";
import {
  DUE_DATE_URGENCY_CLASS,
  type DueDateUrgency,
} from "@/lib/utils/due-date-urgency";

export function DueDateCell({
  dueDate,
  urgency,
  daysUntilDue,
}: {
  dueDate: string;
  urgency: DueDateUrgency;
  daysUntilDue: number;
}) {
  const hint =
    urgency === "overdue"
      ? `Venció hace ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) !== 1 ? "s" : ""}`
      : urgency === "due_soon"
        ? daysUntilDue === 0
          ? "Vence hoy"
          : `Vence en ${daysUntilDue} día${daysUntilDue !== 1 ? "s" : ""}`
        : `Vence en ${daysUntilDue} días`;

  return (
    <div>
      <div className={DUE_DATE_URGENCY_CLASS[urgency]}>{formatDate(dueDate)}</div>
      <div className={`text-xs ${DUE_DATE_URGENCY_CLASS[urgency]}`}>{hint}</div>
    </div>
  );
}
