import { prisma } from "@/modules/core/db/prisma";

/** Relojes sembrados en Odoo alfa_biometric (idempotente por IP). */
const SEED_DEVICES = [
  { name: "Piso 01", ipAddress: "10.1.1.80", port: 4370, location: "Oficinas Piso 01" },
  { name: "Piso 02", ipAddress: "10.1.1.81", port: 4370, location: "Oficinas Piso 02" },
  { name: "Alajuela", ipAddress: "10.2.2.10", port: 4370, location: "Alajuela" },
  { name: "Centro Comercial", ipAddress: "10.4.4.10", port: 4370, location: "Centro Comercial" },
] as const;

export async function ensureSeedFingerDevices() {
  let created = 0;
  for (const seed of SEED_DEVICES) {
    const existing = await prisma.fingerDevice.findFirst({
      where: { ipAddress: seed.ipAddress },
    });
    if (existing) continue;
    await prisma.fingerDevice.create({
      data: {
        name: seed.name,
        ipAddress: seed.ipAddress,
        port: seed.port,
        location: seed.location,
        brand: "ZKTeco",
        isActive: true,
        status: "UNKNOWN",
      },
    });
    created += 1;
  }
  return { created, totalSeed: SEED_DEVICES.length };
}
