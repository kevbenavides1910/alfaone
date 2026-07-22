import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  labelFaeAceptacion,
  labelMonedaCxp,
  resolveCxpEstado,
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
  // month === 0 → todos los meses del año
  if (!month || month < 1) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year + 1, 0, 1));
    const faeFrom = new Date(Date.UTC(year - 1, 10, 1)); // nov año anterior
    const faeTo = new Date(Date.UTC(year + 1, 2, 1)); // mar año siguiente
    return { from, to, faeFrom, faeTo };
  }
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  /** Ventana FAE ±2 meses para amarrar FE con CXP digitado en otro mes. */
  const faeFrom = new Date(Date.UTC(year, month - 3, 1));
  const faeTo = new Date(Date.UTC(year, month + 1, 1));
  return { from, to, faeFrom, faeTo };
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

function estadoSqlCondition(estado: CxpEstadoPago): string {
  switch (estado) {
    case "ANULADA":
      return `(u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') = 'S')`;
    case "PAGADA":
      return `(u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') <> 'S' AND NVL(u.SALDO, 0) = 0)`;
    case "PARCIAL":
      return `(u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') <> 'S' AND NVL(u.SALDO, 0) > 0 AND NVL(u.N_APLIC, 0) > 0)`;
    case "PENDIENTE":
      return `(u.ORIGEN = 'CXP' AND NVL(u.ANULADO, 'N') <> 'S' AND NVL(u.SALDO, 0) > 0 AND NVL(u.N_APLIC, 0) = 0)`;
    case "SIN_CXP":
      return `(u.ORIGEN = 'FAE')`;
  }
}

function estadosSqlCondition(estados: CxpEstadoPago[]): string | null {
  if (!estados.length) return null;
  const unique = [...new Set(estados)];
  if (unique.length === 1) return estadoSqlCondition(unique[0]!);
  return `(${unique.map(estadoSqlCondition).join(" OR ")})`;
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
  const moneda = asString(row.MONEDA) ?? asString(row.FAE_MONEDA) ?? "P";
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

type BuiltQuery = {
  binds: Record<string, unknown>;
  baseCteSql: string;
  filteredFromSql: string;
  includeFaeOnly: boolean;
};

function buildQuery(
  input: CxpFacturasListInput,
  noCia: string | null,
): BuiltQuery {
  const { from, to, faeFrom, faeTo } = periodBounds(input.periodMonth, input.periodYear);
  const estados = input.estados ?? [];
  const includeFaeOnly =
    estados.length === 0 || estados.includes("SIN_CXP");

  const binds: Record<string, unknown> = {
    fromDate: from,
    toDate: to,
    faeFrom,
    faeTo,
  };

  const cxpFilters: string[] = [
    "t.DOCUMENTO = 'F'",
    "m.FECHA >= :fromDate AND m.FECHA < :toDate",
  ];
  const faeOnlyFilters: string[] = [
    "f.FECHA >= :fromDate AND f.FECHA < :toDate",
    "NVL(f.EMISOR_TIPO_DOCUMENTO, '01') IN ('01', '04')",
  ];

  if (noCia) {
    cxpFilters.push("m.NO_CIA = :noCia");
    faeOnlyFilters.push("f.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const noProve = input.noProve?.trim();
  if (noProve) {
    cxpFilters.push("m.NO_PROVE = :noProve");
    faeOnlyFilters.push(`EXISTS (
      SELECT 1 FROM NAF5.ARCPMP px
      WHERE px.NO_CIA = f.NO_CIA
        AND px.NO_PROVE = :noProve
        AND REGEXP_REPLACE(NVL(px.CEDULA, ' '), '[^0-9]', '') = f.CED_NORM
    )`);
    binds.noProve = noProve;
  }

  const tipoDoc = input.tipoDoc?.trim();
  if (tipoDoc) {
    cxpFilters.push("m.TIPO_DOC = :tipoDoc");
    faeOnlyFilters.push("1 = 0");
    binds.tipoDoc = tipoDoc;
  }

  const search = input.search?.trim();
  if (search) {
    binds.searchLike = `%${search.toUpperCase()}%`;
    cxpFilters.push(`(
      UPPER(NVL(p.NOMBRE_LARGO, NVL(p.NOMBRE, ' '))) LIKE :searchLike
      OR UPPER(NVL(p.CEDULA, ' ')) LIKE :searchLike
      OR UPPER(m.NO_DOCU) LIKE :searchLike
      OR UPPER(NVL(m.NO_FISICO, ' ')) LIKE :searchLike
      OR UPPER(m.NO_PROVE) LIKE :searchLike
      OR UPPER(NVL(m.DETALLE, ' ')) LIKE :searchLike
      OR UPPER(NVL(f.EMISOR_CONSECUTIVO, ' ')) LIKE :searchLike
      OR UPPER(NVL(f.EMISOR_CLAVE, ' ')) LIKE :searchLike
    )`);
    faeOnlyFilters.push(`(
      UPPER(NVL(f.EMISOR_NOMBRE, ' ')) LIKE :searchLike
      OR UPPER(NVL(f.EMISOR_IDENTIFICACION, ' ')) LIKE :searchLike
      OR UPPER(NVL(f.EMISOR_CONSECUTIVO, ' ')) LIKE :searchLike
      OR UPPER(NVL(f.EMISOR_CLAVE, ' ')) LIKE :searchLike
      OR UPPER(f.FISICO_NORM) LIKE :searchLike
    )`);
  }

  const outerFilters: string[] = ["1 = 1"];
  const estadoCond = estadosSqlCondition(estados);
  if (estadoCond) outerFilters.push(estadoCond);
  const faeCond = faeLinkSqlCondition(input.faeLink ?? "ALL");
  if (faeCond) outerFilters.push(faeCond);

  const faeOnlyBlock = includeFaeOnly
    ? `
fae_only AS (
  SELECT
    'FAE' AS ORIGEN,
    f.NO_CIA,
    CAST(NULL AS VARCHAR2(20)) AS NO_PROVE,
    f.EMISOR_NOMBRE AS PROVEEDOR,
    f.EMISOR_IDENTIFICACION AS CEDULA,
    'FE' AS TIPO_DOC,
    'Comprobante FAE sin CXP' AS TIPO_DESC,
    f.EMISOR_CONSECUTIVO AS NO_DOCU,
    f.FISICO_NORM AS NO_FISICO,
    CAST(NULL AS VARCHAR2(20)) AS SERIE_FISICO,
    f.FECHA,
    f.FECHA AS FECHA_DOCUMENTO,
    CAST(NULL AS DATE) AS FECHA_VENCE,
    NVL(f.TOTAL_VENTA_NETA, 0) AS SUBTOTAL,
    NVL(f.TOTAL_COMPROBANTE, 0) AS MONTO,
    NVL(f.TOTAL_COMPROBANTE, 0) AS SALDO,
    NVL(f.CODIGO_MONEDA, 'CRC') AS MONEDA,
    'N' AS ANULADO,
    CAST(NULL AS VARCHAR2(400)) AS DETALLE,
    f.ID_ENCABEZADO AS FAE_ID_ENCABEZADO,
    f.EMISOR_CONSECUTIVO AS FAE_CONSECUTIVO,
    f.EMISOR_CLAVE AS FAE_CLAVE,
    f.FECHA AS FAE_FECHA,
    f.TOTAL_COMPROBANTE AS FAE_TOTAL,
    f.CODIGO_MONEDA AS FAE_MONEDA,
    f.IND_ACEPTACION AS FAE_IND_ACEPTACION,
    f.DESC_IND_ACEPTACION AS FAE_DESC_ACEPTACION,
    f.PROCESADO AS FAE_PROCESADO,
    f.FH_PROCESADO AS FAE_FH_PROCESADO,
    f.ESTADO_RESPUESTA_DOC AS FAE_ESTADO_HACIENDA,
    f.EMISOR_TIPO_DOCUMENTO AS FAE_TIPO_DOC,
    0 AS N_APLIC,
    0 AS MONTO_APLIC
  FROM fae f
  WHERE ${faeOnlyFilters.join("\n    AND ")}
    AND NOT EXISTS (
      SELECT 1
      FROM NAF5.ARCPMD m
      JOIN NAF5.ARCPTD t
        ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC AND t.DOCUMENTO = 'F'
      JOIN NAF5.ARCPMP p
        ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
      WHERE m.NO_CIA = f.NO_CIA
        AND m.NO_FISICO IS NOT NULL
        AND m.FECHA >= :faeFrom AND m.FECHA < :faeTo
        AND REGEXP_REPLACE(NVL(p.CEDULA, ' '), '[^0-9]', '') = f.CED_NORM
        AND LTRIM(TRIM(m.NO_FISICO), '0') = f.FISICO_NORM
    )
),
u_raw AS (
  SELECT * FROM cxp
  UNION ALL
  SELECT * FROM fae_only
),`
    : `
u_raw AS (
  SELECT * FROM cxp
),`;

  const baseCteSql = `
WITH fae_win AS (
  SELECT
    e.ID_ENCABEZADO,
    e.EMISOR_CONSECUTIVO,
    e.EMISOR_CLAVE,
    e.FECHA,
    e.TOTAL_COMPROBANTE,
    e.TOTAL_VENTA_NETA,
    e.CODIGO_MONEDA,
    e.IND_ACEPTACION,
    e.DESC_IND_ACEPTACION,
    e.PROCESADO,
    e.FH_PROCESADO,
    e.ESTADO_RESPUESTA_DOC,
    e.EMISOR_TIPO_DOCUMENTO,
    e.EMISOR_NOMBRE,
    e.EMISOR_IDENTIFICACION,
    fc.NO_CIA,
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
  WHERE e.FECHA >= :faeFrom AND e.FECHA < :faeTo
),
fae AS (
  SELECT * FROM fae_win WHERE rn = 1
),
cxp AS (
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
    f.ID_ENCABEZADO AS FAE_ID_ENCABEZADO,
    f.EMISOR_CONSECUTIVO AS FAE_CONSECUTIVO,
    f.EMISOR_CLAVE AS FAE_CLAVE,
    f.FECHA AS FAE_FECHA,
    f.TOTAL_COMPROBANTE AS FAE_TOTAL,
    f.CODIGO_MONEDA AS FAE_MONEDA,
    f.IND_ACEPTACION AS FAE_IND_ACEPTACION,
    f.DESC_IND_ACEPTACION AS FAE_DESC_ACEPTACION,
    f.PROCESADO AS FAE_PROCESADO,
    f.FH_PROCESADO AS FAE_FH_PROCESADO,
    f.ESTADO_RESPUESTA_DOC AS FAE_ESTADO_HACIENDA,
    f.EMISOR_TIPO_DOCUMENTO AS FAE_TIPO_DOC,
    NVL(a.N_APLIC, 0) AS N_APLIC,
    NVL(a.MONTO_APLIC, 0) AS MONTO_APLIC
  FROM NAF5.ARCPMD m
  JOIN NAF5.ARCPTD t
    ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC
  LEFT JOIN NAF5.ARCPMP p
    ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
  LEFT JOIN fae f
    ON f.NO_CIA = m.NO_CIA
   AND m.NO_FISICO IS NOT NULL
   AND f.CED_NORM = REGEXP_REPLACE(NVL(p.CEDULA, ' '), '[^0-9]', '')
   AND f.FISICO_NORM = LTRIM(TRIM(m.NO_FISICO), '0')
  LEFT JOIN (
    SELECT
      r.NO_CIA,
      r.TIPO_REFE,
      r.NO_REFE,
      COUNT(*) AS N_APLIC,
      NVL(SUM(r.MONTO), 0) AS MONTO_APLIC
    FROM NAF5.ARCPRD r
    WHERE EXISTS (
      SELECT 1
      FROM NAF5.ARCPMD mx
      JOIN NAF5.ARCPTD tx
        ON tx.NO_CIA = mx.NO_CIA AND tx.TIPO_DOC = mx.TIPO_DOC AND tx.DOCUMENTO = 'F'
      WHERE mx.NO_CIA = r.NO_CIA
        AND mx.TIPO_DOC = r.TIPO_REFE
        AND mx.NO_DOCU = r.NO_REFE
        AND mx.FECHA >= :fromDate AND mx.FECHA < :toDate
    )
    GROUP BY r.NO_CIA, r.TIPO_REFE, r.NO_REFE
  ) a
    ON a.NO_CIA = m.NO_CIA
   AND a.TIPO_REFE = m.TIPO_DOC
   AND a.NO_REFE = m.NO_DOCU
  WHERE ${cxpFilters.join("\n    AND ")}
),
${faeOnlyBlock}
u AS (
  SELECT * FROM u_raw
  WHERE ${outerFilters.join("\n    AND ")}
)`;

  return {
    binds,
    baseCteSql,
    filteredFromSql: "FROM u",
    includeFaeOnly,
  };
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

  const built = buildQuery(input, noCia);

  return withNafOracleConnection(async (conn) => {
    const t0 = Date.now();
    // Un solo round-trip: el período suele ser cientos de filas; paginar/summary en Node.
    const allResult = await conn.execute(
      `
      ${built.baseCteSql}
      SELECT u.*
      ${built.filteredFromSql}
      ORDER BY NVL(u.FAE_FECHA, u.FECHA) DESC, u.NO_DOCU DESC
      `,
      built.binds,
    );
    const queryMs = Date.now() - t0;
    const allOracleRows = (allResult.rows ?? []) as OracleRow[];
    const total = allOracleRows.length;

    let pendientes = 0;
    let parciales = 0;
    let pagadas = 0;
    let sinCxp = 0;
    let conFae = 0;
    let sinFae = 0;
    let faePendiente = 0;
    let monto = 0;
    let saldo = 0;

    for (const row of allOracleRows) {
      const origen = asString(row.ORIGEN) ?? "CXP";
      const anulado = (asString(row.ANULADO) ?? "N").toUpperCase();
      const rowSaldo = asNumber(row.SALDO);
      const nAplic = asNumber(row.N_APLIC);
      const faeId = row.FAE_ID_ENCABEZADO;
      const acept = (asString(row.FAE_IND_ACEPTACION) ?? "").trim().toUpperCase();

      monto += asNumber(row.MONTO);
      if (origen === "CXP") saldo += rowSaldo;
      if (origen === "FAE") sinCxp += 1;
      if (faeId != null) conFae += 1;
      else if (origen === "CXP") sinFae += 1;
      if (acept === "P") faePendiente += 1;

      if (origen === "CXP" && anulado !== "S") {
        if (rowSaldo > 0 && nAplic === 0) pendientes += 1;
        else if (rowSaldo > 0 && nAplic > 0) parciales += 1;
        else if (rowSaldo === 0) pagadas += 1;
      }
    }

    const offset = (input.page - 1) * input.pageSize;
    const pageRows = allOracleRows.slice(offset, offset + input.pageSize);
    const rows = pageRows.map((row) => mapRow(row, companyMap));

    if (queryMs > 2000) {
      console.warn(
        `[cxp] slow query ${queryMs}ms total=${total} page=${input.page} company=${input.company ?? "ALL"}`,
      );
    }

    return {
      rows,
      total,
      page: input.page,
      pageSize: input.pageSize,
      summary: {
        count: total,
        monto,
        saldo,
        pendientes,
        parciales,
        pagadas,
        sinCxp,
        conFae,
        sinFae,
        faePendiente,
      },
      fetchedAt: new Date().toISOString(),
    };
  });
}
