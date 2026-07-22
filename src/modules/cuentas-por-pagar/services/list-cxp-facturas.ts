import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  labelMonedaCxp,
  resolveCxpEstado,
  type CxpEstadoFilter,
  type CxpEstadoPago,
} from "../business/cxp-status";
import type { CxpFacturasListInput } from "../validations/cxp-list.schema";

export type CxpFacturaRow = {
  id: string;
  noCia: string;
  companyCode: string | null;
  companyName: string | null;
  noProve: string;
  proveedor: string;
  cedula: string | null;
  tipoDoc: string;
  tipoDocDesc: string | null;
  noDocu: string;
  noFisico: string | null;
  serieFisico: string | null;
  fecha: string;
  fechaDocumento: string | null;
  fechaVence: string | null;
  subtotal: number;
  monto: number;
  saldo: number;
  montoAplicado: number;
  nAplicaciones: number;
  moneda: string;
  monedaLabel: string;
  anulado: string | null;
  detalle: string | null;
  estado: CxpEstadoPago;
};

export type CxpFacturasListResult = {
  rows: CxpFacturaRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    count: number;
    monto: number;
    saldo: number;
    pendientes: number;
    parciales: number;
    pagadas: number;
  };
  fetchedAt: string;
};

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function periodBounds(month: number, year: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from, to };
}

async function loadCompanyMap(): Promise<Map<string, { code: string; name: string }>> {
  const rows = await prisma.company.findMany({
    where: { isActive: true, sapCode: { not: null } },
    select: { code: true, name: true, sapCode: true },
  });
  const map = new Map<string, { code: string; name: string }>();
  for (const row of rows) {
    const sap = row.sapCode?.trim();
    if (!sap) continue;
    map.set(sap.padStart(2, "0"), { code: row.code, name: row.name });
    map.set(sap.replace(/^0+/, "") || sap, { code: row.code, name: row.name });
  }
  return map;
}

const APLIC_COUNT_SQL = `(
  SELECT COUNT(*)
  FROM NAF5.ARCPRD r
  WHERE r.NO_CIA = m.NO_CIA
    AND r.TIPO_REFE = m.TIPO_DOC
    AND r.NO_REFE = m.NO_DOCU
)`;

const APLIC_SUM_SQL = `(
  SELECT NVL(SUM(r.MONTO), 0)
  FROM NAF5.ARCPRD r
  WHERE r.NO_CIA = m.NO_CIA
    AND r.TIPO_REFE = m.TIPO_DOC
    AND r.NO_REFE = m.NO_DOCU
)`;

function estadoSqlCondition(estado: CxpEstadoFilter): string | null {
  switch (estado) {
    case "ANULADA":
      return `NVL(m.ANULADO, 'N') = 'S'`;
    case "PAGADA":
      return `NVL(m.ANULADO, 'N') <> 'S' AND NVL(m.SALDO, 0) = 0`;
    case "PARCIAL":
      return `NVL(m.ANULADO, 'N') <> 'S' AND NVL(m.SALDO, 0) > 0 AND ${APLIC_COUNT_SQL} > 0`;
    case "PENDIENTE":
      return `NVL(m.ANULADO, 'N') <> 'S' AND NVL(m.SALDO, 0) > 0 AND ${APLIC_COUNT_SQL} = 0`;
    default:
      return null;
  }
}

function buildWhereClause(
  input: CxpFacturasListInput,
  noCia: string | null,
): { whereClause: string; binds: Record<string, unknown> } {
  const { from, to } = periodBounds(input.periodMonth, input.periodYear);
  const conditions = [
    "m.FECHA >= :fromDate",
    "m.FECHA < :toDate",
    "t.DOCUMENTO = 'F'",
  ];
  const binds: Record<string, unknown> = { fromDate: from, toDate: to };

  if (noCia) {
    conditions.push("m.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const noProve = input.noProve?.trim();
  if (noProve) {
    conditions.push("m.NO_PROVE = :noProve");
    binds.noProve = noProve;
  }

  const tipoDoc = input.tipoDoc?.trim();
  if (tipoDoc) {
    conditions.push("m.TIPO_DOC = :tipoDoc");
    binds.tipoDoc = tipoDoc;
  }

  const search = input.search?.trim();
  if (search) {
    conditions.push(`(
      UPPER(NVL(p.NOMBRE_LARGO, NVL(p.NOMBRE, ' '))) LIKE :searchLike
      OR UPPER(NVL(p.CEDULA, ' ')) LIKE :searchLike
      OR UPPER(m.NO_DOCU) LIKE :searchLike
      OR UPPER(NVL(m.NO_FISICO, ' ')) LIKE :searchLike
      OR UPPER(m.NO_PROVE) LIKE :searchLike
      OR UPPER(NVL(m.DETALLE, ' ')) LIKE :searchLike
    )`);
    binds.searchLike = `%${search.toUpperCase()}%`;
  }

  const estadoCond = estadoSqlCondition(input.estado ?? "ALL");
  if (estadoCond) conditions.push(estadoCond);

  return { whereClause: conditions.join("\n  AND "), binds };
}

function mapRow(
  row: OracleRow,
  companyMap: Map<string, { code: string; name: string }>,
): CxpFacturaRow {
  const noCia = asString(row.NO_CIA) ?? "";
  const company = companyMap.get(noCia) ?? companyMap.get(noCia.padStart(2, "0"));
  const tipoDoc = asString(row.TIPO_DOC) ?? "";
  const noDocu = asString(row.NO_DOCU) ?? "";
  const noProve = asString(row.NO_PROVE) ?? "";
  const saldo = asNumber(row.SALDO);
  const nAplicaciones = asNumber(row.N_APLIC);
  const anulado = asString(row.ANULADO);
  const moneda = asString(row.MONEDA) ?? "P";

  return {
    id: `${noCia}-${noProve}-${tipoDoc}-${noDocu}`,
    noCia,
    companyCode: company?.code ?? null,
    companyName: company?.name ?? null,
    noProve,
    proveedor: asString(row.PROVEEDOR) ?? "—",
    cedula: asString(row.CEDULA),
    tipoDoc,
    tipoDocDesc: asString(row.TIPO_DESC),
    noDocu,
    noFisico: asString(row.NO_FISICO),
    serieFisico: asString(row.SERIE_FISICO),
    fecha: asIsoDate(row.FECHA) ?? new Date(0).toISOString(),
    fechaDocumento: asIsoDate(row.FECHA_DOCUMENTO),
    fechaVence: asIsoDate(row.FECHA_VENCE),
    subtotal: asNumber(row.SUBTOTAL),
    monto: asNumber(row.MONTO),
    saldo,
    montoAplicado: asNumber(row.MONTO_APLIC),
    nAplicaciones,
    moneda,
    monedaLabel: labelMonedaCxp(moneda),
    anulado,
    detalle: asString(row.DETALLE),
    estado: resolveCxpEstado({ anulado, saldo, nAplicaciones }),
  };
}

const LIST_COLUMNS = `
  m.NO_CIA,
  m.NO_PROVE,
  NVL(p.NOMBRE_LARGO, p.NOMBRE) AS PROVEEDOR,
  p.CEDULA,
  m.TIPO_DOC,
  t.DESCRIPCION AS TIPO_DESC,
  m.NO_DOCU,
  m.NO_FISICO,
  m.SERIE_FISICO,
  m.FECHA,
  m.FECHA_DOCUMENTO,
  m.FECHA_VENCE,
  m.SUBTOTAL,
  m.MONTO,
  m.SALDO,
  m.MONEDA,
  m.ANULADO,
  m.DETALLE,
  ${APLIC_COUNT_SQL} AS N_APLIC,
  ${APLIC_SUM_SQL} AS MONTO_APLIC
`;

export async function listCxpFacturas(
  input: CxpFacturasListInput,
): Promise<CxpFacturasListResult> {
  const companyMap = await loadCompanyMap();

  let noCia: string | null = null;
  if (input.company) {
    const companyRow = await prisma.company.findFirst({
      where: { code: input.company, isActive: true },
      select: { sapCode: true },
    });
    const sap = companyRow?.sapCode?.trim();
    if (sap) noCia = sap.padStart(2, "0");
  }

  const { whereClause, binds: filterBinds } = buildWhereClause(input, noCia);
  const offset = (input.page - 1) * input.pageSize;
  const listBinds = {
    ...filterBinds,
    minRow: offset,
    maxRow: offset + input.pageSize,
  };

  return withNafOracleConnection(async (conn) => {
    const summaryResult = await conn.execute(
      `
      SELECT
        COUNT(*) AS CNT,
        NVL(SUM(m.MONTO), 0) AS MONTO,
        NVL(SUM(m.SALDO), 0) AS SALDO,
        NVL(SUM(
          CASE
            WHEN NVL(m.ANULADO, 'N') <> 'S'
             AND NVL(m.SALDO, 0) > 0
             AND ${APLIC_COUNT_SQL} = 0
            THEN 1 ELSE 0
          END
        ), 0) AS PENDIENTES,
        NVL(SUM(
          CASE
            WHEN NVL(m.ANULADO, 'N') <> 'S'
             AND NVL(m.SALDO, 0) > 0
             AND ${APLIC_COUNT_SQL} > 0
            THEN 1 ELSE 0
          END
        ), 0) AS PARCIALES,
        NVL(SUM(
          CASE
            WHEN NVL(m.ANULADO, 'N') <> 'S'
             AND NVL(m.SALDO, 0) = 0
            THEN 1 ELSE 0
          END
        ), 0) AS PAGADAS
      FROM NAF5.ARCPMD m
      JOIN NAF5.ARCPTD t
        ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC
      LEFT JOIN NAF5.ARCPMP p
        ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
      WHERE ${whereClause}
      `,
      filterBinds,
    );
    const summaryRow = (summaryResult.rows?.[0] ?? {}) as OracleRow;
    const total = asNumber(summaryRow.CNT);

    const listResult = await conn.execute(
      `
      SELECT *
      FROM (
        SELECT inner_query.*, ROWNUM AS rnum
        FROM (
          SELECT ${LIST_COLUMNS}
          FROM NAF5.ARCPMD m
          JOIN NAF5.ARCPTD t
            ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC
          LEFT JOIN NAF5.ARCPMP p
            ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
          WHERE ${whereClause}
          ORDER BY m.FECHA DESC, m.NO_DOCU DESC
        ) inner_query
        WHERE ROWNUM <= :maxRow
      )
      WHERE rnum > :minRow
      `,
      listBinds,
    );

    const rows = (listResult.rows ?? []).map((row) =>
      mapRow(row as OracleRow, companyMap),
    );

    return {
      rows,
      total,
      page: input.page,
      pageSize: input.pageSize,
      summary: {
        count: total,
        monto: asNumber(summaryRow.MONTO),
        saldo: asNumber(summaryRow.SALDO),
        pendientes: asNumber(summaryRow.PENDIENTES),
        parciales: asNumber(summaryRow.PARCIALES),
        pagadas: asNumber(summaryRow.PAGADAS),
      },
      fetchedAt: new Date().toISOString(),
    };
  });
}
