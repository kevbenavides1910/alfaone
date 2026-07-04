import type { Session } from "next-auth";
import { prisma } from "@/modules/core/db/prisma";
import { assertTicketStatusTransition, type TicketStatusCode } from "../business/status-transitions";
import { writeTicketAudit } from "./ticket-audit";
import { writeTicketHistory } from "./ticket-history";
import { notifyTicketUsers } from "./ticket-notifications";
import { finishSla, syncSlaForStatus } from "./ticket-sla";
import { serializeTicket, ticketInclude } from "./ticket-serialize";
import { canManageTicket, canViewTicket } from "./ticket-access";

export async function assignTicket(
  session: Session,
  userId: string,
  ticketId: string,
  assignedToId: string | null
) {
  if (!canManageTicket(session)) throw new Error("Sin permiso para asignar");
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, deletedAt: null },
    include: { status: true, assignedTo: true },
  });
  if (!ticket) throw new Error("Ticket no encontrado");
  if (!canViewTicket(session, userId, ticket)) throw new Error("Sin acceso");

  let assignee = null;
  if (assignedToId) {
    assignee = await prisma.user.findFirst({ where: { id: assignedToId, isActive: true } });
    if (!assignee) throw new Error("Usuario no válido");
  }

  const statusAsignado = await prisma.ticketStatus.findFirst({ where: { code: "ASIGNADO" } });
  const statusEnProceso = await prisma.ticketStatus.findFirst({ where: { code: "EN_PROCESO" } });
  const nextStatus =
    ticket.status.code === "NUEVO" && assignee && statusAsignado
      ? statusAsignado
      : assignee && statusEnProceso && ["ASIGNADO", "REABIERTO"].includes(ticket.status.code)
        ? statusEnProceso
        : null;

  if (nextStatus) {
    assertTicketStatusTransition(ticket.status.code as TicketStatusCode, nextStatus.code as TicketStatusCode);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        assignedToId: assignee?.id ?? null,
        assignedAt: assignee ? new Date() : ticket.assignedAt,
        statusId: nextStatus?.id ?? ticket.statusId,
        lastActivityAt: new Date(),
      },
      include: ticketInclude,
    });

    await writeTicketHistory(tx, {
      ticketId,
      changedById: userId,
      field: "assignedTo",
      oldValue: ticket.assignedTo?.name ?? null,
      newValue: assignee?.name ?? null,
    });
    if (nextStatus) {
      await writeTicketHistory(tx, {
        ticketId,
        changedById: userId,
        field: "status",
        oldValue: ticket.status.code,
        newValue: nextStatus.code,
      });
    }
    await writeTicketAudit(tx, {
      ticketId,
      userId,
      action: "ticket.assign",
      newValues: { assignedToId: assignee?.id ?? null },
    });
    const notifyIds = [ticket.requesterId, assignee?.id].filter(Boolean) as string[];
    await notifyTicketUsers(tx, {
      ticketId,
      userIds: notifyIds,
      title: "Ticket asignado",
      message: `${row.ticketNumber} asignado a ${assignee?.name ?? "—"}`,
      type: "ticket.assigned",
    });
    return row;
  });

  return serializeTicket(updated);
}

export async function changeTicketStatus(
  session: Session,
  userId: string,
  ticketId: string,
  input: {
    statusCode: string;
    reason?: string;
    solution?: string;
    workMinutes?: number;
  }
) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, deletedAt: null },
    include: { status: true, requester: true, assignedTo: true },
  });
  if (!ticket) throw new Error("Ticket no encontrado");
  if (!canViewTicket(session, userId, ticket)) throw new Error("Sin acceso");

  const isRequester = ticket.requesterId === userId;
  const isManager = canManageTicket(session);

  const terminalUserActions = ["VERIFICACION_USUARIO"];
  if (terminalUserActions.includes(input.statusCode) && !isRequester && !isManager) {
    throw new Error("Sin permiso para esta acción");
  }
  if (!isManager && !isRequester) throw new Error("Sin permiso para cambiar estado");

  assertTicketStatusTransition(
    ticket.status.code as TicketStatusCode,
    input.statusCode as TicketStatusCode
  );

  const newStatus = await prisma.ticketStatus.findFirst({
    where: { code: input.statusCode, isActive: true },
  });
  if (!newStatus) throw new Error("Estado no válido");

  if (input.statusCode === "CERRADO") {
    if (!ticket.assignedToId) throw new Error("Debe existir técnico asignado");
    if (!ticket.resolvedAt && ticket.status.code !== "RESUELTO") {
      throw new Error("Debe resolverse antes de cerrar");
    }
  }

  if (input.statusCode === "RESUELTO" && isManager) {
    if (!input.solution?.trim()) throw new Error("Indique la solución");
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        statusId: newStatus.id,
        solution: input.solution?.trim() ?? ticket.solution,
        totalWorkMinutes:
          input.workMinutes != null
            ? ticket.totalWorkMinutes + input.workMinutes
            : ticket.totalWorkMinutes,
        resolvedAt:
          input.statusCode === "RESUELTO" || input.statusCode === "VERIFICACION_USUARIO"
            ? ticket.resolvedAt ?? now
            : ticket.resolvedAt,
        closedAt: input.statusCode === "CERRADO" ? now : ticket.closedAt,
        lastActivityAt: now,
      },
      include: ticketInclude,
    });

    await syncSlaForStatus(tx, ticketId, newStatus.pausesSla);
    if (["CERRADO", "CANCELADO", "RECHAZADO"].includes(input.statusCode)) {
      const slaStatus = input.statusCode === "CERRADO" ? "MET" : "CANCELLED";
      await finishSla(tx, ticketId, slaStatus as "MET" | "CANCELLED");
    }

    await writeTicketHistory(tx, {
      ticketId,
      changedById: userId,
      field: "status",
      oldValue: ticket.status.code,
      newValue: newStatus.code,
      reason: input.reason ?? null,
    });
    await writeTicketAudit(tx, {
      ticketId,
      userId,
      action: "ticket.status",
      newValues: { status: newStatus.code, reason: input.reason },
    });

    const notifyIds = [ticket.requesterId, ticket.assignedToId].filter(Boolean) as string[];
    await notifyTicketUsers(tx, {
      ticketId,
      userIds: notifyIds,
      title: "Estado actualizado",
      message: `${row.ticketNumber}: ${ticket.status.name} → ${newStatus.name}`,
      type: "ticket.status",
    });

    return row;
  });

  return serializeTicket(updated);
}

export async function addTicketComment(
  session: Session,
  userId: string,
  ticketId: string,
  input: { comment: string; isInternal?: boolean }
) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, deletedAt: null } });
  if (!ticket) throw new Error("Ticket no encontrado");
  if (!canViewTicket(session, userId, ticket)) throw new Error("Sin acceso");
  if (input.isInternal && !canManageTicket(session)) {
    throw new Error("Sin permiso para notas internas");
  }

  const isRequester = ticket.requesterId === userId;
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketComment.create({
      data: {
        ticketId,
        userId,
        comment: input.comment,
        isInternal: input.isInternal ?? false,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    let nextStatusId: string | undefined;
    if (isRequester && !input.isInternal) {
      const waiting = await tx.ticketStatus.findFirst({ where: { code: "ESPERANDO_INFORMACION" } });
      const current = await tx.ticketStatus.findUnique({ where: { id: ticket.statusId } });
      const enProceso = await tx.ticketStatus.findFirst({ where: { code: "EN_PROCESO" } });
      if (current?.code === "ESPERANDO_INFORMACION" && enProceso) {
        nextStatusId = enProceso.id;
      }
    } else if (canManageTicket(session) && !input.isInternal) {
      const current = await tx.ticketStatus.findUnique({ where: { id: ticket.statusId } });
      const waiting = await tx.ticketStatus.findFirst({ where: { code: "ESPERANDO_INFORMACION" } });
      if (current && waiting && ["EN_PROCESO", "ASIGNADO"].includes(current.code)) {
        nextStatusId = waiting.id;
      }
    }

    if (nextStatusId) {
      const newSt = await tx.ticketStatus.findUnique({ where: { id: nextStatusId } });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { statusId: nextStatusId, lastActivityAt: new Date() },
      });
      if (newSt) await syncSlaForStatus(tx, ticketId, newSt.pausesSla);
      await writeTicketHistory(tx, {
        ticketId,
        changedById: userId,
        field: "status",
        oldValue: null,
        newValue: newSt?.code ?? null,
        reason: "Actualizado por comentario",
      });
    } else {
      await tx.ticket.update({
        where: { id: ticketId },
        data: { lastActivityAt: new Date() },
      });
    }

    await writeTicketHistory(tx, {
      ticketId,
      changedById: userId,
      field: "comment",
      newValue: input.isInternal ? "[interno]" : input.comment.slice(0, 200),
    });
    await writeTicketAudit(tx, {
      ticketId,
      userId,
      action: "ticket.comment",
      newValues: { isInternal: input.isInternal ?? false },
    });

    const assignee = ticket.assignedToId;
    const notifyIds = isRequester
      ? ([assignee].filter(Boolean) as string[])
      : ([ticket.requesterId].filter(Boolean) as string[]);
    await notifyTicketUsers(tx, {
      ticketId,
      userIds: notifyIds,
      title: input.isInternal ? "Nota interna" : "Nuevo comentario",
      message: input.comment.slice(0, 120),
      type: "ticket.comment",
    });

    return created;
  });

  return {
    id: comment.id,
    comment: comment.comment,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt.toISOString(),
    user: comment.user,
    attachments: [],
  };
}
