/**
 * Sincronización CLI: Oracle NAF5.EMPLEADOS_NEW → PostgreSQL (naf_employees).
 */
import { syncNafEmployees } from "../src/modules/empleados-naf/services/sync-employees";

async function main() {
  const result = await syncNafEmployees({ triggeredBy: "cron" });
  console.log(
    JSON.stringify({
      ok: true,
      rowsFetched: result.rowsFetched,
      rowsUpserted: result.rowsUpserted,
      finishedAt: result.finishedAt.toISOString(),
      runId: result.runId,
    }),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
