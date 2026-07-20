import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

const NAF_ROLE_CONTRACTS_QUERY = `
SELECT
  NO_CIA_GRUPO,
  NO_ROL,
  NO_CONTRATO,
  NO_UBICACION,
  ESTADO
FROM NAF5.AROPMR
WHERE NO_CONTRATO IS NOT NULL
  AND TRIM(NO_CONTRATO) IS NOT NULL
`;

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

export async function syncNafRoleContracts(): Promise<{ rowsUpserted: number }> {
  const rows = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute<OracleRow>(NAF_ROLE_CONTRACTS_QUERY);
    return result.rows ?? [];
  });

  const syncedAt = new Date();
  let rowsUpserted = 0;
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((row) => {
        const noCiaGrupo = asString(row.NO_CIA_GRUPO);
        const noRol = asString(row.NO_ROL);
        const noContrato = asString(row.NO_CONTRATO);
        const noUbicacion = asString(row.NO_UBICACION);
        const estado = asString(row.ESTADO);
        if (!noCiaGrupo || !noRol || !noContrato) {
          throw new Error("Fila AROPMR incompleta");
        }
        return prisma.nafRoleContract.upsert({
          where: {
            noCiaGrupo_noRol_noContrato_noUbicacion: {
              noCiaGrupo,
              noRol,
              noContrato,
              noUbicacion: noUbicacion ?? "",
            },
          },
          create: {
            noCiaGrupo,
            noRol,
            noContrato,
            noUbicacion: noUbicacion ?? "",
            estado,
            syncedAt,
          },
          update: {
            noUbicacion: noUbicacion ?? "",
            estado,
            syncedAt,
          },
        });
      }),
    );
    rowsUpserted += batch.length;
  }

  return { rowsUpserted };
}
