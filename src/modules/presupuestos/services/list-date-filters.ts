import { parseCalendarDateInput } from "@/modules/presupuestos/services/facturacion-cobro";

function endOfCalendarDayUtc(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}

/** Rango inclusivo sobre un campo DateTime (día calendario UTC). */
export function prismaDateRange(
  field: string,
  from?: string | null,
  to?: string | null
): Record<string, unknown> | undefined {
  const f = from?.trim();
  const t = to?.trim();
  if (!f && !t) return undefined;

  const range: { gte?: Date; lte?: Date } = {};
  if (f) range.gte = parseCalendarDateInput(f);
  if (t) range.lte = endOfCalendarDayUtc(t);
  return { [field]: range };
}

export function appendSearchParam(params: URLSearchParams, key: string, value?: string) {
  const v = value?.trim();
  if (v) params.set(key, v);
}
