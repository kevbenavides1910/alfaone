/**
 * Añade permisos del módulo Monitoreo al rol ADMIN y SUPERVISOR.
 * Ejecutar: node prisma/seed-bandeco-permissions.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEYS = [
  "monitoreo.consulta",
  "monitoreo.operacion",
  "monitoreo.registros",
  "monitoreo.mantenimientos",
];

const ROLE_LEVELS = {
  ADMIN: "ADMIN",
  SUPERVISOR: "EDIT",
};

async function main() {
  for (const [roleCode, level] of Object.entries(ROLE_LEVELS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      console.log(`Rol ${roleCode} no encontrado, omitido`);
      continue;
    }
    for (const permissionKey of KEYS) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey } },
        create: { roleId: role.id, permissionKey, level },
        update: { level },
      });
    }
    console.log(`Permisos monitoreo → ${roleCode} (${level})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
