/**
 * Importa presupuesto completo desde Excel PANI en cargas/.
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/import-pani-presupuesto.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  importPresupuestoFromPaniExcel,
  resolvePaniExcelPath,
} from "../src/modules/ventas/services/presupuesto-pani-import";

const prisma = new PrismaClient();

async function main() {
  const customPath = process.argv[2];
  const filePath = resolvePaniExcelPath(customPath);
  console.log("Importando desde:", filePath);

  const stats = await importPresupuestoFromPaniExcel(prisma, filePath, {
    syncCatalog: true,
    replaceExisting: true,
  });

  console.log("Importación completada:");
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
