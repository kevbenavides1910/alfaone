import { prisma } from "@/modules/core/db/prisma";

export async function ensureSyntraSettingsRow() {
  const row = await prisma.appSyntraSettings.upsert({
    where: { id: "default" },
    create: { id: "default", enableGpsTrack: true },
    update: { enableGpsTrack: true },
  });
  return { ...row, enableGpsTrack: true };
}

export async function getPatrolAdminSummary() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [
    settings,
    devicesTotal,
    devicesActive,
    routesTotal,
    routesActive,
    pointsTotal,
    assignmentsToday,
    recentDevices,
  ] = await Promise.all([
    ensureSyntraSettingsRow(),
    prisma.patrolDevice.count(),
    prisma.patrolDevice.count({ where: { isActive: true } }),
    prisma.patrolRoute.count(),
    prisma.patrolRoute.count({ where: { isActive: true } }),
    prisma.patrolRoutePoint.count(),
    prisma.patrolAssignment.count({
      where: {
        validFrom: { lte: today },
        OR: [{ validUntil: null }, { validUntil: { gte: today } }],
      },
    }),
    prisma.patrolDevice.findMany({
      orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }],
      take: 10,
      select: {
        id: true,
        imei: true,
        employeeCode: true,
        label: true,
        isActive: true,
        lastLoginAt: true,
      },
    }),
  ]);

  return {
    settings,
    totals: {
      devicesTotal,
      devicesActive,
      routesTotal,
      routesActive,
      pointsTotal,
      assignmentsToday,
    },
    recentDevices,
    marksNote:
      "Las marcas NFC de la app móvil siguen registrándose en el sistema legacy. Los reportes de cumplimiento de ronda se consolidarán aquí cuando se integre el receptor de marcas.",
  };
}
