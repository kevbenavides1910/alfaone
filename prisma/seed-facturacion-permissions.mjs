/**
 * Migra permisos granulares de Facturación y cobro para todos los roles.
 * Hereda de facturacion.cobro → dashboard, documentos_naf, informe_ccss_ins
 * y de facturacion.cxc → config (solo si el rol aún no tiene la clave nueva).
 *
 * Ejecutar: node prisma/seed-facturacion-permissions.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FROM_COBRO = [
  "facturacion.dashboard",
  "facturacion.documentos_naf",
  "facturacion.informe_ccss_ins",
];

const FROM_CXC = ["facturacion.config"];

const LEVEL_ORDER = { NONE: 0, VIEW: 1, EDIT: 2, ADMIN: 3 };

function maxLevel(a, b) {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}

async function main() {
  const roles = await prisma.role.findMany({
    include: { permissions: true },
  });

  for (const role of roles) {
    const byKey = Object.fromEntries(
      role.permissions.map((p) => [p.permissionKey, p.level]),
    );
    const cobro = byKey["facturacion.cobro"];
    const cxc = byKey["facturacion.cxc"];

    const toUpsert = [];

    if (cobro && cobro !== "NONE") {
      for (const key of FROM_COBRO) {
        const existing = byKey[key];
        const level = existing ? maxLevel(existing, cobro) : cobro;
        if (!existing || level !== existing) {
          toUpsert.push({ permissionKey: key, level });
        }
      }
    }

    if (cxc && cxc !== "NONE") {
      for (const key of FROM_CXC) {
        const existing = byKey[key];
        const level = existing ? maxLevel(existing, cxc) : cxc;
        if (!existing || level !== existing) {
          toUpsert.push({ permissionKey: key, level });
        }
      }
    }

    for (const { permissionKey, level } of toUpsert) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionKey: { roleId: role.id, permissionKey },
        },
        create: { roleId: role.id, permissionKey, level },
        update: { level },
      });
    }

    if (toUpsert.length > 0) {
      console.log(
        `  ${role.code}: ${toUpsert.map((p) => `${p.permissionKey}=${p.level}`).join(", ")}`,
      );
    }
  }

  console.log("Permisos de facturación migrados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
