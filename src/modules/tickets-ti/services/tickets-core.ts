import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { allocateTicketNumber } from "./ticket-number";
import { writeTicketAudit } from "./ticket-audit";
import { writeTicketHistory } from "./ticket-history";
import { notifyTicketUsers } from "./ticket-notifications";
import { createTicketSla } from "./ticket-sla";
import { serializeTicket, ticketInclude } from "./ticket-serialize";
import { ticketsVisibilityWhere, canViewTicket } from "./ticket-access";
import type { ticketCreateSchema } from "../validations/ticket.schema";
import type { z } from "zod";

type CreateInput = z.infer<typeof ticketCreateSchema>;

async function findCatalogIds(input: CreateInput) {
  const [category, priority, type, status, technicianRow, statusAsignado] = await Promise.all([
    prisma.ticketCategory.findFirst({ where: { code: input.categoryCode, isActive: true } }),
    prisma.ticketPriority.findFirst({ where: { code: input.priorityCode, isActive: true } }),
    prisma.ticketType.findFirst({ where: { code: input.typeCode, isActive: true } }),
    prisma.ticketStatus.findFirst({ where: { code: "NUEVO", isActive: true } }),
    input.technicianId
      ? prisma.ticketTechnician.findFirst({
          where: { userId: input.technicianId, isActive: true },
          include: { user: { select: { id: true, name: true } } },
        })
      : Promise.resolve(null),
    prisma.ticketStatus.findFirst({ where: { code: "ASIGNADO", isActive: true } }),
  ]);
  if (!category) throw new Error("Categoría no válida");
  if (!priority) throw new Error("Prioridad no válida");
  if (!type) throw new Error("Tipo no válido");
  if (!status) throw new Error("Estado inicial no configurado");
  if (input.technicianId && !technicianRow) throw new Error("Técnico no válido");
  const initialStatus = technicianRow && statusAsignado ? statusAsignado : status;
  return { category, priority, type, status: initialStatus, technician: technicianRow?.user ?? null };
}

export async function createTicket(
  session: Session,
  userId: string,
  input: CreateInput
) {
  const { category, priority, type, status, technician } = await findCatalogIds(input);
  const now = new Date();

  const ticket = await prisma.$transaction(async (tx) => {
    const ticketNumber = await allocateTicketNumber(tx);
    const created = await tx.ticket.create({
      data: {
        ticketNumber,
        title: input.title,
        description: input.description,
        categoryDetail: input.categoryDetail?.trim() || null,
        categoryId: category.id,
        priorityId: priority.id,
        statusId: status.id,
        typeId: type.id,
        departmentId: null,
        requesterId: userId,
        assignedToId: technician?.id ?? null,
        assignedAt: technician ? now : null,
        lastActivityAt: now,
      },
      include: ticketInclude,
    });

    await createTicketSla(tx, created.id, priority.id, priority.slaMinutes);
    await writeTicketHistory(tx, {
      ticketId: created.id,
      changedById: userId,
      field: "status",
      oldValue: null,
      newValue: status.code,
      reason: technician ? "Ticket creado y asignado" : "Ticket creado",
    });
    if (technician) {
      await writeTicketHistory(tx, {
        ticketId: created.id,
        changedById: userId,
        field: "assignedTo",
        oldValue: null,
        newValue: technician.name,
      });
    }
    await writeTicketAudit(tx, {
      ticketId: created.id,
      userId,
      action: "ticket.create",
      tableName: "tickets",
      recordId: created.id,
      newValues: { ticketNumber, title: input.title },
    });
    await notifyTicketUsers(tx, {
      ticketId: created.id,
      userIds: [userId, technician?.id].filter(Boolean) as string[],
      title: "Ticket creado",
      message: `${ticketNumber}: ${input.title}`,
      type: "ticket.created",
    });

    return created;
  });

  return serializeTicket(ticket);
}

export async function listTickets(
  session: Session,
  userId: string,
  filters: {
    q?: string;
    statusCode?: string;
    priorityCode?: string;
    assignedToMe?: boolean;
    ticketNumber?: string;
    title?: string;
    requester?: string;
    technician?: string;
    page?: number;
    pageSize?: number;
    limit?: number;
  }
) {
  const where: Prisma.TicketWhereInput = {
    deletedAt: null,
    ...ticketsVisibilityWhere(session, userId),
  };

  if (filters.statusCode) {
    where.status = { code: filters.statusCode };
  }
  if (filters.priorityCode) {
    where.priority = { code: filters.priorityCode };
  }
  if (filters.assignedToMe) {
    where.assignedToId = userId;
  }
  if (filters.ticketNumber?.trim()) {
    where.ticketNumber = { contains: filters.ticketNumber.trim(), mode: "insensitive" };
  }
  if (filters.title?.trim()) {
    where.title = { contains: filters.title.trim(), mode: "insensitive" };
  }
  if (filters.requester?.trim()) {
    where.requester = { name: { contains: filters.requester.trim(), mode: "insensitive" } };
  }
  if (filters.technician?.trim()) {
    where.assignedTo = { name: { contains: filters.technician.trim(), mode: "insensitive" } };
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { ticketNumber: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { requester: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? filters.limit ?? 20;
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      include: ticketInclude,
      orderBy: { openedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map(serializeTicket),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getTicketDetail(
  session: Session,
  userId: string,
  ticketId: string,
  includeInternal: boolean
) {
  const row = await prisma.ticket.findFirst({
    where: { id: ticketId, deletedAt: null },
    include: {
      ...ticketInclude,
      closeReason: true,
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          attachments: true,
        },
      },
      attachments: { where: { commentId: null }, orderBy: { createdAt: "desc" } },
      histories: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { id: true, name: true } } },
      },
      audits: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      },
      workLogs: {
        orderBy: { createdAt: "desc" },
        include: { technician: { select: { id: true, name: true } } },
      },
    },
  });
  if (!row) return null;
  if (!canViewTicket(session, userId, row)) return null;

  const comments = row.comments.filter((c) => includeInternal || !c.isInternal);

  return {
    ...serializeTicket(row),
    closeReason: row.closeReason?.name ?? null,
    comments: comments.map((c) => ({
      id: c.id,
      comment: c.comment,
      isInternal: c.isInternal,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      attachments: c.attachments.map((a) => ({
        id: a.id,
        originalName: a.originalName,
        fileSize: a.fileSize,
        downloadUrl: `/api/tickets-ti/${row.id}/attachments/${a.id}`,
      })),
    })),
    attachments: row.attachments.map((a) => ({
      id: a.id,
      originalName: a.originalName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      createdAt: a.createdAt.toISOString(),
      downloadUrl: `/api/tickets-ti/${row.id}/attachments/${a.id}`,
    })),
    timeline: row.histories.map((h) => ({
      id: h.id,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
      changedBy: h.changedBy,
    })),
    audits: includeInternal
      ? row.audits.map((a) => ({
          id: a.id,
          action: a.action,
          createdAt: a.createdAt.toISOString(),
          user: a.user,
        }))
      : [],
    workLogs: row.workLogs.map((w) => ({
      id: w.id,
      minutes: w.minutes,
      description: w.description,
      createdAt: w.createdAt.toISOString(),
      technician: w.technician,
    })),
  };
}
