import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";

export type NafEmployeeListFilters = {
  q?: string;
  noCia?: string;
  estado?: string;
  page?: number;
  pageSize?: number;
};

export async function listNafEmployees(filters: NafEmployeeListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.NafEmployeeWhereInput = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { noEmple: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { cedula: { contains: q, mode: "insensitive" } },
      { correoElectronico: { contains: q, mode: "insensitive" } },
      { telefono: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.noCia?.trim()) {
    where.noCia = filters.noCia.trim();
  }

  if (filters.estado?.trim()) {
    where.estado = { equals: filters.estado.trim(), mode: "insensitive" };
  }

  const [total, rows, lastSync, estadoCounts] = await Promise.all([
    prisma.nafEmployee.count({ where }),
    prisma.nafEmployee.findMany({
      where,
      orderBy: [{ nombre: "asc" }, { noEmple: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        sourceKey: true,
        noCia: true,
        noEmple: true,
        nombre: true,
        cedula: true,
        telefono: true,
        correoElectronico: true,
        estado: true,
        area: true,
        depto: true,
        puesto: true,
        contrato: true,
        ubicacionCode: true,
        ubicacionNombre: true,
        asegu: true,
        noRol: true,
        formaPago: true,
        tipoCuenta: true,
        numCuenta: true,
        tituloCode: true,
        tituloNombre: true,
        categoria: true,
        nominaCode: true,
        nominaNombre: true,
        clase: true,
        fNacimi: true,
        direccion: true,
        zonaCode: true,
        zona: true,
        eCivil: true,
        jornada: true,
        nacion: true,
        banco: true,
        tipoEmp: true,
        indOficial: true,
        fIngreso: true,
        fEgreso: true,
        syncedAt: true,
        updatedAt: true,
      },
    }),
    prisma.nafEmployeeSyncRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        rowsFetched: true,
        rowsUpserted: true,
        errorMessage: true,
      },
    }),
    prisma.nafEmployee.groupBy({
      by: ["estado"],
      _count: { _all: true },
    }),
  ]);

  const resumenEstado = Object.fromEntries(
    estadoCounts.map((e) => [e.estado ?? "?", e._count._all]),
  );

  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    rows,
    lastSync,
    resumenEstado,
  };
}
