from pathlib import Path

root = Path("/home/soporte-ti/presupuestos-alfa")
svc = root / "src/modules/syntra/services/patrol-reports-service.ts"
text = svc.read_text(encoding="utf-8")
if "updateDeviceLastGps" not in text:
    text = text.replace(
        'import { prisma } from "@/modules/core/db/prisma";',
        'import { prisma } from "@/modules/core/db/prisma";\nimport { updateDeviceLastGps } from "@/modules/syntra/services/patrol-live-tracking-service";',
    )
    old = """export async function savePatrolGpsTrack(input: {
  deviceId: string;
  imei?: string | null;
  employeeCode?: string | null;
  latitude: number;
  longitude: number;
  recordedAt?: string;
}) {
  return prisma.patrolGpsTrack.create({
    data: {
      deviceId: input.deviceId,
      imei: input.imei?.trim() || null,
      employeeCode: input.employeeCode?.trim() || null,
      latitude: input.latitude,
      longitude: input.longitude,
      recordedAt: parseTimestamp(input.recordedAt),
    },
  });
}"""
    new = """export async function savePatrolGpsTrack(input: {
  deviceId: string;
  imei?: string | null;
  employeeCode?: string | null;
  latitude: number;
  longitude: number;
  recordedAt?: string;
}) {
  const recordedAt = parseTimestamp(input.recordedAt);
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
}"""
    if old in text:
        svc.write_text(text.replace(old, new), encoding="utf-8")
        print("patrol-reports-service patched")
    else:
        print("WARN: savePatrolGpsTrack block not found")

schema = root / "prisma/schema.prisma"
st = schema.read_text(encoding="utf-8")
if "lastGpsLatitude" not in st:
    old = "  lastLoginAt  DateTime?\n  createdAt    DateTime"
    new = (
        "  lastLoginAt      DateTime?\n"
        "  lastGpsLatitude  Decimal?  @db.Decimal(10, 7)\n"
        "  lastGpsLongitude Decimal?  @db.Decimal(10, 7)\n"
        "  lastGpsAt        DateTime?\n"
        "  createdAt        DateTime"
    )
    if old in st:
        schema.write_text(st.replace(old, new), encoding="utf-8")
        print("schema patched")
