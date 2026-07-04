import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import { hasPermission } from "@/lib/permissions/check";
import type { SessionWithPermissions } from "@/lib/permissions/check";

export function ticketsVisibilityWhere(
  session: Session | null,
  userId: string
): Prisma.TicketWhereInput {
  const s = session as SessionWithPermissions | null;
  if (s?.user?.roleCode === "ADMIN") return {};
  if (hasPermission(session, "ticketsTi.tickets", "admin")) return {};
  if (hasPermission(session, "ticketsTi.centro", "view")) return {};
  return { requesterId: userId };
}

export function canViewTicket(
  session: Session | null,
  userId: string,
  ticket: { requesterId: string; assignedToId: string | null }
): boolean {
  const s = session as SessionWithPermissions | null;
  if (s?.user?.roleCode === "ADMIN") return true;
  if (hasPermission(session, "ticketsTi.tickets", "admin")) return true;
  if (hasPermission(session, "ticketsTi.centro", "view")) return true;
  return ticket.requesterId === userId;
}

/** Operaciones de mesa de ayuda (asignar, estados, notas internas). */
export function canManageTicket(session: Session | null): boolean {
  return hasPermission(session, "ticketsTi.centro", "edit");
}

export function canViewInternalComments(session: Session | null): boolean {
  return canManageTicket(session);
}

export function canDownloadTicketAttachment(
  session: Session | null,
  userId: string,
  ticket: { requesterId: string; assignedToId: string | null }
): boolean {
  if (!hasPermission(session, "ticketsTi.attachments", "view")) return false;
  return canViewTicket(session, userId, ticket);
}

export function canUploadTicketAttachment(
  session: Session | null,
  userId: string,
  ticket: { requesterId: string; assignedToId: string | null }
): boolean {
  if (!hasPermission(session, "ticketsTi.tickets", "edit")) return false;
  return canViewTicket(session, userId, ticket);
}
