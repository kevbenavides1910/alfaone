import type { ClientType, CxcDocumentoStatus } from "@prisma/client";
import { computePublicClientRetention } from "@/modules/presupuestos/business/public-client-retention";

export type CxcRebajoRow = {
  id: string;
  description: string;
  amount: number;
  sortOrder: number;
};

export type CxcAbonoRow = {
  id: string;
  receiptNumber: string | null;
  amount: number;
  paidAt: string | null;
  sortOrder: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Colones sin decimales en UI: saldos menores a ₡1 se consideran cobrados. */
export const CXC_SALDO_TOLERANCE_CRC = 1;

export function sumRebajos(rebajos: { amount: number }[]): number {
  return roundMoney(rebajos.reduce((sum, row) => sum + row.amount, 0));
}

export function sumAbonos(abonos: { amount: number }[]): number {
  return roundMoney(abonos.reduce((sum, row) => sum + row.amount, 0));
}

export function computeCxcBalance(input: {
  total: number | null;
  clientType: ClientType | null;
  abonos: { amount: number }[];
  rebajos: { amount: number }[];
  status: CxcDocumentoStatus;
  saldo: number;
}) {
  const retention = computePublicClientRetention(input.total, input.clientType);
  const collectibleBase = retention.netAmountExpected ?? input.total;
  const totalRebajos = sumRebajos(input.rebajos);
  const adjustedCollectible =
    collectibleBase != null ? roundMoney(Math.max(0, collectibleBase - totalRebajos)) : null;

  const totalAbonos = sumAbonos(input.abonos);
  const hasPaymentActivity = totalAbonos > 0 || input.rebajos.length > 0;
  /** Import/sync SAP: saldo en BD = monto original hasta que haya abonos o rebajos. */
  const persistedSaldoMatchesTotal =
    input.total != null &&
    input.total > 0 &&
    input.saldo > 0 &&
    Math.abs(input.saldo - input.total) <= CXC_SALDO_TOLERANCE_CRC;

  let remainingBalance: number | null = null;
  if (input.status === "COBRADO" || input.saldo <= CXC_SALDO_TOLERANCE_CRC) {
    remainingBalance = 0;
  } else if (!hasPaymentActivity && persistedSaldoMatchesTotal) {
    remainingBalance = roundMoney(input.saldo);
  } else if (adjustedCollectible != null) {
    remainingBalance =
      totalAbonos > 0
        ? roundMoney(Math.max(0, adjustedCollectible - totalAbonos))
        : adjustedCollectible;
  } else {
    remainingBalance = input.saldo > 0 ? input.saldo : 0;
  }

  const hasPartialPayment =
    totalAbonos > 0 &&
    adjustedCollectible != null &&
    remainingBalance != null &&
    remainingBalance > 0 &&
    totalAbonos < adjustedCollectible;

  return {
    ...retention,
    totalRebajos,
    totalAbonos,
    adjustedCollectible,
    remainingBalance,
    hasPartialPayment,
    maxAbono: adjustedCollectible ?? collectibleBase ?? input.total ?? 0,
  };
}

export function recalculateCxcDocumentSaldo(
  adjustedCollectible: number,
  totalAbonos: number
): { saldo: number; status: CxcDocumentoStatus; paidAt: Date | null } {
  const saldo = roundMoney(Math.max(0, adjustedCollectible - totalAbonos));
  if (saldo <= CXC_SALDO_TOLERANCE_CRC) {
    return { saldo: 0, status: "COBRADO", paidAt: new Date() };
  }
  return { saldo, status: "PENDIENTE", paidAt: null };
}
