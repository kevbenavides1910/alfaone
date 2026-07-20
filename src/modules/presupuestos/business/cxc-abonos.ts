import { computeCxcBalance } from "./cxc-balance";
import type { ClientType } from "@prisma/client";

/**
 * Subconjunto mínimo de CuentaPorCobrarRow necesario para calcular el abono máximo.
 */
export type CxcAbonoContext = {
  /** Total calculado o monto original del documento. */
  totalCalculated: number | null;
  /** Monto neto esperado después de retenciones (si aplica cliente público). */
  netAmountExpected?: number | null;
  /** Monto ajustado después de rebajos. Si no se provee, se recalcula. */
  adjustedCollectible?: number | null;
  /** Monto acumulado de rebajos (descuentos). */
  totalRebajos?: number;
  /** Monto acumulado de abonos previos. */
  totalAbonos?: number;
  /** Tipo de cliente (público / privado). Afecta retención. */
  clientType?: ClientType | null;
  /** Saldo en base de datos (fallback cuando no hay total calculado). */
  saldo?: number;
  /** Estado del documento. */
  status?: "FACTURADO" | "COBRADO";
};

/**
 * Calcula el máximo abono que se puede registrar en un documento CXC.
 *
 * La lógica reutiliza `computeCxcBalance` para respetar retenciones de clientes
 * públicos, rebajos y abonos previos.
 */
export function calculateMaxNewAbono(context: CxcAbonoContext): number {
  if (context.adjustedCollectible != null && context.totalAbonos != null) {
    return Math.max(0, roundMoney(context.adjustedCollectible - context.totalAbonos));
  }

  const total = context.totalCalculated ?? context.netAmountExpected ?? context.saldo ?? 0;
  const balance = computeCxcBalance({
    total,
    clientType: context.clientType ?? null,
    abonos: [{ amount: context.totalAbonos ?? 0 }],
    rebajos: [{ amount: context.totalRebajos ?? 0 }],
    status: (context.status === "COBRADO" ? "COBRADO" : "FACTURADO") as import("@prisma/client").CxcDocumentoStatus,
    saldo: context.saldo ?? total,
  });

  return Math.max(0, balance.remainingBalance ?? balance.maxAbono ?? 0);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
