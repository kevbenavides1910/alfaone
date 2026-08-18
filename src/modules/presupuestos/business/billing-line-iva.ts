export type BillingLineIvaInput = {
  amount: number;
  appliesIva: boolean;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function lineIvaAmount(baseAmount: number, appliesIva: boolean, ivaPct: number): number {
  if (!appliesIva || baseAmount <= 0 || ivaPct <= 0) return 0;
  return roundMoney((baseAmount * ivaPct) / 100);
}

export function lineTotalAmount(baseAmount: number, appliesIva: boolean, ivaPct: number): number {
  return roundMoney(baseAmount + lineIvaAmount(baseAmount, appliesIva, ivaPct));
}

export function computeMixedIvaTotals(
  lines: BillingLineIvaInput[],
  ivaPct: number
): { subtotal: number; ivaAmount: number; total: number } {
  let subtotal = 0;
  let taxable = 0;
  for (const line of lines) {
    if (line.amount <= 0) continue;
    subtotal += line.amount;
    if (line.appliesIva) taxable += line.amount;
  }
  subtotal = roundMoney(subtotal);
  taxable = roundMoney(taxable);
  const ivaAmount = lineIvaAmount(taxable, true, ivaPct);
  return { subtotal, ivaAmount, total: roundMoney(subtotal + ivaAmount) };
}

/** IVA sobre el subtotal completo (contratos sin desglose por línea). */
export function calculateInvoiceTotal(subtotal: number, ivaPct: number): number {
  return computeMixedIvaTotals([{ amount: subtotal, appliesIva: true }], ivaPct).total;
}

type BillingLineCatalogRow = {
  id: string;
  monthlyAmount: { toString(): string } | number | null;
  appliesIva: boolean;
};

type AdminBillingLink = {
  billingLineId: string;
  monthlyAmount: { toString(): string } | number | null;
  billingLine?: {
    monthlyAmount: { toString(): string } | number | null;
    appliesIva?: boolean;
  } | null;
};

function toNum(v: { toString(): string } | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v.toString());
  return Number.isFinite(n) ? n : null;
}

function resolveLinkBaseAmount(
  link: AdminBillingLink,
  catalog: Map<string, BillingLineCatalogRow>
): number | null {
  const fromLink = toNum(link.monthlyAmount);
  const line = catalog.get(link.billingLineId) ?? link.billingLine;
  const fromLine = toNum(line?.monthlyAmount ?? null);
  const amount = fromLink ?? fromLine;
  return amount != null && amount > 0 ? amount : null;
}

function resolveLinkAppliesIva(
  link: AdminBillingLink,
  catalog: Map<string, BillingLineCatalogRow>
): boolean {
  const fromCatalog = catalog.get(link.billingLineId)?.appliesIva;
  if (fromCatalog != null) return fromCatalog;
  return link.billingLine?.appliesIva ?? true;
}

export function computeAdministrationIvaTotals(
  admin: { billingLines: AdminBillingLink[] },
  catalogLines: BillingLineCatalogRow[],
  ivaPct: number
): { subtotal: number; ivaAmount: number; total: number } | null {
  if (admin.billingLines.length === 0) return null;

  const catalog = new Map(catalogLines.map((l) => [l.id, l]));
  const inputs: BillingLineIvaInput[] = [];

  for (const link of admin.billingLines) {
    const amount = resolveLinkBaseAmount(link, catalog);
    if (amount == null) continue;
    inputs.push({
      amount,
      appliesIva: resolveLinkAppliesIva(link, catalog),
    });
  }

  if (inputs.length === 0) return null;
  return computeMixedIvaTotals(inputs, ivaPct);
}

export function computeContractBillingIvaTotals(
  administrations: { billingLines: AdminBillingLink[] }[],
  catalogLines: BillingLineCatalogRow[],
  ivaPct: number
): { subtotal: number; ivaAmount: number; total: number } | null {
  const inputs: BillingLineIvaInput[] = [];
  const catalog = new Map(catalogLines.map((l) => [l.id, l]));

  for (const admin of administrations) {
    for (const link of admin.billingLines) {
      const amount = resolveLinkBaseAmount(link, catalog);
      if (amount == null) continue;
      inputs.push({
        amount,
        appliesIva: resolveLinkAppliesIva(link, catalog),
      });
    }
  }

  if (inputs.length === 0) return null;
  return computeMixedIvaTotals(inputs, ivaPct);
}

export function extractBillingLineCatalog(
  administrations: { billingLines: AdminBillingLink[] }[]
): BillingLineCatalogRow[] {
  const map = new Map<string, BillingLineCatalogRow>();
  for (const admin of administrations) {
    for (const link of admin.billingLines) {
      if (!link.billingLine) continue;
      map.set(link.billingLineId, {
        id: link.billingLineId,
        monthlyAmount: link.billingLine.monthlyAmount,
        appliesIva: link.billingLine.appliesIva ?? true,
      });
    }
  }
  return [...map.values()];
}

/** Totales de factura respetando IVA por línea cuando hay desglose. */
export function resolveFacturaTotalsFromBilling(
  fallbackSubtotal: number,
  ivaPct: number,
  catalogLines: BillingLineCatalogRow[],
  administrations: { billingLines: AdminBillingLink[] }[]
): { subtotal: number; ivaAmount: number; total: number } {
  const fromAdmins = computeContractBillingIvaTotals(administrations, catalogLines, ivaPct);
  if (fromAdmins != null) return fromAdmins;

  if (catalogLines.length > 0) {
    const inputs = catalogLines
      .map((l) => ({
        amount: toNum(l.monthlyAmount) ?? 0,
        appliesIva: l.appliesIva,
      }))
      .filter((l) => l.amount > 0);
    if (inputs.length > 0) return computeMixedIvaTotals(inputs, ivaPct);
  }

  return computeMixedIvaTotals([{ amount: fallbackSubtotal, appliesIva: true }], ivaPct);
}
