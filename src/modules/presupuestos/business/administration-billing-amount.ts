type BillingLineLink = {
  billingLineId: string;
  monthlyAmount: { toString(): string } | number | null;
  billingLine?: { monthlyAmount: { toString(): string } | number | null } | null;
};

type AdministrationWithLines = {
  id: string;
  billingLines: BillingLineLink[];
};

function toNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v.toString());
  return Number.isFinite(n) ? n : null;
}

/** Suma el monto mensual de las líneas asignadas a una administración. */
export function sumAdministrationBillingLines(admin: AdministrationWithLines): number | null {
  if (admin.billingLines.length === 0) return null;

  let sum = 0;
  let hasAmount = false;
  for (const link of admin.billingLines) {
    const amt = toNum(link.monthlyAmount) ?? toNum(link.billingLine?.monthlyAmount ?? null);
    if (amt != null && amt > 0) {
      sum += amt;
      hasAmount = true;
    }
  }
  return hasAmount ? Math.round(sum * 100) / 100 : null;
}

/**
 * Reparte el subtotal del contrato entre emisiones.
 * Usa montos por administración cuando están definidos; si no, reparto igualitario.
 */
export function resolveEmisionSubtotals(
  contractSubtotal: number,
  administrations: AdministrationWithLines[],
  emisionCount: number
): (number | null)[] {
  if (emisionCount <= 0) return [];
  if (contractSubtotal <= 0) return Array(emisionCount).fill(null);

  const adminAmounts = administrations.map((a) => sumAdministrationBillingLines(a));
  const definedTotal = adminAmounts.reduce<number>((s, a) => s + (a ?? 0), 0);
  const allDefined =
    adminAmounts.length === emisionCount && adminAmounts.every((a) => a != null && a > 0);

  if (allDefined && Math.abs(definedTotal - contractSubtotal) < 0.02) {
    return adminAmounts;
  }

  if (definedTotal > 0 && adminAmounts.some((a) => a != null)) {
    const scale = contractSubtotal / definedTotal;
    return adminAmounts.map((a) =>
      a != null ? Math.round(a * scale * 100) / 100 : null
    );
  }

  const share = Math.round((contractSubtotal / emisionCount) * 100) / 100;
  return Array(emisionCount).fill(share);
}
