import { prisma } from "@/modules/core/db/prisma";
import { updateDeviceLastGps } from "@/modules/syntra/services/patrol-live-tracking-service";
import {
  parsePatrolMarkTimestamp,
} from "@/modules/syntra/utils/costa-rica-time";

export async function savePatrolMark(input: {
  deviceId: string;
  imei: string;
  employeeCode?: string | null;
  nfcTagCode?: string | null;
  markType?: string;
  markedAt?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  serialNumber?: string | null;
  incorrectTimeFlag?: string | boolean | null;
  positionCode?: string | null;
  appVersion?: string | null;
}) {
  const incorrect =
    input.incorrectTimeFlag === true ||
    input.incorrectTimeFlag === "S" ||
    input.incorrectTimeFlag === "true";

  return prisma.patrolMark.create({
    data: {
      deviceId: input.deviceId,
      imei: input.imei.trim(),
      employeeCode: input.employeeCode?.trim() || null,
      nfcTagCode: input.nfcTagCode?.trim() || null,
      markType: input.markType?.trim() || "NFC",
      markedAt: parsePatrolMarkTimestamp(input.markedAt),
      latitude: input.latitude != null && input.latitude !== "" ? Number(input.latitude) : null,
      longitude: input.longitude != null && input.longitude !== "" ? Number(input.longitude) : null,
      serialNumber: input.serialNumber?.trim() || null,
      incorrectTime: incorrect,
      positionCode: input.positionCode?.trim() || null,
      appVersion: input.appVersion?.trim() || null,
    },
  });
}

export async function savePatrolGpsTrack(input: {
  deviceId: string;
  imei?: string | null;
  employeeCode?: string | null;
  latitude: number;
  longitude: number;
  recordedAt?: string;
}) {
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
