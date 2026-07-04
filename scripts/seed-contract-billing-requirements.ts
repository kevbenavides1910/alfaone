/**
 * Agrega requisitos de facturación por defecto a todos los contratos existentes (idempotente).
 * Uso: npm run db:seed-billing-requirements
 */
import { PrismaClient } from "@prisma/client";
import {
  contractNeedsSicereRequirement,
  ensureDefaultBillingRequirements,
} from "../src/modules/presupuestos/business/contractBillingRequirementsDefaults";

const prisma = new PrismaClient();

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, licitacionNo: true, client: true, notes: true },
    orderBy: { licitacionNo: "asc" },
  });

  let totalAdded = 0;
  let withSicere = 0;
  let touched = 0;

  for (const c of contracts) {
    const needsSicere = contractNeedsSicereRequirement(c);
    if (needsSicere) withSicere++;

    const { added } = await ensureDefaultBillingRequirements(prisma, c.id, c);
    if (added.length > 0) {
      touched++;
      totalAdded += added.length;
      console.log(`${c.licitacionNo}: +${added.length} (${added.join(", ")})`);
    }
  }

  console.log("\n=== Requisitos de facturación por defecto ===");
  console.log(`Contratos activos en sistema: ${contracts.length}`);
  console.log(`Contratos con SICERE (área de salud / AS): ${withSicere}`);
  console.log(`Contratos actualizados: ${touched}`);
  console.log(`Requisitos agregados en total: ${totalAdded}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
