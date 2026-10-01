import { toIsoDay } from "./dates";

export type ReminderOffsetUnit = "DAYS" | "MONTHS";

export type ReminderOffset = {
  offsetValue: number;
  offsetUnit: ReminderOffsetUnit;
};

/** Anticipación respecto a la fecha de pago. Cero = el mismo día. */
export function computeSendOn(dueDate: Date, offsetValue: number, offsetUnit: ReminderOffsetUnit): Date {
  const y = dueDate.getUTCFullYear();
  const m = dueDate.getUTCMonth();
  const d = dueDate.getUTCDate();
  if (offsetUnit === "MONTHS") {
    const total = y * 12 + m - offsetValue;
    const ny = Math.floor(total / 12);
    const nm = ((total % 12) + 12) % 12;
    const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ny, nm, Math.min(d, last)));
  }
  return new Date(Date.UTC(y, m, d - offsetValue));
}

export function reminderKey(offset: ReminderOffset): string {
  return `${offset.offsetUnit}:${offset.offsetValue}`;
}

export function formatReminderOffset(offset: ReminderOffset): string {
  if (offset.offsetValue === 0) return "el mismo día";
  if (offset.offsetUnit === "DAYS") {
    return offset.offsetValue === 1 ? "1 día antes" : `${offset.offsetValue} días antes`;
  }
  return offset.offsetValue === 1 ? "1 mes antes" : `${offset.offsetValue} meses antes`;
}

export function formatReminderList(reminders: ReminderOffset[]): string {
  return [...reminders]
    .sort((a, b) => a.offsetUnit.localeCompare(b.offsetUnit) || a.offsetValue - b.offsetValue)
    .map(formatReminderOffset)
    .join("; ");
}

/** Si la fecha de envío cambió, el aviso anterior no cuenta para la nueva fecha. */
export function sentAtAfterReschedule(
  previous: { sendOn: Date; sentAt: Date | null } | undefined,
  nextSendOn: Date,
): Date | null {
  if (!previous?.sentAt) return null;
  if (toIsoDay(previous.sendOn) !== toIsoDay(nextSendOn)) return null;
  return previous.sentAt;
}
