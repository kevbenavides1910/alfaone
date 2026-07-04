import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";

export type EmployeeListFilters = {
  q?: string;
  zona?: string;
  contrato?: string;
  estado?: string;
  companySapCode?: string;
  company?: string;
  page?: number;
  pageSize?: number;
};

export async function listEmployees(filters: EmployeeListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.EmployeeWhereInput = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { codigoEmpleado: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { cedula: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.zona?.trim()) {
    where.zona = { contains: filters.zona.trim(), mode: "insensitive" };
  }

  if (filters.estado?.trim()) {
    where.estado = { equals: filters.estado.trim(), mode: "insensitive" };
  }

  if (filters.companySapCode?.trim()) {
    where.companySapCode = filters.companySapCode.trim();
  }

  if (filters.company?.trim()) {
    where.company = filters.company.trim().toUpperCase();
  }

  if (filters.contrato?.trim()) {
    const c = filters.contrato.trim();
    where.placements = {
      some: {
        OR: [
          { contrato: { contains: c, mode: "insensitive" } },
          { contratoNormalizado: { contains: c, mode: "insensitive" } },
          { contract: { licitacionNo: { contains: c, mode: "insensitive" } } },
        ],
      },
    };
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: [{ nombre: "asc" }, { codigoEmpleado: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        codigoEmpleado: true,
        nombre: true,
        cedula: true,
        email: true,
        telefono: true,
        zona: true,
        estado: true,
        oficial: true,
        companySapCode: true,
        company: true,
        companyEntity: { select: { code: true, name: true, sapCode: true } },
        nominaNombre: true,
        fechaIngreso: true,
        updatedAt: true,
        _count: { select: { placements: true } },
        placements: {
          take: 1,
          orderBy: { updatedAt: "desc" },
          select: {
            contrato: true,
            ubicacionNombre: true,
            puestoNombre: true,
            contract: { select: { id: true, licitacionNo: true, client: true } },
          },
        },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    rows: rows.map((r) => ({
      ...r,
      primaryPlacement: r.placements[0] ?? null,
      placementsCount: r._count.placements,
    })),
  };
}
