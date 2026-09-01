import type { DisciplinaryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export type DisciplinaryDashboardInput = {
  desde?: Date | null;
  hasta?: Date | null;
  administrador?: string;
};

type ThirdApercibimientoRow = {
  codigoEmpleado: string;
  nombreEmpleado: string;
  fechaTercero: Date;
  administrador: string | null;
};

export async function getDisciplinaryDashboard(input: DisciplinaryDashboardInput = {}) {
  const { desde, administrador } = input;
  const endHasta = input.hasta
    ? new Date(input.hasta.getFullYear(), input.hasta.getMonth(), input.hasta.getDate(), 23, 59, 59, 999)
    : undefined;

  const whereAp: Prisma.DisciplinaryApercibimientoWhereInput = {};
  if (desde || endHasta) {
    whereAp.fechaEmision = {};
    if (desde) whereAp.fechaEmision.gte = desde;
    if (endHasta) whereAp.fechaEmision.lte = endHasta;
  }
  if (administrador) {
    whereAp.administrador = { contains: administrador, mode: "insensitive" };
  }

  const totalRango = await prisma.disciplinaryApercibimiento.count({ where: whereAp });

  const porEstadoAgg = await prisma.disciplinaryApercibimiento.groupBy({
    where: whereAp,
    by: ["estado"],
    _count: { _all: true },
  });
  const porEstado = porEstadoAgg.reduce<Record<DisciplinaryStatus, number>>(
    (acc, r) => {
      acc[r.estado] = r._count._all;
      return acc;
    },
    { EMITIDO: 0, ENTREGADO: 0, FIRMADO: 0, ANULADO: 0 },
  );

  const porAdministradorAgg = await prisma.disciplinaryApercibimiento.groupBy({
    where: whereAp,
    by: ["administrador"],
    _count: { _all: true },
    orderBy: { _count: { administrador: "desc" } },
  });
  const porAdministrador = porAdministradorAgg.map((r) => ({
    administrador: r.administrador ?? "(Sin administrador)",
    total: r._count._all,
  }));

  const whereCycle: Prisma.DisciplinaryClosedCycleWhereInput = {};
  if (desde || endHasta) {
    whereCycle.cerradoEl = {};
    if (desde) (whereCycle.cerradoEl as Prisma.DateTimeFilter).gte = desde;
    if (endHasta) (whereCycle.cerradoEl as Prisma.DateTimeFilter).lte = endHasta;
  }

  const [cobradosAgg, bajasCount] = await Promise.all([
    prisma.disciplinaryClosedCycle.aggregate({
      where: { ...whereCycle, accion: "COBRADO" },
      _sum: { monto: true },
      _count: { _all: true },
    }),
    prisma.disciplinaryClosedCycle.count({
      where: { ...whereCycle, accion: "DADO_DE_BAJA" },
    }),
  ]);

  const allNotAnulado = await prisma.disciplinaryApercibimiento.findMany({
    where: { estado: { not: "ANULADO" } },
    orderBy: [{ codigoEmpleado: "asc" }, { fechaEmision: "asc" }],
    select: {
      codigoEmpleado: true,
      nombreEmpleado: true,
      fechaEmision: true,
      administrador: true,
    },
  });

  const terceros: ThirdApercibimientoRow[] = [];
  let currentCode: string | null = null;
  let countSoFar = 0;
  for (const row of allNotAnulado) {
    if (row.codigoEmpleado !== currentCode) {
      currentCode = row.codigoEmpleado;
      countSoFar = 0;
    }
    countSoFar++;
    if (countSoFar === 3) {
      const inRange =
        (!desde || row.fechaEmision >= desde) &&
        (!endHasta || row.fechaEmision <= endHasta);
      const matchesAdmin =
        !administrador ||
        (row.administrador?.toLowerCase().includes(administrador.toLowerCase()) ?? false);
      if (inRange && matchesAdmin) {
        terceros.push({
          codigoEmpleado: row.codigoEmpleado,
          nombreEmpleado: row.nombreEmpleado,
          fechaTercero: row.fechaEmision,
          administrador: row.administrador,
        });
      }
    }
  }

  return {
    rango: {
      desde: desde?.toISOString() ?? null,
      hasta: endHasta?.toISOString() ?? null,
      administrador: administrador ?? null,
    },
    totales: {
      apercibimientos: totalRango,
      cobradosCount: cobradosAgg._count._all,
      cobradosMonto: Number(cobradosAgg._sum.monto ?? 0),
      bajas: bajasCount,
      tercerosUmbral: terceros.length,
    },
    porEstado,
    porAdministrador: porAdministrador.slice(0, 15),
    terceros: terceros.slice(0, 25).map((t) => ({
      ...t,
      fechaTercero: t.fechaTercero.toISOString(),
    })),
  };
}
