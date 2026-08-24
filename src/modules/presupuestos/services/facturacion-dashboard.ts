import type { PrismaClient } from "@prisma/client";
import { computeCxcBalance } from "@/modules/presupuestos/business/cxc-balance";
import {
  resolveClientTypeForCxc,
  resolveCxcSubtotalForDocument,
} from "@/modules/presupuestos/business/public-client-retention";
import {
  calendarDayUtc,
  facturaClosedOnTime,
} from "@/modules/presupuestos/services/facturacion-cobro";

type Db = Pick<PrismaClient, "cxcDocumento" | "facturaMensual">;

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function toAmount(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v.toString());
}

function emptyMonthRow(month: number, year: number) {
  return {
    month,
    year,
    label: MONTH_LABELS[month - 1] ?? String(month),
    cxc: {
      dueAmount: 0,
      dueCount: 0,
      collectedOnTimeAmount: 0,
      collectedOnTimeCount: 0,
      collectedLateAmount: 0,
      collectedLateCount: 0,
      pendingAmount: 0,
      pendingCount: 0,
      onTimeRate: null as number | null,
      onTimeRateByCount: null as number | null,
    },
    facturacion: {
      expectedAmount: 0,
      expectedCount: 0,
      invoicedAmount: 0,
      invoicedCount: 0,
      invoicedOnTimeAmount: 0,
      invoicedOnTimeCount: 0,
      pendingInvoiceAmount: 0,
      pendingInvoiceCount: 0,
      receivedConformeCount: 0,
      receivedConformeAmount: 0,
      receivedConformeRate: null as number | null,
      receivedConformeRateByCount: null as number | null,
      invoicedOnTimeRate: null as number | null,
      invoicedOnTimeRateByCount: null as number | null,
    },
    ingresos: {
      expectedInflowAmount: 0,
      expectedInflowCount: 0,
      actualInflowAmount: 0,
      actualInflowGrossAmount: 0,
      actualInflowCount: 0,
      varianceAmount: 0,
      varianceCount: 0,
      fulfillmentRate: null as number | null,
      fulfillmentRateByCount: null as number | null,
    },
  };
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function paymentOnTime(paidAt: Date, dueDate: Date): boolean {
  return calendarDayUtc(paidAt) <= calendarDayUtc(dueDate);
}

function cxcGrossAmount(doc: {
  montoOriginal: { toString(): string } | number | null;
  saldo: { toString(): string } | number;
}): number {
  return toAmount(doc.montoOriginal) || toAmount(doc.saldo);
}

function cxcCollectibleAmount(
  doc: {
    clientName?: string | null;
    montoOriginal: { toString(): string } | number | null;
    saldo: { toString(): string } | number;
    status: "PENDIENTE" | "COBRADO";
    contract?: {
      clientType: "PUBLIC" | "PRIVATE" | null;
      ivaPct?: { toString(): string } | number | null;
    } | null;
    facturaMensual?: {
      subtotalCopied?: { toString(): string } | number | null;
      ivaPctCopied?: { toString(): string } | number | null;
    } | null;
    rebajos: { amount: { toString(): string } | number }[];
    abonos: { amount: { toString(): string } | number }[];
  }
): number {
  const total = toAmount(doc.montoOriginal) || toAmount(doc.saldo);
  const clientType = resolveClientTypeForCxc(doc.contract?.clientType ?? null, doc.clientName ?? null);
  const subtotal = resolveCxcSubtotalForDocument({
    total,
    clientName: doc.clientName,
    clientType,
    subtotalCopied: toAmount(doc.facturaMensual?.subtotalCopied ?? null),
    ivaPctCopied: toAmount(doc.facturaMensual?.ivaPctCopied ?? null),
    contractIvaPct: toAmount(doc.contract?.ivaPct ?? null),
  });
  const balance = computeCxcBalance({
    total,
    subtotal,
    clientType,
    abonos: doc.abonos.map((a) => ({ amount: toAmount(a.amount) })),
    rebajos: doc.rebajos.map((r) => ({ amount: toAmount(r.amount) })),
    status: doc.status,
    saldo: toAmount(doc.saldo),
  });
  return balance.adjustedCollectible ?? balance.netAmountExpected ?? toAmount(doc.montoOriginal) ?? toAmount(doc.saldo);
}

function expectedInflowDate(doc: {
  cxcExpectedPaymentDate: Date | null;
  dueDate: Date | null;
}): Date | null {
  return doc.cxcExpectedPaymentDate ?? doc.dueDate;
}

function facturaReceivedConforme(row: {
  invoiceReceivedAt: Date | null;
  emisiones: { invoiceReceivedAt: Date | null }[];
}): boolean {
  if (row.invoiceReceivedAt) return true;
  if (row.emisiones.length === 0) return false;
  return row.emisiones.every((e) => e.invoiceReceivedAt != null);
}

function monthIndex(year: number, month: number, targetYear: number): number | null {
  if (year !== targetYear || month < 1 || month > 12) return null;
  return month - 1;
}

function dateMonthIndex(d: Date, targetYear: number): number | null {
  return monthIndex(d.getUTCMonth() + 1, d.getUTCFullYear(), targetYear);
}

function docBaseAmount(doc: {
  montoOriginal: { toString(): string } | number | null;
  saldo: { toString(): string } | number;
  abonos: { amount: { toString(): string } | number }[];
}): number {
  if (doc.montoOriginal != null) return toAmount(doc.montoOriginal);
  // Reconstruct original face value: current saldo + all recorded abonos
  const totalAbonos = doc.abonos.reduce((s, a) => s + toAmount(a.amount), 0);
  return toAmount(doc.saldo) + totalAbonos;
}

function effectivePaidAmountAsOf(
  doc: {
    status: "PENDIENTE" | "COBRADO";
    paidAt: Date | null;
    abonos: { amount: { toString(): string } | number; paidAt: Date | null }[];
  },
  asOf: Date
): number {
  const datedAbonos = doc.abonos.filter((a) => a.paidAt != null && a.paidAt <= asOf);
  if (datedAbonos.length > 0) {
    return datedAbonos.reduce((s, a) => s + toAmount(a.amount), 0);
  }
  // Legacy: doc marked COBRADO with paidAt but no dated abonos
  if (doc.status === "COBRADO" && doc.paidAt != null && doc.paidAt <= asOf) {
    return Infinity; // fully paid — balance = 0
  }
  return 0;
}

function collectionsInPeriod(
  doc: {
    status: "PENDIENTE" | "COBRADO";
    paidAt: Date | null;
    abonos: { amount: { toString(): string } | number; paidAt: Date | null }[];
  },
  base: number,
  periodStart: Date,
  periodEnd: Date
): number {
  const datedAbonos = doc.abonos.filter(
    (a) => a.paidAt != null && a.paidAt >= periodStart && a.paidAt < periodEnd
  );
  if (datedAbonos.length > 0) {
    return datedAbonos.reduce((s, a) => s + toAmount(a.amount), 0);
  }
  // Legacy: doc marked COBRADO in this period with no dated abonos
  if (
    doc.status === "COBRADO" &&
    doc.paidAt != null &&
    doc.paidAt >= periodStart &&
    doc.paidAt < periodEnd &&
    doc.abonos.every((a) => a.paidAt == null)
  ) {
    return base; // entire amount collected this period
  }
  return 0;
}

export async function buildCxcRollingBalance(db: Db, year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const docs = await db.cxcDocumento.findMany({
    where: {
      isReajuste: false,
      docType: { in: ["FC", "FM"] },
      AND: [
        // Not fully paid before the year started
        {
          OR: [{ status: "PENDIENTE" }, { paidAt: { gte: yearStart } }],
        },
        // Created before year ended
        {
          OR: [
            { documentDate: { lt: yearEnd } },
            { documentDate: null, createdAt: { lt: yearEnd } },
          ],
        },
      ],
    },
    select: {
      documentDate: true,
      createdAt: true,
      montoOriginal: true,
      saldo: true,
      status: true,
      paidAt: true,
      abonos: { select: { amount: true, paidAt: true } },
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    year,
    label: MONTH_LABELS[i] ?? String(i + 1),
    openingAmount: 0,
    openingCount: 0,
    newEntriesAmount: 0,
    newEntriesCount: 0,
    collectionsAmount: 0,
    collectionsCount: 0,
    closingAmount: 0,
    closingCount: 0,
  }));

  for (const doc of docs) {
    const entryDate: Date = doc.documentDate ?? doc.createdAt;
    const base = docBaseAmount(doc);
    if (base <= 0) continue;

    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const monthStart = new Date(Date.UTC(year, mIdx, 1));
      const monthEnd = new Date(Date.UTC(year, mIdx + 1, 1));
      const row = months[mIdx];

      // New entries: doc entered CxC during this month
      if (entryDate >= monthStart && entryDate < monthEnd) {
        row.newEntriesAmount += base;
        row.newEntriesCount += 1;
      }

      // Opening balance: doc existed before this month with remaining balance > 0
      if (entryDate < monthStart) {
        const paid = effectivePaidAmountAsOf(doc, new Date(monthStart.getTime() - 1));
        const remaining = paid === Infinity ? 0 : Math.max(0, base - paid);
        if (remaining > 0) {
          row.openingAmount += remaining;
          row.openingCount += 1;
        }
      }

      // Collections: payments in this month
      const collected = collectionsInPeriod(doc, base, monthStart, monthEnd);
      if (collected > 0) {
        row.collectionsAmount += collected;
        row.collectionsCount += 1;
      }
    }
  }

  // Compute closing balance and round
  for (const row of months) {
    row.openingAmount = Math.round(row.openingAmount * 100) / 100;
    row.newEntriesAmount = Math.round(row.newEntriesAmount * 100) / 100;
    row.collectionsAmount = Math.round(row.collectionsAmount * 100) / 100;
    row.closingAmount =
      Math.round((row.openingAmount + row.newEntriesAmount - row.collectionsAmount) * 100) / 100;

    // Closing count: docs with any remaining balance at end of month
    // (derived from openingCount + newEntriesCount - fully paid this month)
    // We approximate: closingCount isn't easily exact without re-scanning; skip for now
    row.closingCount = 0; // filled below
  }

  // Second pass: compute exact closing count per month
  for (const doc of docs) {
    const entryDate: Date = doc.documentDate ?? doc.createdAt;
    const base = docBaseAmount(doc);
    if (base <= 0) continue;

    for (let mIdx = 0; mIdx < 12; mIdx++) {
      const monthStart = new Date(Date.UTC(year, mIdx, 1));
      const monthEnd = new Date(Date.UTC(year, mIdx + 1, 1));

      if (entryDate >= monthEnd) continue; // not yet created

      const paid = effectivePaidAmountAsOf(doc, new Date(monthEnd.getTime() - 1));
      const remaining = paid === Infinity ? 0 : Math.max(0, base - paid);
      if (remaining > 0) {
        months[mIdx].closingCount += 1;
      }
    }
  }

  return months;
}

export type CxcRollingBalanceData = Awaited<ReturnType<typeof buildCxcRollingBalance>>;

export async function buildFacturacionDashboard(db: Db, year: number) {
  const months = Array.from({ length: 12 }, (_, i) => emptyMonthRow(i + 1, year));

  const cxcBaseInclude = {
    clientName: true,
    contract: { select: { clientType: true, ivaPct: true } },
    facturaMensual: { select: { subtotalCopied: true, ivaPctCopied: true } },
    rebajos: { select: { amount: true } },
    abonos: { select: { amount: true } },
  } as const;

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const startOfTodayUtc = new Date(calendarDayUtc(new Date()));

  const [cxcDueDocs, cxcPaidDocs, cxcExpectedDocs, cxcOverduePending, facturas] =
    await Promise.all([
    db.cxcDocumento.findMany({
      where: {
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
        dueDate: { gte: yearStart, lt: yearEnd },
      },
      include: cxcBaseInclude,
    }),
    db.cxcDocumento.findMany({
      where: {
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
        status: "COBRADO",
        paidAt: { gte: yearStart, lt: yearEnd },
      },
      include: cxcBaseInclude,
    }),
    db.cxcDocumento.findMany({
      where: {
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
        OR: [
          { cxcExpectedPaymentDate: { gte: yearStart, lt: yearEnd } },
          {
            cxcExpectedPaymentDate: null,
            dueDate: { gte: yearStart, lt: yearEnd },
          },
        ],
      },
      include: cxcBaseInclude,
    }),
    db.cxcDocumento.findMany({
      where: {
        isReajuste: false,
        docType: { in: ["FC", "FM"] },
        status: "PENDIENTE",
        saldo: { gt: 0 },
        dueDate: { lt: startOfTodayUtc },
      },
      include: cxcBaseInclude,
    }),
    db.facturaMensual.findMany({
      where: { periodYear: year },
      include: {
        emisiones: { select: { invoiceReceivedAt: true } },
      },
    }),
  ]);

  for (const doc of cxcDueDocs) {
    if (!doc.dueDate) continue;
    const idx = dateMonthIndex(doc.dueDate, year);
    if (idx == null) continue;

    const amount = cxcCollectibleAmount(doc);
    const row = months[idx].cxc;
    row.dueAmount += amount;
    row.dueCount += 1;

    if (doc.status === "COBRADO" && doc.paidAt) {
      if (paymentOnTime(doc.paidAt, doc.dueDate)) {
        row.collectedOnTimeAmount += amount;
        row.collectedOnTimeCount += 1;
      } else {
        row.collectedLateAmount += amount;
        row.collectedLateCount += 1;
      }
    } else if (doc.status === "PENDIENTE") {
      row.pendingAmount += amount;
      row.pendingCount += 1;
    }
  }

  for (const doc of cxcExpectedDocs) {
    const ref = expectedInflowDate(doc);
    if (!ref) continue;
    const idx = dateMonthIndex(ref, year);
    if (idx == null) continue;

    const amount = cxcCollectibleAmount(doc);
    const row = months[idx].ingresos;
    row.expectedInflowAmount += amount;
    row.expectedInflowCount += 1;
  }

  for (const doc of cxcPaidDocs) {
    if (!doc.paidAt) continue;
    const idx = dateMonthIndex(doc.paidAt, year);
    if (idx == null) continue;

    const amount = cxcCollectibleAmount(doc);
    const gross = cxcGrossAmount(doc);
    const row = months[idx].ingresos;
    row.actualInflowAmount += amount;
    row.actualInflowGrossAmount += gross;
    row.actualInflowCount += 1;
  }

  for (const factura of facturas) {
    const idx = monthIndex(factura.periodMonth, factura.periodYear, year);
    if (idx == null) continue;

    const amount = toAmount(factura.totalCalculated);
    const isDefined = factura.status !== "PENDIENTE_DEFINIR" && amount > 0;
    if (!isDefined) continue;

    const row = months[idx].facturacion;
    row.expectedAmount += amount;
    row.expectedCount += 1;

    const isInvoiced = factura.status === "FACTURADO" || factura.status === "COBRADO";
    if (isInvoiced) {
      row.invoicedAmount += amount;
      row.invoicedCount += 1;

      const closedAt = factura.closedAt ?? factura.updatedAt;
      if (facturaClosedOnTime(closedAt, factura.expectedIssueDate)) {
        row.invoicedOnTimeCount += 1;
        row.invoicedOnTimeAmount += amount;
      }
    } else {
      row.pendingInvoiceAmount += amount;
      row.pendingInvoiceCount += 1;
    }

    if (facturaReceivedConforme(factura)) {
      row.receivedConformeCount += 1;
      row.receivedConformeAmount += amount;
    }
  }

  for (const m of months) {
    m.cxc.dueAmount = Math.round(m.cxc.dueAmount * 100) / 100;
    m.cxc.collectedOnTimeAmount = Math.round(m.cxc.collectedOnTimeAmount * 100) / 100;
    m.cxc.collectedLateAmount = Math.round(m.cxc.collectedLateAmount * 100) / 100;
    m.cxc.pendingAmount = Math.round(m.cxc.pendingAmount * 100) / 100;
    m.cxc.onTimeRate = rate(m.cxc.collectedOnTimeAmount, m.cxc.dueAmount);
    m.cxc.onTimeRateByCount = rate(m.cxc.collectedOnTimeCount, m.cxc.dueCount);

    m.facturacion.expectedAmount = Math.round(m.facturacion.expectedAmount * 100) / 100;
    m.facturacion.invoicedAmount = Math.round(m.facturacion.invoicedAmount * 100) / 100;
    m.facturacion.invoicedOnTimeAmount =
      Math.round(m.facturacion.invoicedOnTimeAmount * 100) / 100;
    m.facturacion.pendingInvoiceAmount =
      Math.round(m.facturacion.pendingInvoiceAmount * 100) / 100;
    m.facturacion.receivedConformeAmount =
      Math.round(m.facturacion.receivedConformeAmount * 100) / 100;
    m.facturacion.receivedConformeRate = rate(
      m.facturacion.receivedConformeAmount,
      m.facturacion.expectedAmount
    );
    m.facturacion.receivedConformeRateByCount = rate(
      m.facturacion.receivedConformeCount,
      m.facturacion.expectedCount
    );
    m.facturacion.invoicedOnTimeRate = rate(
      m.facturacion.invoicedOnTimeAmount,
      m.facturacion.invoicedAmount
    );
    m.facturacion.invoicedOnTimeRateByCount = rate(
      m.facturacion.invoicedOnTimeCount,
      m.facturacion.invoicedCount
    );

    m.ingresos.expectedInflowAmount = Math.round(m.ingresos.expectedInflowAmount * 100) / 100;
    m.ingresos.actualInflowAmount = Math.round(m.ingresos.actualInflowAmount * 100) / 100;
    m.ingresos.actualInflowGrossAmount =
      Math.round(m.ingresos.actualInflowGrossAmount * 100) / 100;
    m.ingresos.varianceAmount =
      Math.round((m.ingresos.actualInflowAmount - m.ingresos.expectedInflowAmount) * 100) / 100;
    m.ingresos.varianceCount = m.ingresos.actualInflowCount - m.ingresos.expectedInflowCount;
    m.ingresos.fulfillmentRate = rate(
      m.ingresos.actualInflowAmount,
      m.ingresos.expectedInflowAmount
    );
    m.ingresos.fulfillmentRateByCount = rate(
      m.ingresos.actualInflowCount,
      m.ingresos.expectedInflowCount
    );
  }

  const totals = months.reduce(
    (acc, m) => {
      acc.cxc.dueAmount += m.cxc.dueAmount;
      acc.cxc.dueCount += m.cxc.dueCount;
      acc.cxc.collectedOnTimeAmount += m.cxc.collectedOnTimeAmount;
      acc.cxc.collectedOnTimeCount += m.cxc.collectedOnTimeCount;
      acc.cxc.collectedLateAmount += m.cxc.collectedLateAmount;
      acc.cxc.collectedLateCount += m.cxc.collectedLateCount;
      acc.cxc.pendingAmount += m.cxc.pendingAmount;
      acc.cxc.pendingCount += m.cxc.pendingCount;

      acc.facturacion.expectedAmount += m.facturacion.expectedAmount;
      acc.facturacion.expectedCount += m.facturacion.expectedCount;
      acc.facturacion.invoicedAmount += m.facturacion.invoicedAmount;
      acc.facturacion.invoicedCount += m.facturacion.invoicedCount;
      acc.facturacion.invoicedOnTimeAmount += m.facturacion.invoicedOnTimeAmount;
      acc.facturacion.invoicedOnTimeCount += m.facturacion.invoicedOnTimeCount;
      acc.facturacion.pendingInvoiceAmount += m.facturacion.pendingInvoiceAmount;
      acc.facturacion.pendingInvoiceCount += m.facturacion.pendingInvoiceCount;
      acc.facturacion.receivedConformeCount += m.facturacion.receivedConformeCount;
      acc.facturacion.receivedConformeAmount += m.facturacion.receivedConformeAmount;

      acc.ingresos.expectedInflowAmount += m.ingresos.expectedInflowAmount;
      acc.ingresos.expectedInflowCount += m.ingresos.expectedInflowCount;
      acc.ingresos.actualInflowAmount += m.ingresos.actualInflowAmount;
      acc.ingresos.actualInflowGrossAmount += m.ingresos.actualInflowGrossAmount;
      acc.ingresos.actualInflowCount += m.ingresos.actualInflowCount;

      return acc;
    },
    {
      cxc: {
        dueAmount: 0,
        dueCount: 0,
        collectedOnTimeAmount: 0,
        collectedOnTimeCount: 0,
        collectedLateAmount: 0,
        collectedLateCount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        onTimeRate: null as number | null,
        onTimeRateByCount: null as number | null,
      },
      facturacion: {
        expectedAmount: 0,
        expectedCount: 0,
        invoicedAmount: 0,
        invoicedCount: 0,
        invoicedOnTimeAmount: 0,
        invoicedOnTimeCount: 0,
        pendingInvoiceAmount: 0,
        pendingInvoiceCount: 0,
        receivedConformeCount: 0,
        receivedConformeAmount: 0,
        receivedConformeRate: null as number | null,
        receivedConformeRateByCount: null as number | null,
        invoicedOnTimeRate: null as number | null,
        invoicedOnTimeRateByCount: null as number | null,
      },
      ingresos: {
        expectedInflowAmount: 0,
        expectedInflowCount: 0,
        actualInflowAmount: 0,
        actualInflowGrossAmount: 0,
        actualInflowCount: 0,
        varianceAmount: 0,
        varianceCount: 0,
        fulfillmentRate: null as number | null,
        fulfillmentRateByCount: null as number | null,
      },
    }
  );

  let overduePendingGrossAmount = 0;
  let overduePendingNetAmount = 0;
  for (const doc of cxcOverduePending) {
    overduePendingGrossAmount += cxcGrossAmount(doc);
    overduePendingNetAmount += cxcCollectibleAmount(doc);
  }
  overduePendingGrossAmount = Math.round(overduePendingGrossAmount * 100) / 100;
  overduePendingNetAmount = Math.round(overduePendingNetAmount * 100) / 100;

  const snapshot = {
    overduePendingGrossAmount,
    overduePendingGrossCount: cxcOverduePending.length,
    overduePendingNetAmount,
    overduePendingNetCount: cxcOverduePending.length,
    asOf: new Date().toISOString(),
  };

  totals.cxc.onTimeRate = rate(totals.cxc.collectedOnTimeAmount, totals.cxc.dueAmount);
  totals.cxc.onTimeRateByCount = rate(totals.cxc.collectedOnTimeCount, totals.cxc.dueCount);
  totals.facturacion.receivedConformeRate = rate(
    totals.facturacion.receivedConformeAmount,
    totals.facturacion.expectedAmount
  );
  totals.facturacion.receivedConformeRateByCount = rate(
    totals.facturacion.receivedConformeCount,
    totals.facturacion.expectedCount
  );
  totals.facturacion.invoicedOnTimeRate = rate(
    totals.facturacion.invoicedOnTimeAmount,
    totals.facturacion.invoicedAmount
  );
  totals.facturacion.invoicedOnTimeRateByCount = rate(
    totals.facturacion.invoicedOnTimeCount,
    totals.facturacion.invoicedCount
  );
  totals.ingresos.varianceAmount =
    Math.round((totals.ingresos.actualInflowAmount - totals.ingresos.expectedInflowAmount) * 100) /
    100;
  totals.ingresos.varianceCount =
    totals.ingresos.actualInflowCount - totals.ingresos.expectedInflowCount;
  totals.ingresos.fulfillmentRate = rate(
    totals.ingresos.actualInflowAmount,
    totals.ingresos.expectedInflowAmount
  );
  totals.ingresos.fulfillmentRateByCount = rate(
    totals.ingresos.actualInflowCount,
    totals.ingresos.expectedInflowCount
  );

  return { year, months, totals, snapshot };
}

export type FacturacionDashboardData = Awaited<ReturnType<typeof buildFacturacionDashboard>>;
