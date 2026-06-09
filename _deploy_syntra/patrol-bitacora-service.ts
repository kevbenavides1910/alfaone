import { prisma } from "@/modules/core/db/prisma";
import { savePatrolImage } from "@/modules/syntra/services/patrol-image-store";

function parseIncidentTimestamp(raw: string | undefined): Date {
  if (!raw?.trim()) return new Date();
  const normalized = raw.trim().replace("T", " ");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function savePatrolBitacoraEntry(input: {
  deviceId?: string | null;
  imei: string;
  employeeCode: string;
  description: string;
  routeCode?: string | null;
  incidentAt?: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  source?: string;
}) {
  const image = await savePatrolImage(input.imageBase64, input.imageMimeType);

  return prisma.patrolBitacoraEntry.create({
    data: {
      deviceId: input.deviceId ?? null,
      imei: input.imei.trim(),
      employeeCode: input.employeeCode.trim(),
      description: input.description.trim(),
      routeCode: input.routeCode?.trim() || null,
      incidentAt: parseIncidentTimestamp(input.incidentAt),
      imageMimeType: image.imageMimeType ?? (input.imageMimeType?.trim() || null),
      imageFileName: image.imageFileName ?? (input.imageFileName?.trim() || null),
      imagePath: image.imagePath,
      source: input.source?.trim() || "APP",
    },
  });
}

export async function listPatrolBitacoraEntries(input: {
  desde?: string;
  hasta?: string;
  imei?: string;
  unlinkedOnly?: boolean;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};

  if (input.imei?.trim()) {
    where.imei = input.imei.trim();
  }

  if (input.unlinkedOnly) {
    where.linkedOmissionKey = null;
    where.justification = { is: null };
  }

  if (input.desde || input.hasta) {
    const incidentAt: Record<string, Date> = {};
    if (input.desde) incidentAt.gte = new Date(`${input.desde}T06:00:00.000Z`);
    if (input.hasta) {
      const [y, m, d] = input.hasta.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      incidentAt.lt = new Date(`${next.toISOString().slice(0, 10)}T06:00:00.000Z`);
    }
    where.incidentAt = incidentAt;
  }

  const rows = await prisma.patrolBitacoraEntry.findMany({
    where,
    orderBy: [{ incidentAt: "desc" }],
    take: input.limit ?? 200,
    include: {
      justification: {
        select: {
          id: true,
          omissionKey: true,
          routeCode: true,
          pointLabel: true,
          fecha: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    imei: r.imei,
    employeeCode: r.employeeCode,
    description: r.description,
    routeCode: r.routeCode,
    incidentAt: r.incidentAt.toISOString(),
    imagePath: r.imagePath,
    imageMimeType: r.imageMimeType,
    source: r.source,
    linkedOmissionKey: r.linkedOmissionKey,
    justification: r.justification,
    isLinked: Boolean(r.linkedOmissionKey || r.justification),
  }));
}
