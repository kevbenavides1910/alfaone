/**
 * Siembra catálogos iniciales del módulo Tickets TI.
 * Ejecutar: node prisma/seed-tickets-ti-catalogs.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATUSES = [
  { code: "NUEVO", name: "Nuevo", colorToken: "slate", sortOrder: 10, isTerminal: false, pausesSla: false },
  { code: "ASIGNADO", name: "Asignado", colorToken: "blue", sortOrder: 20, isTerminal: false, pausesSla: false },
  { code: "EN_PROCESO", name: "En proceso", colorToken: "sky", sortOrder: 30, isTerminal: false, pausesSla: false },
  { code: "ESPERANDO_INFORMACION", name: "Esperando información", colorToken: "amber", sortOrder: 40, isTerminal: false, pausesSla: true },
  { code: "ESPERANDO_PROVEEDOR", name: "Esperando proveedor", colorToken: "orange", sortOrder: 50, isTerminal: false, pausesSla: true },
  { code: "RESUELTO", name: "Resuelto", colorToken: "green", sortOrder: 60, isTerminal: false, pausesSla: false },
  { code: "VERIFICACION_USUARIO", name: "Verificación del usuario", colorToken: "emerald", sortOrder: 70, isTerminal: false, pausesSla: false },
  { code: "CERRADO", name: "Cerrado", colorToken: "green-dark", sortOrder: 80, isTerminal: true, pausesSla: false },
  { code: "REABIERTO", name: "Reabierto", colorToken: "purple", sortOrder: 90, isTerminal: false, pausesSla: false },
  { code: "CANCELADO", name: "Cancelado", colorToken: "slate", sortOrder: 100, isTerminal: true, pausesSla: false },
  { code: "RECHAZADO", name: "Rechazado", colorToken: "red", sortOrder: 110, isTerminal: true, pausesSla: false },
];

const PRIORITIES = [
  { code: "BAJA", name: "Baja", colorToken: "green", sortOrder: 10, slaMinutes: 2880 },
  { code: "MEDIA", name: "Media", colorToken: "blue", sortOrder: 20, slaMinutes: 1440 },
  { code: "ALTA", name: "Alta", colorToken: "orange", sortOrder: 30, slaMinutes: 480 },
  { code: "CRITICA", name: "Crítica", colorToken: "red", sortOrder: 40, slaMinutes: 120 },
];

const TYPES = [
  { code: "INCIDENTE", name: "Incidente", sortOrder: 10 },
  { code: "SOLICITUD", name: "Solicitud", sortOrder: 20 },
  { code: "PROBLEMA", name: "Problema", sortOrder: 30 },
  { code: "REQUERIMIENTO", name: "Requerimiento", sortOrder: 40 },
];

const CATEGORIES = [
  { code: "HARDWARE", name: "Hardware", sortOrder: 10 },
  { code: "SOFTWARE", name: "Correcciones en Sistemas", sortOrder: 20 },
  { code: "RED", name: "Red / Conectividad", sortOrder: 30 },
  { code: "CORREO", name: "Correo / Office", sortOrder: 40 },
  { code: "ACCESOS", name: "Accesos y permisos", sortOrder: 50 },
  { code: "OTRO", name: "Otro", sortOrder: 99 },
];

const DEPARTMENTS = [
  { code: "TI", name: "Tecnología de la Información", sortOrder: 10 },
];

async function upsertCatalog(model, rows, label) {
  for (const row of rows) {
    await model.upsert({
      where: { code: row.code },
      create: row,
      update: {
        name: row.name,
        sortOrder: row.sortOrder,
        ...(row.colorToken !== undefined ? { colorToken: row.colorToken } : {}),
        ...(row.slaMinutes !== undefined ? { slaMinutes: row.slaMinutes } : {}),
        ...(row.isTerminal !== undefined ? { isTerminal: row.isTerminal } : {}),
        ...(row.pausesSla !== undefined ? { pausesSla: row.pausesSla } : {}),
        isActive: true,
      },
    });
  }
  console.log(`OK ${label}: ${rows.length} registros`);
}

async function main() {
  await upsertCatalog(prisma.ticketStatus, STATUSES, "Estados");
  await upsertCatalog(prisma.ticketPriority, PRIORITIES, "Prioridades");
  await upsertCatalog(prisma.ticketType, TYPES, "Tipos");
  await upsertCatalog(prisma.ticketCategory, CATEGORIES, "Categorías");
  await upsertCatalog(prisma.ticketDepartment, DEPARTMENTS, "Departamentos");

  const adminUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ role: "ADMIN" }, { roleEntity: { code: "ADMIN" } }],
    },
    select: { id: true },
  });
  for (const u of adminUsers) {
    await prisma.ticketTechnician.upsert({
      where: { userId: u.id },
      create: { userId: u.id, sortOrder: 0 },
      update: { isActive: true },
    });
  }
  console.log(`OK Técnicos iniciales: ${adminUsers.length} usuario(s) ADMIN`);

  console.log("Catálogos Tickets TI listos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
