import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { OrdenesCompraListInput } from "../validations/ordenes-compra.schema";

export type OrdenCompraNafRow = {
  noCia: string;
  companyCode: string | null;
  noOrden: string;
  noProve: string;
  proveedor: string | null;
  fecha: string | null;
  estado: string;
  observaciones: string | null;
};

export type OrdenesCompraListResult = {
  rows: OrdenCompraNafRow[];
  fetchedAt: string;
};

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asDateIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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

/**
 * Órdenes de compra Codisa/NAF (ARIMENCORDEN).
 * Solo lectura. Filtra por empresa Alfa (`company.code` → `sapCode` = NO_CIA).
 */
export async function listOrdenesCompraNaf(
  input: OrdenesCompraListInput,
): Promise<OrdenesCompraListResult> {
  const noCia = await resolveNoCia(input.company);
  const companyMap = await loadCompanyMap();
  const conditions = ["1=1"];
  const binds: Record<string, unknown> = { maxRows: input.limit };

  if (noCia) {
    conditions.push("e.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const search = input.search?.trim();
  if (search) {
    conditions.push(`(
      UPPER(e.NO_ORDEN) LIKE :searchLike
      OR UPPER(NVL(e.OBSERVACIONES, ' ')) LIKE :searchLike
      OR UPPER(NVL(p.NOMBRE, ' ')) LIKE :searchLike
      OR UPPER(NVL(p.NOMBRE_LARGO, ' ')) LIKE :searchLike
      OR UPPER(e.NO_PROVE) LIKE :searchLike
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
          e.NO_CIA,
          e.NO_ORDEN,
          e.NO_PROVE,
          e.FECHA,
          e.ESTADO,
          e.OBSERVACIONES,
          NVL(p.NOMBRE_LARGO, p.NOMBRE) AS PROVEEDOR
        FROM NAF5.ARIMENCORDEN e
        LEFT JOIN NAF5.ARCPMP p
          ON p.NO_CIA = e.NO_CIA AND p.NO_PROVE = e.NO_PROVE
        WHERE ${whereClause}
        ORDER BY e.FECHA DESC NULLS LAST, e.NO_ORDEN DESC
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
        companyCode: companyMap.get(cia) ?? companyMap.get(cia.replace(/^0+/, "") || cia) ?? null,
        noOrden: asString(row.NO_ORDEN) ?? "",
        noProve: asString(row.NO_PROVE) ?? "",
        proveedor: asString(row.PROVEEDOR),
        fecha: asDateIso(row.FECHA),
        estado: asString(row.ESTADO) ?? "",
        observaciones: asString(row.OBSERVACIONES),
      } satisfies OrdenCompraNafRow;
    });

    return { rows, fetchedAt: new Date().toISOString() };
  });
}
