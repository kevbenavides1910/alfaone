import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { CxpProveedoresListInput } from "../validations/cxp-list.schema";

export type CxpProveedorRow = {
  noCia: string;
  companyCode: string | null;
  noProve: string;
  nombre: string;
  cedula: string | null;
  bloqueado: boolean;
};

export type CxpProveedoresListResult = {
  rows: CxpProveedorRow[];
  fetchedAt: string;
};

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

async function resolveNoCia(companyCode?: string): Promise<string | null> {
  if (!companyCode?.trim()) return null;
  const companyRow = await prisma.company.findFirst({
    where: { code: companyCode.trim(), isActive: true },
    select: { sapCode: true },
  });
  const sap = companyRow?.sapCode?.trim();
  return sap ? sap.padStart(2, "0") : null;
}

async function loadCompanyMap(): Promise<Map<string, string>> {
  const rows = await prisma.company.findMany({
    where: { isActive: true, sapCode: { not: null } },
    select: { code: true, sapCode: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const sap = row.sapCode?.trim();
    if (!sap) continue;
    map.set(sap.padStart(2, "0"), row.code);
    map.set(sap.replace(/^0+/, "") || sap, row.code);
  }
  return map;
}

export async function listCxpProveedores(
  input: CxpProveedoresListInput,
): Promise<CxpProveedoresListResult> {
  const noCia = await resolveNoCia(input.company);
  const companyMap = await loadCompanyMap();
  const conditions = ["1=1"];
  const binds: Record<string, unknown> = { maxRows: input.limit };

  if (noCia) {
    conditions.push("p.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const search = input.search?.trim();
  if (search) {
    conditions.push(`(
      UPPER(NVL(p.NOMBRE_LARGO, NVL(p.NOMBRE, ' '))) LIKE :searchLike
      OR UPPER(NVL(p.CEDULA, ' ')) LIKE :searchLike
      OR UPPER(p.NO_PROVE) LIKE :searchLike
    )`);
    binds.searchLike = `%${search.toUpperCase()}%`;
  }

  const whereClause = conditions.join("\n  AND ");

  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `
      SELECT *
      FROM (
        SELECT
          p.NO_CIA,
          p.NO_PROVE,
          NVL(p.NOMBRE_LARGO, p.NOMBRE) AS NOMBRE,
          p.CEDULA,
          p.BLOQUEADO
        FROM NAF5.ARCPMP p
        WHERE ${whereClause}
        ORDER BY NVL(p.NOMBRE_LARGO, p.NOMBRE), p.NO_PROVE
      )
      WHERE ROWNUM <= :maxRows
      `,
      binds,
    );

    const rows = (result.rows ?? []).map((raw) => {
      const row = raw as OracleRow;
      const cia = asString(row.NO_CIA) ?? "";
      return {
        noCia: cia,
        companyCode: companyMap.get(cia) ?? companyMap.get(cia.padStart(2, "0")) ?? null,
        noProve: asString(row.NO_PROVE) ?? "",
        nombre: asString(row.NOMBRE) ?? "—",
        cedula: asString(row.CEDULA),
        bloqueado: (asString(row.BLOQUEADO) ?? "N").toUpperCase() === "S",
      };
    });

    return { rows, fetchedAt: new Date().toISOString() };
  });
}
