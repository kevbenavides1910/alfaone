/**
 * Conciliación Codisa ↔ Alfa-One → codisa_contract_extensions
 *
 * Uso:
 *   npx tsx scripts/reconcile-codisa-contract-ext.ts
 *   npx tsx scripts/reconcile-codisa-contract-ext.ts --dry-run
 */

import { prisma } from "@/modules/core/db/prisma";
import { reconcileCodisaContractExtensions } from "@/modules/presupuestos/services/codisa-contract-reconcile";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[codisa-ext] iniciando${dryRun ? " (dry-run)" : ""}…`);
  const result = await reconcileCodisaContractExtensions(prisma, { dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (result.unmatchedAlfa.length) {
    console.log(`[codisa-ext] Solo en Alfa-One (${result.unmatchedAlfa.length}):`);
    for (const n of result.unmatchedAlfa.slice(0, 40)) console.log(" -", n);
    if (result.unmatchedAlfa.length > 40) {
      console.log(` … y ${result.unmatchedAlfa.length - 40} más`);
    }
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
