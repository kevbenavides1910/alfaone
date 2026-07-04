import { prisma } from "@/modules/core/db/prisma";
import { updateDeviceLastGps } from "@/modules/syntra/services/patrol-live-tracking-service";

function parseTimestamp(raw: string | undefined): Date {
  if (!raw?.trim()) return new Date();
  const normalized = raw.trim().replace("T", " ");
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function savePatrolGpsTrack(input: {
  deviceId: string;
  imei?: string | null;
  employeeCode?: string | null;
  latitude: number;
  longitude: number;
  recordedAt?: string;
}) {
  // Hora de recepcion en servidor: mas confiable para el mapa en vivo.
  const recordedAt = new Date();

  const track = await prisma.patrolGpsTrack.create({
    data: {
      deviceId: input.deviceId,
      imei: input.imei?.trim() || null,
      employeeCode: input.employeeCode?.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      recordedAt,
    },
  });

  await updateDeviceLastGps(input.deviceId, input.latitude, input.longitude, recordedAt);

  return track;
}
