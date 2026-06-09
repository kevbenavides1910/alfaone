import type { CxcDocumentoStatus, Prisma, PrismaClient } from "@prisma/client";
import { parseCalendarDateInput } from "@/modules/presupuestos/services/facturacion-cobro";
import { prismaDateRange } from "@/modules/presupuestos/services/list-date-filters";
import { daysUntilDue, dueDateUrgency } from "@/lib/utils/due-date-urgency";
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

type CxcDocumentoWithContract = {
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
    clientContacts?: ClientContactRow[];
  } | null;
};

function periodFromDocument(row: CxcDocumentoWithContract): { month: number; year: number } {
  const ref = row.servicePeriodDate ?? row.documentDate ?? new Date();
  return { month: ref.getUTCMonth() + 1, year: ref.getUTCFullYear() };
}

export function serializeCuentaPorCobrar(row: CxcDocumentoWithContract) {
  const { month, year } = periodFromDocument(row);
  const total = toAmount(row.montoOriginal) ?? toAmount(row.saldo);
  const saldo = toAmount(row.saldo) ?? 0;
  const provisionalPaymentAmount = toAmount(row.provisionalPaymentAmount);
  const remainingBalance = saldo > 0 ? saldo : 0;
  const hasPartialPayment =
    provisionalPaymentAmount != null &&
    provisionalPaymentAmount > 0 &&
    total != null &&
    saldo > 0 &&
    provisionalPaymentAmount < total;
  const due = row.dueDate?.toISOString() ?? null;
  const expectedPaymentRef = row.cxcExpectedPaymentDate?.toISOString() ?? null;
  const uiStatus = row.status === "COBRADO" ? ("COBRADO" as const) : ("FACTURADO" as const);

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
    remainingBalance,
    hasPartialPayment,
    billingContact: pickBillingContact(row.contract?.clientContacts ?? []),
    daysUntilDue: due ? daysUntilDue(due) : null,
    dueDateUrgency: due ? dueDateUrgency(due) : ("ok" as const),
    daysUntilExpectedPayment: expectedPaymentRef ? daysUntilDue(expectedPaymentRef) : null,
    isReajuste: row.isReajuste,
    hasContract: Boolean(row.contractId),
  };
}

const cxcDocumentInclude = {
  contract: {
    select: {
      licitacionNo: true,
      hiringType: true,
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
};

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

export type UpdateCxcGestionResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS" | "INVALID_AMOUNT"; message: string };

export async function updateCxcGestion(
  db: Db,
  documentoId: string,
  input: {
    invoiceReceivedAt?: string | null;
    cxcExpectedPaymentDate?: string | null;
    provisionalReceiptNumber?: string | null;
    provisionalPaymentAmount?: number | null;
  }
): Promise<UpdateCxcGestionResult> {
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

  const data: {
    invoiceReceivedAt?: Date | null;
    cxcExpectedPaymentDate?: Date | null;
    provisionalReceiptNumber?: string | null;
    provisionalPaymentAmount?: number | null;
    saldo?: number;
    status?: CxcDocumentoStatus;
    paidAt?: Date | null;
  } = {};

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
      if (data.saldo <= 0) {
        data.status = "COBRADO";
        data.paidAt = new Date();
      } else {
        data.status = "PENDIENTE";
        data.paidAt = null;
      }
    }
  }

  await db.cxcDocumento.update({
    where: { id: documentoId },
    data,
  });

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

export { cxcDocumentInclude };
