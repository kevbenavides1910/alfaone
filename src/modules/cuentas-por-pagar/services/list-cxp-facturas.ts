import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  labelFaeAceptacion,
  labelMonedaCxp,
  resolveCxpEstado,
  type CxpEstadoFilter,
  type CxpEstadoPago,
  type CxpFaeLinkFilter,
} from "../business/cxp-status";
import type { CxpFacturasListInput } from "../validations/cxp-list.schema";

export type CxpFacturaRow = {
  id: string;
  origen: "CXP" | "FAE";
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
  /** Trazabilidad FAE compras */
  faeIdEncabezado: number | null;
  faeConsecutivo: string | null;
  faeClave: string | null;
  faeFecha: string | null;
  faeTotal: number | null;
  faeMoneda: string | null;
  faeAceptacion: string | null;
  faeAceptacionLabel: string;
  faeProcesado: boolean | null;
  faeFhProcesado: string | null;
  faeEstadoHacienda: string | null;
  faeTipoDoc: string | null;
  conFae: boolean;
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
    sinCxp: number;
    conFae: number;
    sinFae: number;
    faePendiente: number;
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
  WHERE r.NO_CIA = u.NO_CIA
    AND r.TIPO_REFE = u.TIPO_DOC
    AND r.NO_REFE = u.NO_DOCU
)`;

const APLIC_SUM_SQL = `(
  SELECT NVL(SUM(r.MONTO), 0)
  FROM NAF5.ARCPRD r
  WHERE r.NO_CIA = u.NO_CIA
    AND r.TIPO_REFE = u.TIPO_DOC
    AND r.NO_REFE = u.NO_DOCU
)`;

/**
 * Match CXP NO_FISICO ↔ FAE EMISOR_CONSECUTIVO.
 * En FE CR el consecutivo es 20 chars; el número de documento son los últimos 10
 * (p.ej. …0000016662 → 16662). Usar -12 deja un "1" de la terminal y rompe el join.
 */
const FAE_FISICO_NORM = `LTRIM(SUBSTR(TRIM(e.EMISOR_CONSECUTIVO), -10), '0')`;
const FAE_FISICO_MATCH = `
  ${FAE_FISICO_NORM} = LTRIM(TRIM(m.NO_FISICO), '0')
`;

const FAE_CEDULA_MATCH = `
  REGEXP_REPLACE(NVL(e.EMISOR_IDENTIFICACION, ' '), '[^0-9]', '') =
  REGEXP_REPLACE(NVL(p.CEDULA, ' '), '[^0-9]', '')
`;

function estadoSqlCondition(estado: CxpEstadoFilter): string | null {
  switch (estado) {
    case "ANULADA":
      return `u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') = 'S'`;
    case "PAGADA":
      return `u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') <> 'S' AND NVL(u.SALDO, 0) = 0`;
    case "PARCIAL":
      return `u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') <> 'S' AND NVL(u.SALDO, 0) > 0 AND ${APLIC_COUNT_SQL} > 0`;
    case "PENDIENTE":
      return `u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') <> 'S' AND NVL(u.SALDO, 0) > 0 AND ${APLIC_COUNT_SQL} = 0`;
    case "SIN_CXP":
      return `u.ORIGEN = 'FAE'`;
    default:
      return null;
  }
}

function faeLinkSqlCondition(faeLink: CxpFaeLinkFilter): string | null {
  switch (faeLink) {
    case "CON_FAE":
      return `u.FAE_ID_ENCABEZADO IS NOT NULL`;
    case "SIN_FAE":
      return `u.ORIGEN = 'CXP' AND u.FAE_ID_ENCABEZADO IS NULL`;
    case "FAE_PENDIENTE":
      return `TRIM(NVL(u.FAE_IND_ACEPTACION, ' ')) = 'P'`;
    default:
      return null;
  }
}

function buildOuterFilters(
  input: CxpFacturasListInput,
): { whereClause: string; binds: Record<string, unknown> } {
  const conditions: string[] = ["1=1"];
  const binds: Record<string, unknown> = {};

  const estadoCond = estadoSqlCondition(input.estado ?? "ALL");
  if (estadoCond) conditions.push(estadoCond);

  const faeCond = faeLinkSqlCondition(input.faeLink ?? "ALL");
  if (faeCond) conditions.push(faeCond);

  return { whereClause: conditions.join("\n  AND "), binds };
}

function buildCxpInnerWhere(
  input: CxpFacturasListInput,
  noCia: string | null,
): { whereClause: string; binds: Record<string, unknown> } {
  const { from, to } = periodBounds(input.periodMonth, input.periodYear);
  const conditions = [
    "t.DOCUMENTO = 'F'",
    `(
      (m.FECHA >= :fromDate AND m.FECHA < :toDate)
      OR EXISTS (
        SELECT 1
        FROM FAE.FAE_COMPRAS_ENCABEZADOS ex
        JOIN FAE.FAE_COMPANIAS fcx ON fcx.ID_COMPANIA = ex.ID_COMPANIA
        WHERE fcx.NO_CIA = m.NO_CIA
          AND m.NO_FISICO IS NOT NULL
          AND REGEXP_REPLACE(NVL(ex.EMISOR_IDENTIFICACION, ' '), '[^0-9]', '') =
              REGEXP_REPLACE(NVL(p.CEDULA, ' '), '[^0-9]', '')
          AND LTRIM(SUBSTR(TRIM(ex.EMISOR_CONSECUTIVO), -10), '0') = LTRIM(TRIM(m.NO_FISICO), '0')
          AND ex.FECHA >= :fromDate AND ex.FECHA < :toDate
      )
    )`,
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
      OR EXISTS (
        SELECT 1
        FROM FAE.FAE_COMPRAS_ENCABEZADOS es
        JOIN FAE.FAE_COMPANIAS fcs ON fcs.ID_COMPANIA = es.ID_COMPANIA
        WHERE fcs.NO_CIA = m.NO_CIA
          AND m.NO_FISICO IS NOT NULL
          AND REGEXP_REPLACE(NVL(es.EMISOR_IDENTIFICACION, ' '), '[^0-9]', '') =
              REGEXP_REPLACE(NVL(p.CEDULA, ' '), '[^0-9]', '')
          AND LTRIM(SUBSTR(TRIM(es.EMISOR_CONSECUTIVO), -10), '0') = LTRIM(TRIM(m.NO_FISICO), '0')
          AND (
            UPPER(NVL(es.EMISOR_CONSECUTIVO, ' ')) LIKE :searchLike
            OR UPPER(NVL(es.EMISOR_CLAVE, ' ')) LIKE :searchLike
          )
      )
    )`);
    binds.searchLike = `%${search.toUpperCase()}%`;
  }

  return { whereClause: conditions.join("\n  AND "), binds };
}

function buildFaeOnlyWhere(
  input: CxpFacturasListInput,
  noCia: string | null,
): { whereClause: string; binds: Record<string, unknown> } {
  const { from, to } = periodBounds(input.periodMonth, input.periodYear);
  const conditions = [
    "e.FECHA >= :fromDate AND e.FECHA < :toDate",
    // Solo facturas electrónicas de compra (tipo 01), no NC/ND salvo que busquen todo
    "NVL(e.EMISOR_TIPO_DOCUMENTO, '01') IN ('01', '04')",
    `NOT EXISTS (
      SELECT 1
      FROM NAF5.ARCPMD m
      JOIN NAF5.ARCPTD t ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC AND t.DOCUMENTO = 'F'
      JOIN NAF5.ARCPMP p ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
      WHERE m.NO_CIA = fc.NO_CIA
        AND m.NO_FISICO IS NOT NULL
        AND ${FAE_CEDULA_MATCH}
        AND ${FAE_FISICO_MATCH}
    )`,
  ];
  const binds: Record<string, unknown> = { fromDate: from, toDate: to };

  if (noCia) {
    conditions.push("fc.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const noProve = input.noProve?.trim();
  if (noProve) {
    // FAE-only no tiene NO_PROVE CXP; filtrar por cédula del proveedor CXP si existe
    conditions.push(`EXISTS (
      SELECT 1 FROM NAF5.ARCPMP px
      WHERE px.NO_CIA = fc.NO_CIA
        AND px.NO_PROVE = :noProve
        AND REGEXP_REPLACE(NVL(px.CEDULA, ' '), '[^0-9]', '') =
            REGEXP_REPLACE(NVL(e.EMISOR_IDENTIFICACION, ' '), '[^0-9]', '')
    )`);
    binds.noProve = noProve;
  }

  // tipoDoc CXP no aplica a FAE-only salvo ALL
  const tipoDoc = input.tipoDoc?.trim();
  if (tipoDoc) {
    conditions.push("1=0");
  }

  const search = input.search?.trim();
  if (search) {
    conditions.push(`(
      UPPER(NVL(e.EMISOR_NOMBRE, ' ')) LIKE :searchLike
      OR UPPER(NVL(e.EMISOR_IDENTIFICACION, ' ')) LIKE :searchLike
      OR UPPER(NVL(e.EMISOR_CONSECUTIVO, ' ')) LIKE :searchLike
      OR UPPER(NVL(e.EMISOR_CLAVE, ' ')) LIKE :searchLike
      OR UPPER(LTRIM(SUBSTR(TRIM(e.EMISOR_CONSECUTIVO), -10), '0')) LIKE :searchLike
    )`);
    binds.searchLike = `%${search.toUpperCase()}%`;
  }

  return { whereClause: conditions.join("\n  AND "), binds };
}

function mapRow(
  row: OracleRow,
  companyMap: Map<string, { code: string; name: string }>,
): CxpFacturaRow {
  const origen = (asString(row.ORIGEN) ?? "CXP") as "CXP" | "FAE";
  const noCia = asString(row.NO_CIA) ?? "";
  const company = companyMap.get(noCia) ?? companyMap.get(noCia.padStart(2, "0"));
  const tipoDoc = asString(row.TIPO_DOC) ?? "";
  const noDocu = asString(row.NO_DOCU) ?? "";
  const noProve = asString(row.NO_PROVE) ?? "";
  const saldo = asNumber(row.SALDO);
  const nAplicaciones = asNumber(row.N_APLIC);
  const anulado = asString(row.ANULADO);
  const moneda = asString(row.MONEDA) ?? (asString(row.FAE_MONEDA) ?? "P");
  const faeId = row.FAE_ID_ENCABEZADO == null ? null : asNumber(row.FAE_ID_ENCABEZADO);
  const faeAceptacion = asString(row.FAE_IND_ACEPTACION);
  const procesadoRaw = asString(row.FAE_PROCESADO);

  return {
    id:
      origen === "FAE"
        ? `FAE-${noCia}-${faeId ?? noDocu}`
        : `${noCia}-${noProve}-${tipoDoc}-${noDocu}`,
    origen,
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
    estado: resolveCxpEstado({
      anulado,
      saldo,
      nAplicaciones,
      sinCxp: origen === "FAE",
    }),
    faeIdEncabezado: faeId,
    faeConsecutivo: asString(row.FAE_CONSECUTIVO),
    faeClave: asString(row.FAE_CLAVE),
    faeFecha: asIsoDate(row.FAE_FECHA),
    faeTotal: row.FAE_TOTAL == null ? null : asNumber(row.FAE_TOTAL),
    faeMoneda: asString(row.FAE_MONEDA),
    faeAceptacion,
    faeAceptacionLabel:
      asString(row.FAE_DESC_ACEPTACION) ?? labelFaeAceptacion(faeAceptacion),
    faeProcesado:
      procesadoRaw == null ? null : procesadoRaw === "1" || procesadoRaw.toUpperCase() === "S",
    faeFhProcesado: asIsoDate(row.FAE_FH_PROCESADO),
    faeEstadoHacienda: asString(row.FAE_ESTADO_HACIENDA),
    faeTipoDoc: asString(row.FAE_TIPO_DOC),
    conFae: faeId != null,
  };
}

/**
 * Union:
 * 1) Facturas CXP del período (o con FAE en el período) + LEFT JOIN FAE
 * 2) Compras FAE del período sin documento CXP amarrado por cédula+físico
 */
function buildUnionSql(
  cxpWhere: string,
  faeWhere: string,
  includeFaeOnly: boolean,
): string {
  const cxpPart = `
    SELECT
      'CXP' AS ORIGEN,
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
      fae.ID_ENCABEZADO AS FAE_ID_ENCABEZADO,
      fae.EMISOR_CONSECUTIVO AS FAE_CONSECUTIVO,
      fae.EMISOR_CLAVE AS FAE_CLAVE,
      fae.FECHA AS FAE_FECHA,
      fae.TOTAL_COMPROBANTE AS FAE_TOTAL,
      fae.CODIGO_MONEDA AS FAE_MONEDA,
      fae.IND_ACEPTACION AS FAE_IND_ACEPTACION,
      fae.DESC_IND_ACEPTACION AS FAE_DESC_ACEPTACION,
      fae.PROCESADO AS FAE_PROCESADO,
      fae.FH_PROCESADO AS FAE_FH_PROCESADO,
      fae.ESTADO_RESPUESTA_DOC AS FAE_ESTADO_HACIENDA,
      fae.EMISOR_TIPO_DOCUMENTO AS FAE_TIPO_DOC
    FROM NAF5.ARCPMD m
    JOIN NAF5.ARCPTD t
      ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC
    LEFT JOIN NAF5.ARCPMP p
      ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
    LEFT JOIN (
      SELECT
        e.ID_ENCABEZADO,
        e.EMISOR_CONSECUTIVO,
        e.EMISOR_CLAVE,
        e.FECHA,
        e.TOTAL_COMPROBANTE,
        e.CODIGO_MONEDA,
        e.IND_ACEPTACION,
        e.DESC_IND_ACEPTACION,
        e.PROCESADO,
        e.FH_PROCESADO,
        e.ESTADO_RESPUESTA_DOC,
        e.EMISOR_TIPO_DOCUMENTO,
        e.EMISOR_IDENTIFICACION,
        fc.NO_CIA AS FAE_NO_CIA,
        LTRIM(SUBSTR(TRIM(e.EMISOR_CONSECUTIVO), -10), '0') AS FISICO_NORM,
        REGEXP_REPLACE(NVL(e.EMISOR_IDENTIFICACION, ' '), '[^0-9]', '') AS CED_NORM,
        ROW_NUMBER() OVER (
          PARTITION BY
            fc.NO_CIA,
            REGEXP_REPLACE(NVL(e.EMISOR_IDENTIFICACION, ' '), '[^0-9]', ''),
            LTRIM(SUBSTR(TRIM(e.EMISOR_CONSECUTIVO), -10), '0')
          ORDER BY e.FECHA DESC, e.ID_ENCABEZADO DESC
        ) AS rn
      FROM FAE.FAE_COMPRAS_ENCABEZADOS e
      JOIN FAE.FAE_COMPANIAS fc ON fc.ID_COMPANIA = e.ID_COMPANIA
    ) fae
      ON fae.rn = 1
     AND fae.FAE_NO_CIA = m.NO_CIA
     AND m.NO_FISICO IS NOT NULL
     AND fae.CED_NORM = REGEXP_REPLACE(NVL(p.CEDULA, ' '), '[^0-9]', '')
     AND fae.FISICO_NORM = LTRIM(TRIM(m.NO_FISICO), '0')
    WHERE ${cxpWhere}
  `;

  if (!includeFaeOnly) return cxpPart;

  const faePart = `
    SELECT
      'FAE' AS ORIGEN,
      fc.NO_CIA,
      CAST(NULL AS VARCHAR2(20)) AS NO_PROVE,
      e.EMISOR_NOMBRE AS PROVEEDOR,
      e.EMISOR_IDENTIFICACION AS CEDULA,
      'FE' AS TIPO_DOC,
      'Comprobante FAE sin CXP' AS TIPO_DESC,
      e.EMISOR_CONSECUTIVO AS NO_DOCU,
      LTRIM(SUBSTR(TRIM(e.EMISOR_CONSECUTIVO), -10), '0') AS NO_FISICO,
      CAST(NULL AS VARCHAR2(20)) AS SERIE_FISICO,
      e.FECHA,
      e.FECHA AS FECHA_DOCUMENTO,
      CAST(NULL AS DATE) AS FECHA_VENCE,
      NVL(e.TOTAL_VENTA_NETA, 0) AS SUBTOTAL,
      NVL(e.TOTAL_COMPROBANTE, 0) AS MONTO,
      NVL(e.TOTAL_COMPROBANTE, 0) AS SALDO,
      NVL(e.CODIGO_MONEDA, 'CRC') AS MONEDA,
      'N' AS ANULADO,
      CAST(NULL AS VARCHAR2(400)) AS DETALLE,
      e.ID_ENCABEZADO AS FAE_ID_ENCABEZADO,
      e.EMISOR_CONSECUTIVO AS FAE_CONSECUTIVO,
      e.EMISOR_CLAVE AS FAE_CLAVE,
      e.FECHA AS FAE_FECHA,
      e.TOTAL_COMPROBANTE AS FAE_TOTAL,
      e.CODIGO_MONEDA AS FAE_MONEDA,
      e.IND_ACEPTACION AS FAE_IND_ACEPTACION,
      e.DESC_IND_ACEPTACION AS FAE_DESC_ACEPTACION,
      e.PROCESADO AS FAE_PROCESADO,
      e.FH_PROCESADO AS FAE_FH_PROCESADO,
      e.ESTADO_RESPUESTA_DOC AS FAE_ESTADO_HACIENDA,
      e.EMISOR_TIPO_DOCUMENTO AS FAE_TIPO_DOC
    FROM FAE.FAE_COMPRAS_ENCABEZADOS e
    JOIN FAE.FAE_COMPANIAS fc ON fc.ID_COMPANIA = e.ID_COMPANIA
    WHERE ${faeWhere}
  `;

  return `${cxpPart}\n    UNION ALL\n${faePart}`;
}

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

  const estado = input.estado ?? "ALL";
  const includeFaeOnly =
    estado === "ALL" || estado === "SIN_CXP";

  const cxpInner = buildCxpInnerWhere(input, noCia);
  const faeInner = buildFaeOnlyWhere(input, noCia);
  const outer = buildOuterFilters(input);

  const unionSql = buildUnionSql(
    cxpInner.whereClause,
    faeInner.whereClause,
    includeFaeOnly,
  );

  const filterBinds: Record<string, unknown> = {
    ...cxpInner.binds,
    ...(includeFaeOnly ? faeInner.binds : {}),
    ...outer.binds,
  };

  const offset = (input.page - 1) * input.pageSize;
  const listBinds = {
    ...filterBinds,
    minRow: offset,
    maxRow: offset + input.pageSize,
  };

  const fromUnion = `
    FROM (
      ${unionSql}
    ) u
    WHERE ${outer.whereClause}
  `;

  return withNafOracleConnection(async (conn) => {
    const summaryResult = await conn.execute(
      `
      SELECT
        COUNT(*) AS CNT,
        NVL(SUM(u.MONTO), 0) AS MONTO,
        NVL(SUM(CASE WHEN u.ORIGEN = 'CXP' THEN u.SALDO ELSE 0 END), 0) AS SALDO,
        NVL(SUM(
          CASE
            WHEN u.ORIGEN = 'CXP'
             AND NVL(u.ANULADO, 'N') <> 'S'
             AND NVL(u.SALDO, 0) > 0
             AND ${APLIC_COUNT_SQL} = 0
            THEN 1 ELSE 0
          END
        ), 0) AS PENDIENTES,
        NVL(SUM(
          CASE
            WHEN u.ORIGEN = 'CXP'
             AND NVL(u.ANULADO, 'N') <> 'S'
             AND NVL(u.SALDO, 0) > 0
             AND ${APLIC_COUNT_SQL} > 0
            THEN 1 ELSE 0
          END
        ), 0) AS PARCIALES,
        NVL(SUM(
          CASE
            WHEN u.ORIGEN = 'CXP'
             AND NVL(u.ANULADO, 'N') <> 'S'
             AND NVL(u.SALDO, 0) = 0
            THEN 1 ELSE 0
          END
        ), 0) AS PAGADAS,
        NVL(SUM(CASE WHEN u.ORIGEN = 'FAE' THEN 1 ELSE 0 END), 0) AS SIN_CXP,
        NVL(SUM(CASE WHEN u.FAE_ID_ENCABEZADO IS NOT NULL THEN 1 ELSE 0 END), 0) AS CON_FAE,
        NVL(SUM(
          CASE
            WHEN u.ORIGEN = 'CXP' AND u.FAE_ID_ENCABEZADO IS NULL THEN 1 ELSE 0
          END
        ), 0) AS SIN_FAE,
        NVL(SUM(
          CASE
            WHEN TRIM(NVL(u.FAE_IND_ACEPTACION, ' ')) = 'P' THEN 1 ELSE 0
          END
        ), 0) AS FAE_PENDIENTE
      ${fromUnion}
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
          SELECT
            u.*,
            CASE WHEN u.ORIGEN = 'CXP' THEN ${APLIC_COUNT_SQL} ELSE 0 END AS N_APLIC,
            CASE WHEN u.ORIGEN = 'CXP' THEN ${APLIC_SUM_SQL} ELSE 0 END AS MONTO_APLIC
          ${fromUnion}
          ORDER BY NVL(u.FAE_FECHA, u.FECHA) DESC, u.NO_DOCU DESC
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
        sinCxp: asNumber(summaryRow.SIN_CXP),
        conFae: asNumber(summaryRow.CON_FAE),
        sinFae: asNumber(summaryRow.SIN_FAE),
        faePendiente: asNumber(summaryRow.FAE_PENDIENTE),
      },
      fetchedAt: new Date().toISOString(),
    };
  });
}
