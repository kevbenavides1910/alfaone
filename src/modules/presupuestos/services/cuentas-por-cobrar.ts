import type { PrismaClient } from "@prisma/client";
import { serializeFacturaMensual } from "@/modules/presupuestos/services/facturacion-cobro";
import { daysUntilDue, dueDateUrgency } from "@/lib/utils/due-date-urgency";

type Db = Pick<PrismaClient, "facturaMensual">;

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

export function serializeCuentaPorCobrar(
  row: Parameters<typeof serializeFacturaMensual>[0] & {
    paidAt?: Date | null;
    lastPaymentReviewAt?: Date | null;
    lastCollectionEmailAt?: Date | null;
    collectionEmailCount?: number;
    cxcObservations?: string | null;
    contract?: {
      licitacionNo?: string;
      hiringType?: string;
      clientContacts?: ClientContactRow[];
    };
  }
) {
  const base = serializeFacturaMensual(row);
  const due = base.dueDate;
  const paidAtRaw =
    row.paidAt ?? (row.status === "COBRADO" ? row.lastPaymentReviewAt ?? row.updatedAt : null);

  return {
    ...base,
    paidAt: paidAtRaw?.toISOString() ?? null,
    lastPaymentReviewAt: row.lastPaymentReviewAt?.toISOString() ?? null,
    lastCollectionEmailAt: row.lastCollectionEmailAt?.toISOString() ?? null,
    collectionEmailCount: row.collectionEmailCount ?? 0,
    cxcObservations: row.cxcObservations ?? null,
    paymentPending: row.status === "FACTURADO",
    billingContact: pickBillingContact(row.contract?.clientContacts ?? []),
    daysUntilDue: daysUntilDue(due),
    dueDateUrgency: dueDateUrgency(due),
  };
}

export type UpdateCxcObservationsResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS"; message: string };

export async function updateCxcObservations(
  db: Db,
  facturaId: string,
  cxcObservations: string | null
): Promise<UpdateCxcObservationsResult> {
  const factura = await db.facturaMensual.findUnique({ where: { id: facturaId } });
  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura no encontrada" };
  }

  if (factura.status !== "FACTURADO" && factura.status !== "COBRADO") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Solo facturas en cuentas por cobrar pueden editar observaciones",
    };
  }

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: { cxcObservations },
  });

  return { ok: true };
}

export type PaymentConfirmResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVALID_STATUS"; message: string };

export async function confirmFacturaPayment(
  db: Db,
  facturaId: string,
  received: boolean
): Promise<PaymentConfirmResult> {
  const factura = await db.facturaMensual.findUnique({ where: { id: facturaId } });
  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura no encontrada" };
  }

  if (factura.status !== "FACTURADO" && factura.status !== "COBRADO") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Solo facturas cerradas (facturadas o cobradas) pueden registrarse en cuentas por cobrar",
    };
  }

  const now = new Date();
  if (received) {
    await db.facturaMensual.update({
      where: { id: facturaId },
      data: {
        status: "COBRADO",
        paidAt: now,
        lastPaymentReviewAt: now,
      },
    });
  } else {
    await db.facturaMensual.update({
      where: { id: facturaId },
      data: {
        status: "FACTURADO",
        paidAt: null,
        lastPaymentReviewAt: now,
      },
    });
  }

  return { ok: true };
}
