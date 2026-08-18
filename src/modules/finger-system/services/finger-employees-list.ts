import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";

export type FingerEmployeeLinkFilters = {
  q?: string;
  company?: string;
  hasAttUserId?: boolean;
  page?: number;
  pageSize?: number;
};

export type FingerEmployeeLinkRow = {
  id: string;
  employeeId: string;
  attUserId: number | null;
  badgeNumber: string | null;
  company: string | null;
  fingerprintCount: number;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    codigoEmpleado: string;
    nombre: string;
    cedula: string | null;
    estado: string | null;
    company: string | null;
  };
};

export async function listFingerEmployeeLinks(filters: FingerEmployeeLinkFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FingerEmployeeLinkWhereInput = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { badgeNumber: { contains: q, mode: "insensitive" } },
      { employee: { codigoEmpleado: { contains: q, mode: "insensitive" } } },
      { employee: { nombre: { contains: q, mode: "insensitive" } } },
      { employee: { cedula: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (filters.company?.trim()) {
    const code = filters.company.trim().toUpperCase();
    const companyFilter: Prisma.FingerEmployeeLinkWhereInput = {
      OR: [{ company: code }, { employee: { company: code } }],
    };
    if (where.OR) {
      const searchOr = where.OR;
      delete where.OR;
      where.AND = [{ OR: searchOr }, companyFilter];
    } else {
      Object.assign(where, companyFilter);
    }
  }

  if (filters.hasAttUserId === true) {
    where.attUserId = { not: null };
  } else if (filters.hasAttUserId === false) {
    where.attUserId = null;
  }

  const [total, rows] = await Promise.all([
    prisma.fingerEmployeeLink.count({ where }),
    prisma.fingerEmployeeLink.findMany({
      where,
      orderBy: [{ employee: { nombre: "asc" } }, { badgeNumber: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        employeeId: true,
        attUserId: true,
        badgeNumber: true,
        company: true,
        fingerprintCount: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            codigoEmpleado: true,
            nombre: true,
            cedula: true,
            estado: true,
            company: true,
          },
        },
      },
    }),
  ]);

  const items: FingerEmployeeLinkRow[] = rows.map((r) => ({
    ...r,
    lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getFingerEmployeeLink(id: string): Promise<FingerEmployeeLinkRow | null> {
  const row = await prisma.fingerEmployeeLink.findUnique({
    where: { id },
    select: {
      id: true,
      employeeId: true,
      attUserId: true,
      badgeNumber: true,
      company: true,
      fingerprintCount: true,
      lastSyncAt: true,
      createdAt: true,
      updatedAt: true,
      employee: {
        select: {
          codigoEmpleado: true,
          nombre: true,
          cedula: true,
          estado: true,
          company: true,
        },
      },
    },
  });

  if (!row) return null;

  return {
    ...row,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
