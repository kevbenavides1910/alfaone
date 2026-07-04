/**
 * Asigna rol ENCARGADO_DISCIPLINARIO a usuarios que son administradores
 * disciplinarios por zona (correo en catálogo Zonas).
 *
 * Ejecutar: node prisma/assign-encargado-disciplinario-users.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const role = await prisma.role.findUnique({
    where: { code: "ENCARGADO_DISCIPLINARIO" },
    select: { id: true, code: true, name: true },
  });
  if (!role) {
    console.error("Rol ENCARGADO_DISCIPLINARIO no existe. Créelo en Mantenimiento → Roles.");
    process.exit(1);
  }

  const zones = await prisma.zone.findMany({
    where: { disciplinaryAdministratorEmail: { not: null } },
    select: { name: true, disciplinaryAdministratorEmail: true },
  });

  const emails = [
    ...new Set(
      zones
        .map((z) => z.disciplinaryAdministratorEmail?.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  if (emails.length === 0) {
    console.log("No hay correos de administrador disciplinario en zonas.");
    return;
  }

  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true, email: true, roleId: true, roleEntity: { select: { code: true } } },
  });

  let updated = 0;
  for (const user of users) {
    if (user.roleId === role.id) {
      console.log(`  OK ${user.email} (ya tiene ${role.code})`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { roleId: role.id },
    });
    console.log(
      `  ${user.email}: ${user.roleEntity?.code ?? "?"} → ${role.code}`,
    );
    updated += 1;
  }

  const missing = emails.filter(
    (e) => !users.some((u) => u.email.toLowerCase() === e),
  );
  if (missing.length) {
    console.log("Correos en zonas sin usuario en el sistema:");
    for (const e of missing) console.log(`  - ${e}`);
  }

  console.log(updated > 0 ? `Listo: ${updated} usuario(s) actualizado(s).` : "Nada que actualizar.");
  console.log("Los usuarios deben cerrar sesión y volver a entrar (o refrescar) para ver botones Tratar/Cerrar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
