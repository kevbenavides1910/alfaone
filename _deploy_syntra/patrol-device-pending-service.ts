import { prisma } from "@/modules/core/db/prisma";
import { patrolImeisMatch } from "@/modules/syntra/utils/costa-rica-time";

export type DevicePendingMarkRow = {
  localId?: number;
  type: string;
  tag?: string;
  markType?: string;
  timestamp?: string;
  status?: string;
  employeeCode?: string;
  positionCode?: string;
};

export async function saveDevicePendingSnapshot(input: {
  deviceId?: string | null;
  imei: string;
  employeeCode?: string | null;
  pendingCount: number;
  staleCount: number;
  appVersion?: string | null;
  marks: DevicePendingMarkRow[];
}) {
  return prisma.patrolDevicePendingSnapshot.create({
    data: {
      deviceId: input.deviceId ?? null,
      imei: input.imei.trim(),
      employeeCode: input.employeeCode?.trim() || null,
      pendingCount: input.pendingCount,
      staleCount: input.staleCount,
      appVersion: input.appVersion?.trim() || null,
      payload: input.marks,
    },
  });
}

export async function getDevicePendingAuditReport(input: {
  imei: string;
  desde: string;
  hasta: string;
}) {
  const start = new Date(`${input.desde}T00:00:00.000Z`);
  const end = new Date(`${input.hasta}T23:59:59.999Z`);

  const [latestSnapshot, serverMarks] = await Promise.all([
    prisma.patrolDevicePendingSnapshot.findFirst({
      where: { imei: input.imei.trim() },
      orderBy: { createdAt: "desc" },
    }),
    prisma.patrolMark.findMany({
      where: {
        markedAt: { gte: start, lte: end },
      },
      orderBy: { markedAt: "desc" },
      take: 5000,
    }),
  ]);

  const serverForImei = serverMarks.filter((m) => patrolImeisMatch(m.imei, input.imei));

  const pendingOnDevice = Array.isArray(latestSnapshot?.payload)
    ? (latestSnapshot!.payload as DevicePendingMarkRow[])
    : [];

  const missingOnServer = pendingOnDevice.filter((local) => {
    if (!local.timestamp) return true;
    const localTs = new Date(local.timestamp.replace(/\//g, "-").replace(" ", "T"));
    if (Number.isNaN(localTs.getTime())) return true;
    return !serverForImei.some((server) => {
      const diff = Math.abs(server.markedAt.getTime() - localTs.getTime());
      if (diff > 5 * 60 * 1000) return false;
      if (local.type === "NFC" && local.tag) {
        return (
          (server.nfcTagCode ?? "").trim().toLowerCase() === local.tag.trim().toLowerCase()
        );
      }
      if (local.type === "RELOJ" && local.markType) {
        return (server.markType ?? "").trim() === local.markType.trim();
      }
      return diff <= 60 * 1000;
    });
  });

  return {
    imei: input.imei.trim(),
    range: { desde: input.desde, hasta: input.hasta },
    snapshotAt: latestSnapshot?.createdAt?.toISOString() ?? null,
    pendingCount: latestSnapshot?.pendingCount ?? 0,
    staleCount: latestSnapshot?.staleCount ?? 0,
    pendingOnDevice,
    serverMarkCount: serverForImei.length,
    missingOnServer,
    missingCount: missingOnServer.length,
    serverMarks: serverForImei.map((m) => ({
      id: m.id,
      markType: m.markType,
      nfcTagCode: m.nfcTagCode,
      markedAt: m.markedAt.toISOString(),
      employeeCode: m.employeeCode,
      positionCode: m.positionCode,
    })),
  };
}

export async function listMarksByImei(input: {
  imei: string;
  desde: string;
  hasta: string;
  limit?: number;
}) {
  const start = new Date(`${input.desde}T00:00:00.000Z`);
  const end = new Date(`${input.hasta}T23:59:59.999Z`);
  const rows = await prisma.patrolMark.findMany({
    where: { markedAt: { gte: start, lte: end } },
    orderBy: { markedAt: "desc" },
    take: input.limit ?? 2000,
  });
  return rows
    .filter((m) => patrolImeisMatch(m.imei, input.imei))
    .map((m) => ({
      id: m.id,
      imei: m.imei,
      markType: m.markType,
      nfcTagCode: m.nfcTagCode,
      markedAt: m.markedAt.toISOString(),
      employeeCode: m.employeeCode,
      positionCode: m.positionCode,
      latitude: m.latitude,
      longitude: m.longitude,
      appVersion: m.appVersion,
    }));
}
