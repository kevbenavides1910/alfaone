import type { ClientType } from "@prisma/client";

/** Retención del 2 % que aplica el gobierno a clientes públicos (Costa Rica). */
export const PUBLIC_CLIENT_RETENTION_PCT = 0.02;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePublicClientRetention(
  invoiceTotal: number | null | undefined,
  clientType: ClientType | null | undefined
): {
  appliesRetention: boolean;
  retentionPct: number;
  retentionAmount: number | null;
  netAmountExpected: number | null;
} {
  if (invoiceTotal == null || invoiceTotal <= 0) {
    return {
      appliesRetention: false,
      retentionPct: 0,
      retentionAmount: null,
      netAmountExpected: null,
    };
  }

  if (clientType === "PUBLIC") {
    const retentionAmount = roundMoney(invoiceTotal * PUBLIC_CLIENT_RETENTION_PCT);
    return {
      appliesRetention: true,
      retentionPct: PUBLIC_CLIENT_RETENTION_PCT,
      retentionAmount,
      netAmountExpected: roundMoney(invoiceTotal - retentionAmount),
    };
  }

  return {
    appliesRetention: false,
    retentionPct: 0,
    retentionAmount: null,
    netAmountExpected: roundMoney(invoiceTotal),
  };
}
