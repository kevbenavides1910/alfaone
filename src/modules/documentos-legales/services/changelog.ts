import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  expandPaymentCompanyFilter,
  paymentCompanyWhere,
} from "@/modules/pagos/services/payment-company-filter";
import { monthBounds } from "../business/dates";
import type { LegalChangeLogDto } from "../business/dto";

const FIELD_LABELS: Record<string, string> = {
  created: "Alta",
  type: "Tipo",
  otherTypeLabel: "Etiqueta",
  policyPercentage: "Porcentaje",
  insuredAmountLabel: "Monto asegurado",
  policyKind: "Tipo de póliza",
  tenderNumber: "Número de licitación",
  guaranteeEntity: "Banco o Entidad",
  guaranteeNumber: "Número de Garantía",
  cedulaCondition: "Condición",
  description: "Descripción",
  amount: "Monto",
  dueDate: "Vigencia",
  company: "Empresa",
  referenceNumber: "Referencia",
  notes: "Notas",
  paid: "Estado",
  responsibleUserId: "Responsable",
  reminders: "Recordatorios",
};

export type ChangeEntry = {
  field: string;
  previousValue: string | null;
  newValue: string | null;
};

export async function writeLegalDocumentLogs(
  tx: Prisma.TransactionClient,
  legalDocumentId: string,
  userId: string,
  entries: ChangeEntry[],
) {
  const rows = entries.filter((entry) => (entry.previousValue ?? "") !== (entry.newValue ?? ""));
  if (!rows.length) return;
  await tx.legalDocumentChangeLog.createMany({
    data: rows.map((entry) => ({
      legalDocumentId,
      field: entry.field,
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      changedById: userId,
    })),
  });
}

export function serializeLegalChangeLog(row: {
  id: string;
  legalDocumentId: string;
  field: string;
  previousValue: string | null;
  newValue: string | null;
  createdAt: Date;
  changedBy: { name: string } | null;
  legalDocument?: { description: string; company: string | null } | null;
}): LegalChangeLogDto {
  return {
    id: row.id,
    legalDocumentId: row.legalDocumentId,
    documentDescription: row.legalDocument?.description ?? null,
    documentCompany: row.legalDocument?.company ?? null,
    field: row.field,
    fieldLabel: FIELD_LABELS[row.field] ?? row.field,
    previousValue: row.previousValue,
    newValue: row.newValue,
    changedByName: row.changedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLegalDocumentChangeLogs(opts?: {
  month?: string;
  companies?: string[];
  documentId?: string;
  take?: number;
}): Promise<LegalChangeLogDto[]> {
  const take = Math.min(Math.max(opts?.take ?? 200, 1), 500);
  const companyCodes = await expandPaymentCompanyFilter(opts?.companies);
  const bounds = opts?.month ? monthBounds(opts.month) : null;
  const rows = await prisma.legalDocumentChangeLog.findMany({
    where: {
      ...(opts?.documentId ? { legalDocumentId: opts.documentId } : {}),
      legalDocument: {
        ...(bounds ? { dueDate: { gte: bounds.from, lt: bounds.to } } : {}),
        ...paymentCompanyWhere(companyCodes),
      },
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      changedBy: { select: { name: true } },
      legalDocument: { select: { description: true, company: true } },
    },
  });
  return rows.map(serializeLegalChangeLog);
}
