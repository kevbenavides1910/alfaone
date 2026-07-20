/**
 * Añade permisos del módulo Operaciones NAF (OP) al rol ADMIN y SUPERVISOR.
 * Ejecutar: node prisma/seed/seed-naf-operaciones-permissions.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEYS = [
  "nafOperaciones.roles",
  "nafOperaciones.asistencia",
  "nafOperaciones.vacantes",
  "nafOperaciones.programacion",
];

const ROLE_LEVELS = {
  ADMIN: "ADMIN",
  SUPERVISOR: "EDIT",
  CONSULTA: "VIEW",
};

async function main() {
  for (const [roleCode, level] of Object.entries(ROLE_LEVELS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) {
      console.log(`Rol ${roleCode} no encontrado, omitido`);
      continue;
    }
    for (const permissionKey of KEYS) {
      let effectiveLevel = level;
      if (roleCode === "CONSULTA") {
        effectiveLevel = "VIEW";
      } else if (
        roleCode === "SUPERVISOR" &&
        permissionKey === "nafOperaciones.programacion"
      ) {
        effectiveLevel = "EDIT";
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId: role.id, permissionKey } },
        create: { roleId: role.id, permissionKey, level: effectiveLevel },
        update: { level: effectiveLevel },
      });
    }
    console.log(`Permisos naf-operaciones → ${roleCode}`);
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
