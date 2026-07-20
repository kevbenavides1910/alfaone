/**
 * Sincronización CLI: Oracle NAF5.ARPLHS → PostgreSQL (naf_nomina_summary).
 */
import { syncNafNomina } from "../src/modules/empleados-naf/services/sync-nomina";

async function main() {
  const desdeAnoRaw = process.argv[2];
  const desdeAno = desdeAnoRaw ? Number.parseInt(desdeAnoRaw, 10) : undefined;
  if (desdeAnoRaw && (desdeAno == null || Number.isNaN(desdeAno))) {
    throw new Error(`desdeAno inválido: ${desdeAnoRaw}`);
  }

  const result = await syncNafNomina({ triggeredBy: "cron", desdeAno });
  console.log(
    JSON.stringify({
      ok: true,
      rowsFetched: result.rowsFetched,
      rowsUpserted: result.rowsUpserted,
      desdeAno: result.desdeAno,
      finishedAt: result.finishedAt.toISOString(),
      runId: result.runId,
    }),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
