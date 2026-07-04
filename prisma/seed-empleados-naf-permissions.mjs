/**
 * Añade permisos del módulo Empleados NAF al rol ADMIN y SUPERVISOR.
 * Ejecutar: node prisma/seed-empleados-naf-permissions.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEYS = ["empleadosNaf.list", "empleadosNaf.sync"];

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
      const effectiveLevel =
        roleCode === "SUPERVISOR" && permissionKey.endsWith(".sync") ? "VIEW" : level;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey } },
        create: { roleId: role.id, permissionKey, level: effectiveLevel },
        update: { level: effectiveLevel },
      });
    }
    console.log(`Permisos empleados NAF → ${roleCode}`);
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
