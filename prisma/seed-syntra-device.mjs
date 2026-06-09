/**
 * Crea o actualiza el dispositivo de prueba Alfa One y una ruta demo.
 * Ejecutar en el servidor tras migrate deploy:
 *   node prisma/seed-syntra-device.mjs
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO = {
  imei: "000000000000001",
  employeeCode: "1001",
  password: "syntra123",
  routeCode: "DEMO-01",
  routeName: "Ruta demo Alfa One",
  points: [
    {
      code: "P001",
      name: "Entrada principal",
      nfcTagCode: "TAG-DEMO-01",
      latitude: "9.9281000",
      longitude: "-84.0909000",
      windowStart: "06:00",
      windowEnd: "12:00",
      sortOrder: 0,
    },
    {
      code: "P002",
      name: "Estacionamiento",
      nfcTagCode: "TAG-DEMO-02",
      latitude: "9.9285000",
      longitude: "-84.0912000",
      windowStart: "12:00",
      windowEnd: "18:00",
      sortOrder: 1,
    },
  ],
};

function todayUtcDateOnly() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO.password, 10);
  const today = todayUtcDateOnly();

  await prisma.appSyntraSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      enableGeofences: false,
      enableGpsTrack: false,
    },
    update: {},
  });

  const device = await prisma.patrolDevice.upsert({
    where: { imei: DEMO.imei },
    create: {
      imei: DEMO.imei,
      employeeCode: DEMO.employeeCode,
      passwordHash,
      label: "Teléfono prueba Alfa One",
      isActive: true,
    },
    update: {
      employeeCode: DEMO.employeeCode,
      passwordHash,
      isActive: true,
      label: "Teléfono prueba Alfa One",
    },
  });

  const route = await prisma.patrolRoute.upsert({
    where: { code: DEMO.routeCode },
    create: {
      code: DEMO.routeCode,
      name: DEMO.routeName,
      description: "Ruta de prueba para app Alfa One",
      isActive: true,
    },
    update: {
      name: DEMO.routeName,
      isActive: true,
    },
  });

  await prisma.patrolRoutePoint.deleteMany({ where: { routeId: route.id } });
  for (const p of DEMO.points) {
    await prisma.patrolRoutePoint.create({
      data: {
        routeId: route.id,
        code: p.code,
        name: p.name,
        nfcTagCode: p.nfcTagCode,
        latitude: p.latitude,
        longitude: p.longitude,
        windowStart: p.windowStart,
        windowEnd: p.windowEnd,
        sortOrder: p.sortOrder,
        radiusM: 100,
      },
    });
  }

  await prisma.patrolAssignment.upsert({
    where: {
      deviceId_routeId_validFrom: {
        deviceId: device.id,
        routeId: route.id,
        validFrom: today,
      },
    },
    create: {
      deviceId: device.id,
      routeId: route.id,
      validFrom: today,
    },
    update: {},
  });

  console.log("Alfa One seed OK");
  console.log(`  IMEI: ${DEMO.imei}`);
  console.log(`  Empleado: ${DEMO.employeeCode}`);
  console.log(`  Clave: ${DEMO.password}`);
  console.log(`  Ruta: ${DEMO.routeCode} (${DEMO.points.length} puntos NFC)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
