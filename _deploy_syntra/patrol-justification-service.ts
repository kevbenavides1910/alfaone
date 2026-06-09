import { prisma } from "@/modules/core/db/prisma";
import { savePatrolImage } from "@/modules/syntra/services/patrol-image-store";

export function buildOmissionKey(
  fecha: string,
  deviceId: string,
  routeId: string,
  routePointId: string,
  ventanaInicio: string,
  ventanaFin: string,
): string {
  return `${fecha}|${deviceId}|${routeId}|${routePointId}|${ventanaInicio}|${ventanaFin}`;
}

export type JustificationSummary = {
  id: string;
  omissionKey: string;
  description: string;
  source: string;
  imagePath: string | null;
  bitacoraEntryId: string | null;
  createdAt: string;
};

export async function getJustificationsByKeys(keys: string[]): Promise<Map<string, JustificationSummary>> {
  if (keys.length === 0) return new Map();

  const rows = await prisma.patrolOmissionJustification.findMany({
    where: { omissionKey: { in: keys } },
  });

  return new Map(
    rows.map((r) => [
      r.omissionKey,
      {
        id: r.id,
        omissionKey: r.omissionKey,
        description: r.description,
        source: r.source,
        imagePath: r.imagePath,
        bitacoraEntryId: r.bitacoraEntryId,
        createdAt: r.createdAt.toISOString(),
      },
    ]),
  );
}

export async function createWebJustification(input: {
  omissionKey: string;
  fecha: string;
  deviceId: string;
  routeId: string;
  routePointId: string;
  routeCode: string;
  pointLabel: string;
  nfcTagCode: string;
  description: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  createdById?: string | null;
  sharedImage?: {
    imageMimeType: string | null;
    imageFileName: string | null;
    imagePath: string | null;
  };
}) {
  const existing = await prisma.patrolOmissionJustification.findUnique({
    where: { omissionKey: input.omissionKey },
  });
  if (existing) throw new Error("ALREADY_JUSTIFIED");

  const image = input.sharedImage
    ? input.sharedImage
    : await savePatrolImage(input.imageBase64, input.imageMimeType);

  return prisma.patrolOmissionJustification.create({
    data: {
      omissionKey: input.omissionKey,
      fecha: input.fecha,
      deviceId: input.deviceId,
      routeId: input.routeId,
      routePointId: input.routePointId,
      routeCode: input.routeCode,
      pointLabel: input.pointLabel,
      nfcTagCode: input.nfcTagCode,
      description: input.description.trim(),
      imageMimeType: image.imageMimeType ?? (input.imageMimeType?.trim() || null),
      imageFileName: image.imageFileName ?? (input.imageFileName?.trim() || null),
      imagePath: image.imagePath,
      source: "WEB",
      createdById: input.createdById ?? null,
    },
  });
}

export type OmissionJustificationTarget = {
  omissionKey: string;
  fecha: string;
  deviceId: string;
  routeId: string;
  routePointId: string;
  routeCode: string;
  pointLabel: string;
  nfcTagCode: string;
};

export async function createWebJustificationsBulk(input: {
  omissions: OmissionJustificationTarget[];
  description: string;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  createdById?: string | null;
}) {
  if (input.omissions.length === 0) throw new Error("NO_OMISSIONS");

  const keys = input.omissions.map((o) => o.omissionKey);
  const existing = await prisma.patrolOmissionJustification.findMany({
    where: { omissionKey: { in: keys } },
    select: { omissionKey: true, pointLabel: true },
  });
  if (existing.length > 0) {
    throw new Error(`ALREADY_JUSTIFIED:${existing[0].pointLabel}`);
  }

  const sharedImage = await savePatrolImage(input.imageBase64, input.imageMimeType);
  const created = [];

  for (const omission of input.omissions) {
    const row = await createWebJustification({
      ...omission,
      description: input.description,
      createdById: input.createdById,
      sharedImage,
    });
    created.push(row);
  }

  return created;
}

export async function linkBitacoraToOmission(input: {
  bitacoraEntryId: string;
  omissionKey: string;
  fecha: string;
  deviceId: string;
  routeId: string;
  routePointId: string;
  routeCode: string;
  pointLabel: string;
  nfcTagCode: string;
  createdById?: string | null;
}) {
  const bitacora = await prisma.patrolBitacoraEntry.findUnique({
    where: { id: input.bitacoraEntryId },
  });
  if (!bitacora) throw new Error("BITACORA_NOT_FOUND");

  const existing = await prisma.patrolOmissionJustification.findUnique({
    where: { omissionKey: input.omissionKey },
  });
  if (existing) throw new Error("ALREADY_JUSTIFIED");

  return prisma.$transaction(async (tx) => {
    const justification = await tx.patrolOmissionJustification.create({
      data: {
        omissionKey: input.omissionKey,
        fecha: input.fecha,
        deviceId: input.deviceId,
        routeId: input.routeId,
        routePointId: input.routePointId,
        routeCode: input.routeCode,
        pointLabel: input.pointLabel,
        nfcTagCode: input.nfcTagCode,
        description: bitacora.description,
        imageMimeType: bitacora.imageMimeType,
        imageFileName: bitacora.imageFileName,
        imagePath: bitacora.imagePath,
        source: "APP",
        bitacoraEntryId: bitacora.id,
        createdById: input.createdById ?? null,
      },
    });

    await tx.patrolBitacoraEntry.update({
      where: { id: bitacora.id },
      data: { linkedOmissionKey: input.omissionKey },
    });

    return justification;
  });
}

export async function listOmissionsForLinking(input: {
  fecha: string;
  imei?: string;
}) {
  const report = await import("@/modules/syntra/services/patrol-marks-compliance-service").then((m) =>
    m.getPatrolMarksComplianceReport({
      desde: input.fecha,
      hasta: input.fecha,
      imei: input.imei,
    }),
  );

  return report.filas
    .filter((f) => f.estado === "NO_REALIZADA" && !f.justification)
    .map((f) => ({
      omissionKey: f.omissionKey,
      fecha: f.fecha,
      deviceId: f.deviceId,
      routeId: f.routeId,
      routePointId: f.routePointId,
      routeCode: f.routeCode,
      routeName: f.routeName,
      pointLabel: f.pointLabel,
      nfcTagCode: f.nfcTagCode,
      imei: f.imei,
      employeeCode: f.employeeCode,
    }));
}
