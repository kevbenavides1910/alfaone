import type { CxcDocumentoStatus, Prisma, PrismaClient } from "@prisma/client";
import { parseCalendarDateInput } from "@/modules/presupuestos/services/facturacion-cobro";
import { prismaDateRange } from "@/modules/presupuestos/services/list-date-filters";
import { daysUntilDue, dueDateUrgency } from "@/lib/utils/due-date-urgency";
import {
  computeCxcBalance,
  recalculateCxcDocumentSaldo,
} from "@/modules/presupuestos/business/cxc-balance";
import type { CuentasPorCobrarListInput } from "@/modules/presupuestos/validations/cuentas-por-cobrar.schema";

type Db = Pick<PrismaClient, "cxcDocumento">;

function toAmount(v: { toString(): string } | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" ? v : parseFloat(v.toString());
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type BillingContactSnapshot = {
  name: string;
  jobTitle: string | null;
  phone: string;
  phone2: string | null;
  email: string;
};

type ClientContactRow = {
  name: string;
  jobTitle: string | null;
  phone: string;
  phone2: string | null;
  email: string;
  isBillingContact: boolean;
  sortOrder: number;
};

export function pickBillingContact(contacts: ClientContactRow[]): BillingContactSnapshot | null {
  const billing = contacts
    .filter((c) => c.isBillingContact)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const row = billing[0];
  if (!row) return null;
  return {
    name: row.name,
    jobTitle: row.jobTitle,
    phone: row.phone,
    phone2: row.phone2,
    email: row.email,
  };
}

type CxcDocumentoWithRelations = {
  id: string;
  contractId: string | null;
  facturaMensualId: string | null;
  companyCode: string | null;
  documentNumber: string;
  invoiceNumber: string | null;
  docType: string;
  documentDate: Date | null;
  invoiceReceivedAt: Date | null;
  servicePeriodDate: Date | null;
  montoOriginal: { toString(): string } | number | null;
  saldo: { toString(): string } | number;
  clientName: string;
  dueDate: Date | null;
  cxcExpectedPaymentDate: Date | null;
  provisionalReceiptNumber: string | null;
  provisionalPaymentAmount: { toString(): string } | number | null;
  cxcObservations: string | null;
  status: CxcDocumentoStatus;
  paidAt: Date | null;
  lastPaymentReviewAt: Date | null;
  lastCollectionEmailAt: Date | null;
  collectionEmailCount: number;
  isReajuste: boolean;
  contract?: {
    licitacionNo?: string;
    hiringType?: string;
    clientType?: "PUBLIC" | "PRIVATE";
    clientContacts?: ClientContactRow[];
  } | null;
  abonos?: {
    id: string;
    receiptNumber: string | null;
    amount: { toString(): string } | number;
    paidAt: Date | null;
    sortOrder: number;
  }[];
  rebajos?: {
    id: string;
    description: string;
    amount: { toString(): string } | number;
    sortOrder: number;
  }[];
};

function periodFromDocument(row: CxcDocumentoWithRelations): { month: number; year: number } {
  const ref = row.servicePeriodDate ?? row.documentDate ?? new Date();
  return { month: ref.getUTCMonth() + 1, year: ref.getUTCFullYear() };
}

export function serializeCuentaPorCobrar(row: CxcDocumentoWithRelations) {
  const { month, year } = periodFromDocument(row);
  const total = toAmount(row.montoOriginal) ?? toAmount(row.saldo);
  const saldoRaw = toAmount(row.saldo) ?? 0;
  const provisionalPaymentAmount = toAmount(row.provisionalPaymentAmount);
  const due = row.dueDate?.toISOString() ?? null;
  const expectedPaymentRef = row.cxcExpectedPaymentDate?.toISOString() ?? null;
  const uiStatus = row.status === "COBRADO" ? ("COBRADO" as const) : ("FACTURADO" as const);

  const abonos = (row.abonos ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((a) => ({
      id: a.id,
      receiptNumber: a.receiptNumber,
      amount: toAmount(a.amount) ?? 0,
      paidAt: a.paidAt?.toISOString() ?? null,
      sortOrder: a.sortOrder,
    }));

  const rebajos = (row.rebajos ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => ({
      id: r.id,
      description: r.description,
      amount: toAmount(r.amount) ?? 0,
      sortOrder: r.sortOrder,
    }));

  const balance = computeCxcBalance({
    total,
    clientType: row.contract?.clientType ?? null,
    abonos,
    rebajos,
    status: row.status,
    saldo: saldoRaw,
  });

  return {
    id: row.id,
    contractId: row.contractId ?? "",
    facturaMensualId: row.facturaMensualId,
    periodMonth: month,
    periodYear: year,
    clientNameCopied: row.clientName,
    companyCodeCopied: row.companyCode ?? "",
    licitacionNo: row.contract?.licitacionNo,
    documentNumber: row.documentNumber,
    docType: row.docType,
    invoiceNumber: row.invoiceNumber,
    totalCalculated: total,
    expectedIssueDate: row.documentDate?.toISOString() ?? new Date().toISOString(),
    closedAt: row.documentDate?.toISOString() ?? null,
    dueDate: due ?? expectedPaymentRef ?? row.documentDate?.toISOString() ?? new Date().toISOString(),
    status: uiStatus,
    paymentPending: row.status === "PENDIENTE",
    paidAt: row.paidAt?.toISOString() ?? null,
    lastPaymentReviewAt: row.lastPaymentReviewAt?.toISOString() ?? null,
    lastCollectionEmailAt: row.lastCollectionEmailAt?.toISOString() ?? null,
    collectionEmailCount: row.collectionEmailCount ?? 0,
    cxcObservations: row.cxcObservations ?? null,
    cxcExpectedPaymentDate: expectedPaymentRef,
    invoiceReceivedAt: row.invoiceReceivedAt?.toISOString() ?? null,
    provisionalReceiptNumber: row.provisionalReceiptNumber ?? null,
    provisionalPaymentAmount,
    remainingBalance: balance.remainingBalance,
    hasPartialPayment: balance.hasPartialPayment,
    netAmountExpected: balance.netAmountExpected,
    totalRebajos: balance.totalRebajos,
    totalAbonos: balance.totalAbonos,
    adjustedCollectible: balance.adjustedCollectible,
    abonos,
    rebajos,
    billingContact: pickBillingContact(row.contract?.clientContacts ?? []),
    daysUntilDue: due ? daysUntilDue(due) : null,
    dueDateUrgency: due ? dueDateUrgency(due) : ("ok" as const),
    daysUntilExpectedPayment: expectedPaymentRef ? daysUntilDue(expectedPaymentRef) : null,
    isReajuste: row.isReajuste,
    hasContract: Boolean(row.contractId),
  };
}

export const cxcDocumentInclude = {
  contract: {
    select: {
      licitacionNo: true,
      hiringType: true,
      clientType: true,
      clientContacts: {
        orderBy: { sortOrder: "asc" as const },
        select: {
          name: true,
          jobTitle: true,
          phone: true,
          phone2: true,
          email: true,
          isBillingContact: true,
          sortOrder: true,
        },
      },
    },
  },
  abonos: { orderBy: { sortOrder: "asc" as const } },
  rebajos: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.CxcDocumentoInclude;

export function cxcListWhere(input: CuentasPorCobrarListInput): Prisma.CxcDocumentoWhereInput {
  const base: Prisma.CxcDocumentoWhereInput = {
    isReajuste: false,
    docType: { in: ["FC", "FM"] },
    ...(input.company ? { companyCode: input.company } : {}),
    ...(input.client
      ? { clientName: { contains: input.client, mode: "insensitive" } }
      : {}),
    ...(input.licitacion
      ? { contract: { licitacionNo: { contains: input.licitacion, mode: "insensitive" } } }
      : {}),
  };

  const dateFilters = [
    prismaDateRange("documentDate", input.issuedFrom, input.issuedTo),
    prismaDateRange("cxcExpectedPaymentDate", input.expectedPaymentFrom, input.expectedPaymentTo),
    prismaDateRange("invoiceReceivedAt", input.receivedFrom, input.receivedTo),
  ].filter(Boolean) as Prisma.CxcDocumentoWhereInput[];

  if (dateFilters.length > 0) {
    base.AND = dateFilters;
  }

  if (input.filter === "pending") {
    return { ...base, status: "PENDIENTE", saldo: { gt: 0 } };
  }
  if (input.filter === "collected") {
    return { ...base, status: "COBRADO" };
  }
  return { ...base, status: { in: ["PENDIENTE", "COBRADO"] } };
}

type CxcMutationResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS" | "INVALID_AMOUNT"; message: string };

async function loadDocumentForMutation(db: Db, documentoId: string) {
  return db.cxcDocumento.findUnique({
    where: { id: documentoId },
    include: {
      abonos: true,
      rebajos: true,
      contract: { select: { clientType: true } },
    },
  });
}

async function refreshCxcSaldo(db: Db, documentoId: string): Promise<void> {
  const doc = await loadDocumentForMutation(db, documentoId);
  if (!doc) return;

  const total = toAmount(doc.montoOriginal) ?? toAmount(doc.saldo);
  const balance = computeCxcBalance({
    total,
    clientType: doc.contract?.clientType ?? null,
    abonos: doc.abonos.map((a) => ({ amount: toAmount(a.amount) ?? 0 })),
    rebajos: doc.rebajos.map((r) => ({ amount: toAmount(r.amount) ?? 0 })),
    status: doc.status,
    saldo: toAmount(doc.saldo) ?? 0,
  });

  const adjusted = balance.adjustedCollectible ?? 0;
  const recalc = recalculateCxcDocumentSaldo(adjusted, balance.totalAbonos);

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: {
      saldo: recalc.saldo,
      status: recalc.status,
      paidAt: recalc.paidAt,
      provisionalReceiptNumber: null,
      provisionalPaymentAmount: null,
    },
  });
}

export type UpdateCxcObservationsResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS"; message: string };

export async function updateCxcObservations(
  db: Db,
  documentoId: string,
  cxcObservations: string | null
): Promise<UpdateCxcObservationsResult> {
  const doc = await db.cxcDocumento.findUnique({ where: { id: documentoId } });
  if (!doc) {
    return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  }

  if (doc.isReajuste) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Los reajustes no admiten edición de observaciones desde esta pantalla",
    };
  }

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: { cxcObservations },
  });

  return { ok: true };
}

export async function updateCxcGestion(
  db: Db,
  documentoId: string,
  input: {
    invoiceReceivedAt?: string | null;
    cxcExpectedPaymentDate?: string | null;
    provisionalReceiptNumber?: string | null;
    provisionalPaymentAmount?: number | null;
  }
): Promise<CxcMutationResult> {
  const doc = await db.cxcDocumento.findUnique({ where: { id: documentoId } });
  if (!doc) {
    return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  }

  if (doc.isReajuste) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Los reajustes no admiten edición de gestión de cobro",
    };
  }

  const total = toAmount(doc.montoOriginal) ?? toAmount(doc.saldo) ?? 0;
  if (
    input.provisionalPaymentAmount != null &&
    input.provisionalPaymentAmount > 0 &&
    input.provisionalPaymentAmount > total
  ) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: `El abono no puede superar el monto del documento (${total.toFixed(2)})`,
    };
  }

  const data: Prisma.CxcDocumentoUpdateInput = {};

  if (input.invoiceReceivedAt !== undefined) {
    data.invoiceReceivedAt = input.invoiceReceivedAt
      ? parseCalendarDateInput(input.invoiceReceivedAt)
      : null;
  }
  if (input.cxcExpectedPaymentDate !== undefined) {
    data.cxcExpectedPaymentDate = input.cxcExpectedPaymentDate
      ? parseCalendarDateInput(input.cxcExpectedPaymentDate)
      : null;
  }
  if (input.provisionalReceiptNumber !== undefined) {
    data.provisionalReceiptNumber = input.provisionalReceiptNumber;
  }
  if (input.provisionalPaymentAmount !== undefined) {
    data.provisionalPaymentAmount = input.provisionalPaymentAmount;
    if (input.provisionalPaymentAmount != null && input.provisionalPaymentAmount > 0 && total > 0) {
      data.saldo = roundMoney(Math.max(0, total - input.provisionalPaymentAmount));
      if ((data.saldo as number) <= 0) {
        data.status = "COBRADO";
        data.paidAt = new Date();
      } else {
        data.status = "PENDIENTE";
        data.paidAt = null;
      }
    }
  }

  await db.cxcDocumento.update({ where: { id: documentoId }, data });
  return { ok: true };
}

export type PaymentConfirmResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS"; message: string };

export async function confirmFacturaPayment(
  db: Db,
  documentoId: string,
  received: boolean
): Promise<PaymentConfirmResult> {
  const doc = await db.cxcDocumento.findUnique({ where: { id: documentoId } });
  if (!doc) {
    return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  }

  if (doc.isReajuste) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Los reajustes no admiten confirmación de pago desde esta pantalla",
    };
  }

  const now = new Date();
  if (received) {
    await db.cxcDocumento.update({
      where: { id: documentoId },
      data: {
        status: "COBRADO",
        saldo: 0,
        paidAt: now,
        lastPaymentReviewAt: now,
        provisionalReceiptNumber: null,
        provisionalPaymentAmount: null,
      },
    });
  } else {
    await db.cxcDocumento.update({
      where: { id: documentoId },
      data: {
        status: "PENDIENTE",
        paidAt: null,
        lastPaymentReviewAt: now,
      },
    });
  }

  return { ok: true };
}

export async function createCxcAbono(
  db: Db,
  documentoId: string,
  input: { receiptNumber?: string | null; amount: number; paidAt?: string | null },
  createdById: string
): Promise<CxcMutationResult> {
  const doc = await loadDocumentForMutation(db, documentoId);
  if (!doc) return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  if (doc.isReajuste || doc.status === "COBRADO") {
    return { ok: false, code: "INVALID_STATUS", message: "El documento no admite abonos" };
  }

  const total = toAmount(doc.montoOriginal) ?? toAmount(doc.saldo);
  const balance = computeCxcBalance({
    total,
    clientType: doc.contract?.clientType ?? null,
    abonos: doc.abonos.map((a) => ({ amount: toAmount(a.amount) ?? 0 })),
    rebajos: doc.rebajos.map((r) => ({ amount: toAmount(r.amount) ?? 0 })),
    status: doc.status,
    saldo: toAmount(doc.saldo) ?? 0,
  });

  const maxAbono = balance.remainingBalance ?? balance.maxAbono;
  if (input.amount > maxAbono + 0.01) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: `El abono no puede superar el saldo pendiente (${maxAbono.toFixed(2)})`,
    };
  }

  const maxSort = doc.abonos.reduce((m, a) => Math.max(m, a.sortOrder), -1);
  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: {
      abonos: {
        create: {
          receiptNumber: input.receiptNumber ?? null,
          amount: input.amount,
          paidAt: input.paidAt ? parseCalendarDateInput(input.paidAt) : null,
          sortOrder: maxSort + 1,
          createdById,
        },
      },
    },
  });

  await refreshCxcSaldo(db, documentoId);
  return { ok: true };
}

export async function updateCxcAbono(
  db: Db,
  documentoId: string,
  abonoId: string,
  input: { receiptNumber?: string | null; amount?: number; paidAt?: string | null }
): Promise<CxcMutationResult> {
  const doc = await loadDocumentForMutation(db, documentoId);
  if (!doc) return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  const abono = doc.abonos.find((a) => a.id === abonoId);
  if (!abono) return { ok: false, code: "NOT_FOUND", message: "Abono no encontrado" };

  if (input.amount !== undefined) {
    const others = doc.abonos.filter((a) => a.id !== abonoId);
    const total = toAmount(doc.montoOriginal) ?? toAmount(doc.saldo);
    const balance = computeCxcBalance({
      total,
      clientType: doc.contract?.clientType ?? null,
      abonos: others.map((a) => ({ amount: toAmount(a.amount) ?? 0 })),
      rebajos: doc.rebajos.map((r) => ({ amount: toAmount(r.amount) ?? 0 })),
      status: doc.status,
      saldo: toAmount(doc.saldo) ?? 0,
    });
    const maxAbono = (balance.remainingBalance ?? balance.maxAbono) + (toAmount(abono.amount) ?? 0);
    if (input.amount > maxAbono + 0.01) {
      return {
        ok: false,
        code: "INVALID_AMOUNT",
        message: `El abono no puede superar el saldo pendiente (${maxAbono.toFixed(2)})`,
      };
    }
  }

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: {
      abonos: {
        update: {
          where: { id: abonoId },
          data: {
            ...(input.receiptNumber !== undefined ? { receiptNumber: input.receiptNumber } : {}),
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
            ...(input.paidAt !== undefined
              ? { paidAt: input.paidAt ? parseCalendarDateInput(input.paidAt) : null }
              : {}),
          },
        },
      },
    },
  });

  await refreshCxcSaldo(db, documentoId);
  return { ok: true };
}

export async function deleteCxcAbono(
  db: Db,
  documentoId: string,
  abonoId: string
): Promise<CxcMutationResult> {
  const doc = await db.cxcDocumento.findUnique({
    where: { id: documentoId },
    include: { abonos: { where: { id: abonoId } } },
  });
  if (!doc) return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  if (doc.abonos.length === 0) return { ok: false, code: "NOT_FOUND", message: "Abono no encontrado" };

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: { abonos: { delete: { id: abonoId } } },
  });

  await refreshCxcSaldo(db, documentoId);
  return { ok: true };
}

export async function createCxcRebajo(
  db: Db,
  documentoId: string,
  input: { description: string; amount: number },
  createdById: string
): Promise<CxcMutationResult> {
  const doc = await loadDocumentForMutation(db, documentoId);
  if (!doc) return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  if (doc.isReajuste || doc.status === "COBRADO") {
    return { ok: false, code: "INVALID_STATUS", message: "El documento no admite rebajos" };
  }

  const maxSort = doc.rebajos.reduce((m, r) => Math.max(m, r.sortOrder), -1);
  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: {
      rebajos: {
        create: {
          description: input.description,
          amount: input.amount,
          sortOrder: maxSort + 1,
          createdById,
        },
      },
    },
  });

  await refreshCxcSaldo(db, documentoId);
  return { ok: true };
}

export async function updateCxcRebajo(
  db: Db,
  documentoId: string,
  rebajoId: string,
  input: { description?: string; amount?: number }
): Promise<CxcMutationResult> {
  const doc = await db.cxcDocumento.findUnique({
    where: { id: documentoId },
    include: { rebajos: { where: { id: rebajoId } } },
  });
  if (!doc) return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  if (doc.rebajos.length === 0) return { ok: false, code: "NOT_FOUND", message: "Rebajo no encontrado" };

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: {
      rebajos: {
        update: {
          where: { id: rebajoId },
          data: {
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.amount !== undefined ? { amount: input.amount } : {}),
          },
        },
      },
    },
  });

  await refreshCxcSaldo(db, documentoId);
  return { ok: true };
}

export async function deleteCxcRebajo(
  db: Db,
  documentoId: string,
  rebajoId: string
): Promise<CxcMutationResult> {
  const doc = await db.cxcDocumento.findUnique({
    where: { id: documentoId },
    include: { rebajos: { where: { id: rebajoId } } },
  });
  if (!doc) return { ok: false, code: "NOT_FOUND", message: "Documento no encontrado" };
  if (doc.rebajos.length === 0) return { ok: false, code: "NOT_FOUND", message: "Rebajo no encontrado" };

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data: { rebajos: { delete: { id: rebajoId } } },
  });

  await refreshCxcSaldo(db, documentoId);
  return { ok: true };
}
