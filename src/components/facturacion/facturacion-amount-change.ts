import { formatCurrency } from "@/lib/utils/format";
import type { FacturaMensualRow } from "@/components/facturacion/FacturacionDetailDialog";
import type { FacturaListExpandedRow } from "@/components/facturacion/FacturacionListFilters";

type AmountChangeRow = Pick<
  FacturaMensualRow,
  | "subtotalCopied"
  | "totalCalculated"
  | "amountDefined"
  | "ivaPctCopied"
  | "returnRequestStatus"
  | "returnRequestType"
  | "returnRequestRequestedSubtotal"
  | "lastCorrectionType"
  | "lastCorrectionPreviousSubtotal"
  | "lastCorrectionReason"
  | "observationLog"
>;

/** Convierte monto con formato es-CR (espacios miles, coma decimal) a número. */
export function parseSpanishDecimalAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Extrae el subtotal aprobado de lastCorrectionReason ("Subtotal solicitado: …"). */
export function parseRequestedSubtotalFromCorrectionReason(
  reason: string | null | undefined
): number | null {
  if (!reason?.trim()) return null;
  const match = reason.match(/Subtotal solicitado:\s*([\d\s.,]+)/i);
  if (!match) return null;
  return parseSpanishDecimalAmount(match[1]);
}

/** Extrae subtotal anterior → nuevo de la bitácora de solicitud. */
export function parseAmountChangeFromObservationLog(
  observationLog: string | null | undefined
): { from: number; to: number } | null {
  if (!observationLog) return null;
  const match = observationLog.match(
    /subtotal\s+([\d\s.,]+)\s*→\s*([\d\s.,]+)/i
  );
  if (!match) return null;
  const from = parseSpanishDecimalAmount(match[1]);
  const to = parseSpanishDecimalAmount(match[2]);
  if (from == null || to == null) return null;
  return { from, to };
}

/** Subtotal aprobado para correcciones de monto (incluye registros anteriores al fix). */
export function getFacturaApprovedSubtotal(row: AmountChangeRow): number | null {
  if (row.lastCorrectionType !== "AMOUNT") return null;
  return (
    parseRequestedSubtotalFromCorrectionReason(row.lastCorrectionReason) ??
    parseAmountChangeFromObservationLog(row.observationLog)?.to ??
    null
  );
}

/** Subtotal efectivo para listados (aplica monto aprobado si aún no se guardó en BD). */
export function getFacturaEffectiveSubtotal(row: AmountChangeRow): number | null {
  if (!row.amountDefined || row.subtotalCopied == null) return null;
  const approved = getFacturaApprovedSubtotal(row);
  if (approved != null) return approved;
  return row.subtotalCopied;
}

export function getFacturaEffectiveTotal(row: AmountChangeRow): number | null {
  const subtotal = getFacturaEffectiveSubtotal(row);
  if (subtotal == null) return null;
  if (
    row.lastCorrectionType === "AMOUNT" &&
    getFacturaApprovedSubtotal(row) != null &&
    row.totalCalculated != null &&
    row.subtotalCopied != null &&
    Math.abs(row.subtotalCopied - subtotal) >= 0.005
  ) {
    const ivaPct = row.ivaPctCopied ?? 0;
    return Math.round(subtotal * (1 + ivaPct / 100) * 100) / 100;
  }
  return row.totalCalculated;
}

/** Diferencia de subtotal: positivo = aumento, negativo = disminución. */
export function getFacturaAmountChangeDelta(row: AmountChangeRow): number | null {
  if (row.subtotalCopied == null) return null;

  if (
    row.returnRequestStatus === "PENDING" &&
    row.returnRequestType !== "DOCUMENTATION" &&
    row.returnRequestRequestedSubtotal != null
  ) {
    return row.returnRequestRequestedSubtotal - row.subtotalCopied;
  }

  if (row.lastCorrectionType !== "AMOUNT") return null;

  if (row.lastCorrectionPreviousSubtotal != null) {
    const effective = getFacturaEffectiveSubtotal(row);
    if (effective == null) return null;
    return effective - row.lastCorrectionPreviousSubtotal;
  }

  const approved = getFacturaApprovedSubtotal(row);
  if (approved != null) {
    const logChange = parseAmountChangeFromObservationLog(row.observationLog);
    if (logChange) return logChange.to - logChange.from;
    return approved - row.subtotalCopied;
  }

  return null;
}

export function formatFacturaAmountChangeDelta(
  delta: number | null,
  options?: { pending?: boolean }
): string {
  if (delta == null || Math.abs(delta) < 0.005) return "—";
  const sign = delta > 0 ? "+" : "−";
  const amount = formatCurrency(Math.abs(delta));
  const label = `${sign}${amount}`;
  return options?.pending ? `${label} (pend.)` : label;
}

export function isPendingAmountChange(row: AmountChangeRow): boolean {
  return (
    row.returnRequestStatus === "PENDING" && row.returnRequestType !== "DOCUMENTATION"
  );
}

type IvaAmountRow = Pick<
  FacturaMensualRow,
  | "amountDefined"
  | "subtotalCopied"
  | "totalCalculated"
  | "ivaPctCopied"
  | "lastCorrectionType"
  | "lastCorrectionReason"
  | "observationLog"
>;

export function getFacturaIvaAmount(row: IvaAmountRow): number | null {
  const subtotal = getFacturaEffectiveSubtotal(row);
  if (!row.amountDefined || subtotal == null) return null;
  const total = getFacturaEffectiveTotal(row);
  if (total != null) {
    return Math.round((total - subtotal) * 100) / 100;
  }
  return Math.round(((subtotal * row.ivaPctCopied) / 100) * 100) / 100;
}

export type FacturacionListTotals = {
  facturaCount: number;
  subtotal: number;
  ivaAmount: number;
  total: number;
  amountChangeSum: number;
};

/** Totales por factura mensual (sin duplicar por administración/emisión). */
export function computeFacturacionListTotals(
  rows: FacturaListExpandedRow[]
): FacturacionListTotals {
  const seen = new Set<string>();
  let subtotal = 0;
  let total = 0;
  let amountChangeSum = 0;

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);

    const effectiveSubtotal = getFacturaEffectiveSubtotal(row);
    const effectiveTotal = getFacturaEffectiveTotal(row);

    if (effectiveSubtotal != null) {
      subtotal += effectiveSubtotal;
    }
    if (effectiveTotal != null) {
      total += effectiveTotal;
    }

    const delta = getFacturaAmountChangeDelta(row);
    if (delta != null) {
      amountChangeSum += delta;
    }
  }

  return {
    facturaCount: seen.size,
    subtotal,
    ivaAmount: Math.round((total - subtotal) * 100) / 100,
    total,
    amountChangeSum,
  };
}
