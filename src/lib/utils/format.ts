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

function clampDayInMonth(year: number, month: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.min(Math.max(1, day), lastDay);
}

/** Fechas concretas del periodo de servicio para una factura mensual. */
export function computeServicePeriodForInvoice(
  periodYear: number,
  periodMonth: number,
  fromDay: number,
  toDay: number
): { from: Date; to: Date } {
  const fromD = Math.min(31, Math.max(1, fromDay));
  const toD = Math.min(31, Math.max(1, toDay));

  if (toD < fromD) {
    const prevMonth = periodMonth === 1 ? 12 : periodMonth - 1;
    const prevYear = periodMonth === 1 ? periodYear - 1 : periodYear;
    return {
      from: new Date(
        Date.UTC(prevYear, prevMonth - 1, clampDayInMonth(prevYear, prevMonth, fromD))
      ),
      to: new Date(
        Date.UTC(periodYear, periodMonth - 1, clampDayInMonth(periodYear, periodMonth, toD))
      ),
    };
  }

  return {
    from: new Date(
      Date.UTC(periodYear, periodMonth - 1, clampDayInMonth(periodYear, periodMonth, fromD))
    ),
    to: new Date(
      Date.UTC(periodYear, periodMonth - 1, clampDayInMonth(periodYear, periodMonth, toD))
    ),
  };
}

/** Rango legible del periodo de servicio (ej. «14 feb 2026 – 1 mar 2026»). */
export function formatServicePeriodDates(from: Date | string, to: Date | string): string {
  const fromDate = typeof from === "string" ? new Date(from) : from;
  const toDate = typeof to === "string" ? new Date(to) : to;
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-CR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(fromDate)} – ${fmt(toDate)}`;
}
