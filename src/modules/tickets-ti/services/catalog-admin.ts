import "server-only";
import { prisma } from "@/modules/core/db/prisma";

export type CatalogKind =
  | "category"
  | "priority"
  | "status"
  | "type"
  | "closeReason";

export async function updateCatalogItem(
  kind: CatalogKind,
  id: string,
  input: {
    name?: string;
    sortOrder?: number;
    isActive?: boolean;
    slaMinutes?: number;
    colorToken?: string;
    isTerminal?: boolean;
    pausesSla?: boolean;
  }
) {
  const data: Record<string, unknown> = {};
  if (input.name != null) data.name = input.name.trim();
  if (input.sortOrder != null) data.sortOrder = input.sortOrder;
  if (input.isActive != null) data.isActive = input.isActive;

  switch (kind) {
    case "category":
      return prisma.ticketCategory.update({ where: { id }, data });
    case "priority":
      return prisma.ticketPriority.update({
        where: { id },
        data: {
          ...data,
          ...(input.slaMinutes != null ? { slaMinutes: input.slaMinutes } : {}),
          ...(input.colorToken ? { colorToken: input.colorToken } : {}),
        },
      });
    case "status":
      return prisma.ticketStatus.update({
        where: { id },
        data: {
          ...data,
          ...(input.colorToken ? { colorToken: input.colorToken } : {}),
          ...(input.isTerminal != null ? { isTerminal: input.isTerminal } : {}),
          ...(input.pausesSla != null ? { pausesSla: input.pausesSla } : {}),
        },
      });
    case "type":
      return prisma.ticketType.update({ where: { id }, data });
    case "closeReason":
      return prisma.ticketCloseReason.update({ where: { id }, data });
    default:
      throw new Error("Catálogo no válido");
  }
}

async function countTicketUsage(kind: CatalogKind, id: string): Promise<number> {
  switch (kind) {
    case "category":
      return prisma.ticket.count({ where: { categoryId: id } });
    case "priority":
      return prisma.ticket.count({ where: { priorityId: id } });
    case "status":
      return prisma.ticket.count({ where: { statusId: id } });
    case "type":
      return prisma.ticket.count({ where: { typeId: id } });
    case "closeReason":
      return prisma.ticket.count({ where: { closeReasonId: id } });
    default:
      return 0;
  }
}

export async function deleteCatalogItem(kind: CatalogKind, id: string) {
  const used = await countTicketUsage(kind, id);
  if (used > 0) {
    throw new Error(`No se puede eliminar: ${used} ticket(s) usan este ítem`);
  }

  switch (kind) {
    case "category":
      await prisma.ticketCategory.delete({ where: { id } });
      break;
    case "priority":
      await prisma.ticketPriority.delete({ where: { id } });
      break;
    case "status":
      await prisma.ticketStatus.delete({ where: { id } });
      break;
    case "type":
      await prisma.ticketType.delete({ where: { id } });
      break;
    case "closeReason":
      await prisma.ticketCloseReason.delete({ where: { id } });
      break;
    default:
      throw new Error("Catálogo no válido");
  }
  return { deleted: true };
}

export async function listTechnicianCatalog() {
  const rows = await prisma.ticketTechnician.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ sortOrder: "asc" }, { user: { name: "asc" } }],
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    sortOrder: r.sortOrder,
    isActive: r.isActive,
  }));
}

export async function listActiveTechniciansForForm() {
  const rows = await prisma.ticketTechnician.findMany({
    where: { isActive: true },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: [{ sortOrder: "asc" }, { user: { name: "asc" } }],
  });
  return rows.map((r) => ({
    id: r.userId,
    name: r.user.name,
    email: r.user.email,
  }));
}

export async function addTechnicianToCatalog(userId: string, sortOrder = 0) {
  const user = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
  if (!user) throw new Error("Usuario no válido");
  const existing = await prisma.ticketTechnician.findUnique({ where: { userId } });
  if (existing) throw new Error("El usuario ya está en el catálogo de técnicos");

  return prisma.ticketTechnician.create({
    data: { userId, sortOrder },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateTechnicianCatalogItem(
  id: string,
  input: { sortOrder?: number; isActive?: boolean }
) {
  return prisma.ticketTechnician.update({
    where: { id },
    data: {
      ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

export async function deleteTechnicianCatalogItem(id: string) {
  await prisma.ticketTechnician.delete({ where: { id } });
  return { deleted: true };
}

export async function listUsersForTechnicianPicker(excludeUserIds: string[] = []) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      ...(excludeUserIds.length ? { id: { notIn: excludeUserIds } } : {}),
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
