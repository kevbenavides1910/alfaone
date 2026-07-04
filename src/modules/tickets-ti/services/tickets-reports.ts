import type { Session } from "next-auth";
import { prisma } from "@/modules/core/db/prisma";
import { ticketsVisibilityWhere } from "./ticket-access";

export async function getTicketsReports(session: Session, userId: string) {
  const baseWhere = { deletedAt: null, ...ticketsVisibilityWhere(session, userId) };

  const byStatus = await prisma.ticket.groupBy({
    by: ["statusId"],
    where: baseWhere,
    _count: { _all: true },
  });

  const statuses = await prisma.ticketStatus.findMany({ where: { isActive: true } });
  const statusMap = new Map(statuses.map((s) => [s.id, s]));

  const byPriority = await prisma.ticket.groupBy({
    by: ["priorityId"],
    where: baseWhere,
    _count: { _all: true },
  });
  const priorities = await prisma.ticketPriority.findMany({ where: { isActive: true } });
  const priorityMap = new Map(priorities.map((p) => [p.id, p]));

  const closedThisMonth = await prisma.ticket.count({
    where: {
      ...baseWhere,
      closedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
    },
  });

  const avgResolution = await prisma.ticket.aggregate({
    where: { ...baseWhere, resolvedAt: { not: null } },
    _avg: { totalWorkMinutes: true },
  });

  const slaBreached = await prisma.ticketSla.count({
    where: { status: "BREACHED", ticket: baseWhere },
  });

  return {
    byStatus: byStatus.map((row) => ({
      code: statusMap.get(row.statusId)?.code ?? "?",
      name: statusMap.get(row.statusId)?.name ?? "?",
      count: row._count._all,
    })),
    byPriority: byPriority.map((row) => ({
      code: priorityMap.get(row.priorityId)?.code ?? "?",
      name: priorityMap.get(row.priorityId)?.name ?? "?",
      count: row._count._all,
    })),
    closedThisMonth,
    avgWorkMinutes: Math.round(avgResolution._avg.totalWorkMinutes ?? 0),
    slaBreached,
    total: byStatus.reduce((a, b) => a + b._count._all, 0),
  };
}

import {
  listTechnicianCatalog,
  listActiveTechniciansForForm,
  listUsersForTechnicianPicker,
} from "./catalog-admin";

export async function listCatalogs() {
  const [categories, priorities, statuses, types, closeReasons, technicians] =
    await Promise.all([
      prisma.ticketCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.ticketPriority.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.ticketStatus.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.ticketType.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.ticketCloseReason.findMany({ orderBy: { sortOrder: "asc" } }),
      listTechnicianCatalog(),
    ]);

  const technicianUserIds = technicians.map((t) => t.userId);
  const availableUsers = await listUsersForTechnicianPicker(technicianUserIds);

  return { categories, priorities, statuses, types, closeReasons, technicians, availableUsers };
}

export async function upsertCatalog(input: {
  kind: string;
  code: string;
  name: string;
  sortOrder?: number;
  slaMinutes?: number;
  isActive?: boolean;
  colorToken?: string;
  isTerminal?: boolean;
  pausesSla?: boolean;
}) {
  const data = {
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  };

  switch (input.kind) {
    case "category":
      return prisma.ticketCategory.upsert({
        where: { code: input.code },
        create: { code: input.code, ...data },
        update: data,
      });
    case "priority":
      return prisma.ticketPriority.upsert({
        where: { code: input.code },
        create: {
          code: input.code,
          ...data,
          slaMinutes: input.slaMinutes ?? 480,
          colorToken: input.colorToken ?? "blue",
        },
        update: {
          ...data,
          ...(input.slaMinutes != null ? { slaMinutes: input.slaMinutes } : {}),
          ...(input.colorToken ? { colorToken: input.colorToken } : {}),
        },
      });
    case "status":
      return prisma.ticketStatus.upsert({
        where: { code: input.code },
        create: {
          code: input.code,
          ...data,
          colorToken: input.colorToken ?? "slate",
          isTerminal: input.isTerminal ?? false,
          pausesSla: input.pausesSla ?? false,
        },
        update: {
          ...data,
          ...(input.colorToken ? { colorToken: input.colorToken } : {}),
          ...(input.isTerminal != null ? { isTerminal: input.isTerminal } : {}),
          ...(input.pausesSla != null ? { pausesSla: input.pausesSla } : {}),
        },
      });
    case "type":
      return prisma.ticketType.upsert({
        where: { code: input.code },
        create: { code: input.code, ...data },
        update: data,
      });
    case "closeReason":
      return prisma.ticketCloseReason.upsert({
        where: { code: input.code },
        create: { code: input.code, ...data },
        update: data,
      });
    default:
      throw new Error("Catálogo no válido");
  }
}

export async function updatePrioritySla(priorityId: string, slaMinutes: number) {
  return prisma.ticketPriority.update({
    where: { id: priorityId },
    data: { slaMinutes },
  });
}

export async function getCreateFormCatalogs() {
  const [categories, priorities, types, technicians] = await Promise.all([
    prisma.ticketCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ticketPriority.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ticketType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    listActiveTechniciansForForm(),
  ]);
  return { categories, priorities, types, technicians };
}
