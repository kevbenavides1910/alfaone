/**
 * Crea documentos CxC (FC) para facturas mensuales ya cerradas que aún no tienen fila en cuentas por cobrar.
 * Uso: npm run db:sync-cxc-from-facturas
 */
import { PrismaClient } from "@prisma/client";
import { syncAllMissingCxcFromFacturas } from "../src/modules/presupuestos/services/sync-cxc-from-factura";

const prisma = new PrismaClient();

async function main() {
  const result = await syncAllMissingCxcFromFacturas(prisma);
  console.log(`Facturas revisadas: ${result.processed}`);
  console.log(`Documentos CxC creados: ${result.created}`);
  console.log(`Documentos CxC actualizados: ${result.updated}`);
  if (result.errors.length > 0) {
    console.log("Errores:");
    for (const err of result.errors) console.log(`  - ${err}`);
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
