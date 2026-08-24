import type { ClientType } from "@prisma/client";

/** Retención del 2 % que aplica el gobierno a clientes públicos (Costa Rica). */
export const PUBLIC_CLIENT_RETENTION_PCT = 0.02;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeClientName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resuelve tipo de cliente para retención CxC.
 * Si el documento no tiene contrato (import Codisa), infiere PUBLIC por nombre
 * de instituciones típicas (CCSS, AyA, municipalidades, etc.).
 */
export function resolveClientTypeForCxc(
  clientType: ClientType | null | undefined,
  clientName: string | null | undefined,
): ClientType | null {
  if (clientType === "PUBLIC" || clientType === "PRIVATE") return clientType;
  const n = normalizeClientName(clientName ?? "");
  if (!n) return null;

  if (
    /\bCCSS\b/.test(n) ||
    n.includes("CAJA COSTARRICENSE") ||
    /\bAYA\b/.test(n) ||
    n.includes("ACUEDUCT") ||
    n.includes("ALCANTARILL") ||
    n.includes("MUNICIPALIDAD") ||
    n.includes("MINISTERIO") ||
    n.includes("PODER JUDICIAL") ||
    n.includes("CORTE SUPREMA") ||
    /\bUTN\b/.test(n) ||
    /\bINA\b/.test(n) ||
    /\bPANI\b/.test(n) ||
    /\bICE\b/.test(n) ||
    n.includes("HOSPITAL") ||
    n.includes("AREA DE SALUD") ||
    n.includes("AREAS DE SALUD") ||
    /^A\.?S\.?\s/.test(n)
  ) {
    return "PUBLIC";
  }

  return null;
}

/** IVA por defecto cuando no hay contrato/factura: CCSS/salud suele ir exento (0 %). */
export function defaultIvaPctForPublicClient(
  clientType: ClientType | null | undefined,
  clientName: string | null | undefined,
): number | null {
  if (clientType !== "PUBLIC") return null;
  const n = normalizeClientName(clientName ?? "");
  if (!n) return null;
  if (
    /\bCCSS\b/.test(n) ||
    n.includes("CAJA COSTARRICENSE") ||
    n.includes("AREA DE SALUD") ||
    n.includes("AREAS DE SALUD") ||
    n.includes("HOSPITAL") ||
    /^A\.?S\.?\s/.test(n)
  ) {
    return 0;
  }
  return null;
}

/** Subtotal (base imponible) para retención: copiado de factura o derivado del total + IVA. */
export function resolveCxcSubtotal(input: {
  total: number | null;
  subtotalCopied?: number | null;
  ivaPct?: number | null;
}): number | null {
  const { total, subtotalCopied, ivaPct } = input;
  if (subtotalCopied != null && subtotalCopied >= 0) {
    return roundMoney(subtotalCopied);
  }
  if (total == null || total <= 0) return null;
  if (ivaPct != null && ivaPct > 0) {
    return roundMoney((total * 100) / (100 + ivaPct));
  }
  if (ivaPct === 0) {
    return roundMoney(total);
  }
  return null;
}

export function resolveCxcSubtotalForDocument(input: {
  total: number | null;
  clientName?: string | null;
  clientType?: ClientType | null;
  subtotalCopied?: number | null;
  ivaPctCopied?: number | null;
  contractIvaPct?: number | null;
}): number | null {
  const clientType = resolveClientTypeForCxc(input.clientType, input.clientName);
  const ivaPctKnown =
    input.ivaPctCopied ??
    input.contractIvaPct ??
    defaultIvaPctForPublicClient(clientType, input.clientName);
  return resolveCxcSubtotal({
    total: input.total,
    subtotalCopied: input.subtotalCopied,
    ivaPct: ivaPctKnown,
  });
}

export function computePublicClientRetention(
  invoiceTotal: number | null | undefined,
  clientType: ClientType | null | undefined,
  retentionBaseSubtotal?: number | null
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
    const base =
      retentionBaseSubtotal != null && retentionBaseSubtotal > 0
        ? retentionBaseSubtotal
        : invoiceTotal;
    const retentionAmount = roundMoney(base * PUBLIC_CLIENT_RETENTION_PCT);
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
