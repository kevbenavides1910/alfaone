import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  expandPaymentCompanyFilter,
  paymentCompanyWhere,
  type PaymentCompanyFilter,
} from "@/modules/pagos/services/payment-company-filter";
import { legalDocumentTypeLabel } from "../business/catalog";
import { daysOfMonth, monthBounds, parseIsoDay, toIsoDay } from "../business/dates";
import type { LegalCalendarMonth, LegalDocumentDto, LegalReminderDto } from "../business/dto";
import {
  computeSendOn,
  formatReminderList,
  reminderKey,
  sentAtAfterReschedule,
  type ReminderOffset,
} from "../business/reminders";
import type { LegalDocumentBody } from "../validations/document.schema";
import { writeLegalDocumentLogs, type ChangeEntry } from "./changelog";
import { LegalDocumentError } from "./errors";
import { assertResponsibleUser } from "./responsibles";
import { deleteStoredLegalAttachments } from "./uploads";

const includeDocument = {
  responsibleUser: { select: { id: true, name: true, email: true } },
  reminders: { orderBy: [{ offsetUnit: "asc" as const }, { offsetValue: "asc" as const }] },
};

type DocumentRow = Prisma.LegalDocumentGetPayload<{ include: typeof includeDocument }>;

function money(value: Prisma.Decimal | number): number {
  return Math.round(Number(value.toString()) * 100) / 100;
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function reminderDtos(rows: DocumentRow["reminders"]): LegalReminderDto[] {
  return rows.map((row) => ({
    id: row.id,
    offsetValue: row.offsetValue,
    offsetUnit: row.offsetUnit,
    sendOn: toIsoDay(row.sendOn),
    sentAt: row.sentAt?.toISOString() ?? null,
    lastError: row.lastError,
  }));
}

export function serializeLegalDocument(row: DocumentRow): LegalDocumentDto {
  return {
    id: row.id,
    type: row.type,
    typeLabel: legalDocumentTypeLabel(row.type, row.otherTypeLabel),
    otherTypeLabel: row.otherTypeLabel,
    description: row.description,
    amount: money(row.amount),
    dueDate: toIsoDay(row.dueDate),
    company: row.company,
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    paid: row.paid,
    paidAt: row.paidAt?.toISOString() ?? null,
    responsibleUserId: row.responsibleUserId,
    responsibleName: row.responsibleUser.name,
    responsibleEmail: row.responsibleUser.email,
    reminders: reminderDtos(row.reminders),
  };
}

function totalsOf(documents: LegalDocumentDto[]): LegalCalendarMonth["totals"] {
  const total = money(documents.reduce((sum, doc) => sum + doc.amount, 0));
  const paid = money(documents.filter((doc) => doc.paid).reduce((sum, doc) => sum + doc.amount, 0));
  return { total, paid, pending: money(total - paid) };
}

async function companyWhere(filter?: PaymentCompanyFilter) {
  const codes = await expandPaymentCompanyFilter(filter);
  return paymentCompanyWhere(codes);
}

export async function getLegalCalendarMonth(
  month: string,
  companyFilter?: PaymentCompanyFilter,
): Promise<LegalCalendarMonth> {
  const bounds = monthBounds(month);
  if (!bounds) throw new LegalDocumentError("Formato de mes inválido (esperado YYYY-MM)", "BAD_REQUEST");
  const rows = await prisma.legalDocument.findMany({
    where: { dueDate: { gte: bounds.from, lt: bounds.to }, ...(await companyWhere(companyFilter)) },
    include: includeDocument,
    orderBy: [{ dueDate: "asc" }, { description: "asc" }],
  });
  const documents = rows.map(serializeLegalDocument);
  const byDay = new Map<string, LegalDocumentDto[]>();
  for (const doc of documents) {
    const list = byDay.get(doc.dueDate) ?? [];
    list.push(doc);
    byDay.set(doc.dueDate, list);
  }
  const days = daysOfMonth(month).map((date) => {
    const list = byDay.get(date) ?? [];
    const dayTotals = totalsOf(list);
    return { date, documents: list, total: dayTotals.total, totalPaid: dayTotals.paid };
  });
  return { month, days, documents, totals: totalsOf(documents) };
}

export async function getLegalDocument(id: string): Promise<LegalDocumentDto> {
  const row = await prisma.legalDocument.findUnique({ where: { id }, include: includeDocument });
  if (!row) throw new LegalDocumentError("Documento no encontrado", "NOT_FOUND");
  return serializeLegalDocument(row);
}

export async function searchLegalDocuments(opts: {
  q?: string;
  company?: PaymentCompanyFilter;
  type?: string;
  paid?: boolean;
  month?: string;
  take?: number;
}): Promise<LegalDocumentDto[]> {
  const take = Math.min(Math.max(opts.take ?? 40, 1), 100);
  const q = opts.q?.trim();
  const bounds = opts.month ? monthBounds(opts.month) : null;
  if (opts.month && !bounds) {
    throw new LegalDocumentError("Formato de mes inválido (esperado YYYY-MM)", "BAD_REQUEST");
  }
  const rows = await prisma.legalDocument.findMany({
    where: {
      ...(await companyWhere(opts.company)),
      ...(bounds ? { dueDate: { gte: bounds.from, lt: bounds.to } } : {}),
      ...(opts.type ? { type: opts.type as DocumentRow["type"] } : {}),
      ...(typeof opts.paid === "boolean" ? { paid: opts.paid } : {}),
      ...(q
        ? {
            OR: [
              { description: { contains: q, mode: "insensitive" } },
              { referenceNumber: { contains: q, mode: "insensitive" } },
              { otherTypeLabel: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: includeDocument,
    orderBy: [{ dueDate: "asc" }, { description: "asc" }],
    take,
  });
  return rows.map(serializeLegalDocument);
}

function documentData(body: LegalDocumentBody, userId: string, responsibleName: string) {
  const dueDate = parseIsoDay(body.dueDate);
  if (!dueDate) throw new LegalDocumentError("La fecha de pago es inválida", "BAD_REQUEST");
  return {
    dueDate,
    data: {
      type: body.type,
      otherTypeLabel: body.type === "OTRO" ? clean(body.otherTypeLabel) : null,
      description: body.description.trim(),
      amount: new Prisma.Decimal(body.amount.toFixed(2)),
      dueDate,
      company: clean(body.company),
      referenceNumber: clean(body.referenceNumber),
      notes: clean(body.notes),
      responsibleUserId: body.responsibleUserId,
      updatedById: userId,
    },
    responsibleName,
    reminders: body.reminders,
  };
}

async function syncReminders(
  tx: Prisma.TransactionClient,
  documentId: string,
  dueDate: Date,
  next: ReminderOffset[],
  previous: { id: string; offsetValue: number; offsetUnit: ReminderOffset["offsetUnit"]; sendOn: Date; sentAt: Date | null; lastError: string | null }[],
) {
  const prevByKey = new Map(previous.map((row) => [reminderKey(row), row]));
  const nextKeys = new Set(next.map((row) => reminderKey(row)));
  for (const row of previous) {
    if (!nextKeys.has(reminderKey(row))) {
      await tx.legalDocumentReminder.delete({ where: { id: row.id } });
    }
  }
  for (const item of next) {
    const sendOn = computeSendOn(dueDate, item.offsetValue, item.offsetUnit);
    const prev = prevByKey.get(reminderKey(item));
    if (!prev) {
      await tx.legalDocumentReminder.create({
        data: {
          legalDocumentId: documentId,
          offsetValue: item.offsetValue,
          offsetUnit: item.offsetUnit,
          sendOn,
        },
      });
      continue;
    }
    const sentAt = sentAtAfterReschedule(prev, sendOn);
    if (toIsoDay(prev.sendOn) === toIsoDay(sendOn) && sentAt === prev.sentAt) continue;
    await tx.legalDocumentReminder.update({
      where: { id: prev.id },
      data: { sendOn, sentAt, lastError: sentAt ? prev.lastError : null },
    });
  }
}

export async function createLegalDocument(body: LegalDocumentBody, userId: string): Promise<LegalDocumentDto> {
  const responsible = await assertResponsibleUser(body.responsibleUserId);
  const parsed = documentData(body, userId, responsible.name);
  const created = await prisma.$transaction(async (tx) => {
    const doc = await tx.legalDocument.create({
      data: { ...parsed.data, createdById: userId },
    });
    await syncReminders(tx, doc.id, parsed.dueDate, parsed.reminders, []);
    await writeLegalDocumentLogs(tx, doc.id, userId, [
      { field: "created", previousValue: null, newValue: parsed.data.description },
    ]);
    return tx.legalDocument.findUniqueOrThrow({ where: { id: doc.id }, include: includeDocument });
  });
  return serializeLegalDocument(created);
}

function displayPaid(paid: boolean): string {
  return paid ? "Pagado" : "Pendiente";
}

function changeEntries(current: DocumentRow, body: LegalDocumentBody, responsibleName: string): ChangeEntry[] {
  const nextType = legalDocumentTypeLabel(body.type, body.type === "OTRO" ? clean(body.otherTypeLabel) : null);
  const prevType = legalDocumentTypeLabel(current.type, current.otherTypeLabel);
  const entries: ChangeEntry[] = [
    { field: "type", previousValue: prevType, newValue: nextType },
    { field: "description", previousValue: current.description, newValue: body.description.trim() },
    { field: "amount", previousValue: money(current.amount).toFixed(2), newValue: body.amount.toFixed(2) },
    { field: "dueDate", previousValue: toIsoDay(current.dueDate), newValue: body.dueDate },
    { field: "company", previousValue: current.company, newValue: clean(body.company) },
    { field: "referenceNumber", previousValue: current.referenceNumber, newValue: clean(body.referenceNumber) },
    { field: "notes", previousValue: current.notes, newValue: clean(body.notes) },
    {
      field: "responsibleUserId",
      previousValue: current.responsibleUser.name,
      newValue: responsibleName,
    },
    {
      field: "reminders",
      previousValue: formatReminderList(current.reminders),
      newValue: formatReminderList(body.reminders),
    },
  ];
  return entries;
}

export async function updateLegalDocument(
  id: string,
  body: LegalDocumentBody,
  userId: string,
): Promise<LegalDocumentDto> {
  const current = await prisma.legalDocument.findUnique({ where: { id }, include: includeDocument });
  if (!current) throw new LegalDocumentError("Documento no encontrado", "NOT_FOUND");
  const responsible = await assertResponsibleUser(body.responsibleUserId);
  const parsed = documentData(body, userId, responsible.name);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.legalDocument.update({ where: { id }, data: parsed.data });
    await syncReminders(tx, id, parsed.dueDate, parsed.reminders, current.reminders);
    await writeLegalDocumentLogs(tx, id, userId, changeEntries(current, body, responsible.name));
    return tx.legalDocument.findUniqueOrThrow({ where: { id }, include: includeDocument });
  });
  return serializeLegalDocument(updated);
}

export async function markLegalDocumentPaid(id: string, paid: boolean, userId: string): Promise<LegalDocumentDto> {
  const current = await prisma.legalDocument.findUnique({ where: { id }, include: includeDocument });
  if (!current) throw new LegalDocumentError("Documento no encontrado", "NOT_FOUND");
  if (current.paid === paid) return serializeLegalDocument(current);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.legalDocument.update({
      where: { id },
      data: { paid, paidAt: paid ? new Date() : null, updatedById: userId },
    });
    await writeLegalDocumentLogs(tx, id, userId, [
      { field: "paid", previousValue: displayPaid(current.paid), newValue: displayPaid(paid) },
    ]);
    return tx.legalDocument.findUniqueOrThrow({ where: { id }, include: includeDocument });
  });
  return serializeLegalDocument(updated);
}

export async function deleteLegalDocument(id: string) {
  const current = await prisma.legalDocument.findUnique({
    where: { id },
    include: { attachments: { select: { storagePath: true } } },
  });
  if (!current) throw new LegalDocumentError("Documento no encontrado", "NOT_FOUND");
  await prisma.legalDocument.delete({ where: { id } });
  await deleteStoredLegalAttachments(current.attachments);
}

export async function listLegalDocumentReminders(opts?: {
  company?: PaymentCompanyFilter;
  onlyUnsent?: boolean;
  dueThrough?: Date;
  take?: number;
}) {
  const take = Math.min(Math.max(opts?.take ?? 40, 1), 100);
  const rows = await prisma.legalDocumentReminder.findMany({
    where: {
      ...(opts?.onlyUnsent === false ? {} : { sentAt: null }),
      ...(opts?.dueThrough ? { sendOn: { lte: opts.dueThrough } } : {}),
      legalDocument: { paid: false, ...(await companyWhere(opts?.company)) },
    },
    include: {
      legalDocument: { include: includeDocument },
    },
    orderBy: [{ sendOn: "asc" }, { createdAt: "asc" }],
    take,
  });
  return rows.map((row) => ({
    id: row.id,
    sendOn: toIsoDay(row.sendOn),
    sentAt: row.sentAt?.toISOString() ?? null,
    lastError: row.lastError,
    offsetValue: row.offsetValue,
    offsetUnit: row.offsetUnit,
    document: serializeLegalDocument(row.legalDocument),
  }));
}
