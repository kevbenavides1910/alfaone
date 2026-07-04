/**
 * Alinea disciplinario.empleados con disciplinario.historial cuando el rol puede
 * editar historial pero no tiene edición en Tratamiento (p. ej. encargado disciplinario).
 *
 * Ejecutar: node prisma/sync-disciplinario-empleados-permissions.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEVEL_RANK = { NONE: 0, VIEW: 1, EDIT: 2, ADMIN: 3 };

function maxLevel(a, b) {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

async function main() {
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        where: {
          permissionKey: { in: ["disciplinario.historial", "disciplinario.empleados"] },
        },
      },
    },
  });

  let updated = 0;

  for (const role of roles) {
    const historial = role.permissions.find((p) => p.permissionKey === "disciplinario.historial");
    const empleados = role.permissions.find((p) => p.permissionKey === "disciplinario.empleados");

    const historialLevel = historial?.level ?? "NONE";
    const empleadosLevel = empleados?.level ?? "NONE";

    if (LEVEL_RANK[historialLevel] < LEVEL_RANK.EDIT) continue;
    if (LEVEL_RANK[empleadosLevel] >= LEVEL_RANK[historialLevel]) continue;

    const target = maxLevel(historialLevel, empleadosLevel);

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionKey: {
          roleId: role.id,
          permissionKey: "disciplinario.empleados",
        },
      },
      create: {
        roleId: role.id,
        permissionKey: "disciplinario.empleados",
        level: target,
      },
      update: { level: target },
    });

    console.log(
      `  ${role.code}: disciplinario.empleados ${empleadosLevel} → ${target} (historial=${historialLevel})`,
    );
    updated += 1;
  }

  console.log(updated > 0 ? `Listo: ${updated} rol(es) actualizado(s).` : "Nada que sincronizar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
