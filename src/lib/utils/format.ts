import { format, formatDistance, isAfter, addDays } from "date-fns";
import { es } from "date-fns/locale";

export function formatCurrency(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrencyPrecise(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPct(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return `${(num * 100).toFixed(2)}%`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  // Las fechas se almacenan como medianoche UTC en el servidor.
  // Usar componentes UTC evita que el navegador en UTC-6 desplace el día.
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return format(local, "dd/MM/yyyy", { locale: es });
}

/** Valor para `<input type="date">` alineado con formatDate (día calendario UTC en BD). */
export function calendarDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Muestra dd/mm/aaaa para el input de calendario (valor interno YYYY-MM-DD o ISO). */
export function formatCalendarDateForInput(
  value: string | Date | null | undefined
): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return formatDate(value);
}

/** Parsea dd/mm/aaaa o dd-mm-aaaa → YYYY-MM-DD; null si la fecha es inválida. */
export function parseCalendarDateFromDisplay(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
}

export function formatMonthYear(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "MMMM yyyy", { locale: es });
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistance(new Date(date), new Date(), { locale: es, addSuffix: true });
}

export function daysUntilExpiry(endDate: Date | string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function expiryAlertLevel(endDate: Date | string): "none" | "warning90" | "warning60" | "warning30" | "expired" {
  const days = daysUntilExpiry(endDate);
  if (days < 0) return "expired";
  if (days <= 30) return "warning30";
  if (days <= 60) return "warning60";
  if (days <= 90) return "warning90";
  return "none";
}

export function getFirstDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function toMonthString(date: Date): string {
  return format(date, "yyyy-MM");
}

export function fromMonthString(monthStr: string): Date {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

/** Etiqueta del periodo de servicio facturado (ej. «Del 14 al 1»). */
export function formatBillingPeriodRange(
  fromDay: number | null | undefined,
  toDay: number | null | undefined
): string {
  const from = Math.min(31, Math.max(1, fromDay ?? 1));
  const to = Math.min(31, Math.max(1, toDay ?? 31));
  if (to < from) {
    return `Del ${from} al ${to}`;
  }
  return `Del ${from} al ${to} de cada mes`;
}
