import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

export type NafOcFacturaHit = {
  noCia: string;
  noOrden: string;
  noFisico: string;
  numFac: string;
};

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeOcKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^0+/, "").toLowerCase();
}

function normalizeFacturaKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^0+/, "").toLowerCase();
}

async function resolveSapCodes(companyCode?: string): Promise<string[] | null> {
  if (!companyCode?.trim()) return null;
  const row = await prisma.company.findFirst({
    where: { code: companyCode.trim(), isActive: true },
    select: { sapCode: true },
  });
  const sap = row?.sapCode?.trim();
  if (!sap) return null;
  const padded = sap.padStart(2, "0");
  const bare = sap.replace(/^0+/, "") || sap;
  return [...new Set([padded, bare, sap])];
}

/**
 * Facturas de proveedor NAF (ARIMENCFACTURAS.NO_FISICO) ligadas a OC
 * vía ARIMDETFACTURAS.NO_DOCU → ARIMENCORDEN.NO_DOCU.
 */
export async function findOcByFacturaNumber(
  facturaQuery: string,
  companyCode?: string,
): Promise<NafOcFacturaHit[]> {
  const q = facturaQuery.trim();
  if (q.length < 2) return [];

  const sapCodes = await resolveSapCodes(companyCode);

  return withNafOracleConnection(async (conn) => {
    const binds: Record<string, unknown> = {
      searchLike: `%${q.toUpperCase()}%`,
      searchExact: normalizeFacturaKey(q).toUpperCase(),
      maxRows: 80,
    };
    const ciaFilter = sapCodes?.length
      ? `AND e.NO_CIA IN (${sapCodes.map((_, i) => `:cia${i}`).join(", ")})`
      : "";
    sapCodes?.forEach((c, i) => {
      binds[`cia${i}`] = c;
    });

    const result = await conn.execute(
      `
      SELECT *
      FROM (
        SELECT DISTINCT
          e.NO_CIA,
          e.NO_ORDEN,
          f.NO_FISICO,
          f.NUM_FAC
        FROM NAF5.ARIMENCFACTURAS f
        JOIN NAF5.ARIMDETFACTURAS d
          ON d.NO_CIA = f.NO_CIA AND d.NUM_FAC = f.NUM_FAC
        JOIN NAF5.ARIMENCORDEN e
          ON e.NO_CIA = d.NO_CIA AND e.NO_DOCU = d.NO_DOCU
        WHERE (
          UPPER(TRIM(f.NO_FISICO)) LIKE :searchLike
          OR LTRIM(TRIM(f.NO_FISICO), '0') = :searchExact
          OR UPPER(TRIM(f.NUM_FAC)) LIKE :searchLike
        )
        ${ciaFilter}
        ORDER BY f.NO_FISICO, e.NO_ORDEN
      )
      WHERE ROWNUM <= :maxRows
      `,
      binds,
    );

    const hits: NafOcFacturaHit[] = [];
    for (const raw of result.rows ?? []) {
      const row = raw as OracleRow;
      const noOrden = asString(row.NO_ORDEN);
      const noFisico = asString(row.NO_FISICO);
      if (!noOrden || !noFisico) continue;
      hits.push({
        noCia: asString(row.NO_CIA) ?? "",
        noOrden,
        noFisico,
        numFac: asString(row.NUM_FAC) ?? "",
      });
    }

    // Fallback: CXP con NO_ORDEN poblado o OC en DETALLE
    if (hits.length === 0) {
      const cxpBinds: Record<string, unknown> = {
        searchLike: `%${q.toUpperCase()}%`,
        searchExact: normalizeFacturaKey(q).toUpperCase(),
        maxRows: 40,
      };
      const cxpCia = sapCodes?.length
        ? `AND m.NO_CIA IN (${sapCodes.map((_, i) => `:cia${i}`).join(", ")})`
        : "";
      sapCodes?.forEach((c, i) => {
        cxpBinds[`cia${i}`] = c;
      });

      const cxp = await conn.execute(
        `
        SELECT *
        FROM (
          SELECT
            m.NO_CIA,
            NVL(
              NULLIF(TRIM(m.NO_ORDEN), ''),
              REGEXP_SUBSTR(UPPER(NVL(m.DETALLE, ' ')), 'OC[[:space:]]*([0-9]+)', 1, 1, NULL, 1)
            ) AS NO_ORDEN,
            m.NO_FISICO,
            m.NO_DOCU AS NUM_FAC
          FROM NAF5.ARCPMD m
          JOIN NAF5.ARCPTD t
            ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC AND t.DOCUMENTO = 'F'
          WHERE m.NO_FISICO IS NOT NULL
            AND (
              UPPER(TRIM(m.NO_FISICO)) LIKE :searchLike
              OR LTRIM(TRIM(m.NO_FISICO), '0') = :searchExact
            )
            ${cxpCia}
          ORDER BY m.FECHA DESC
        )
        WHERE ROWNUM <= :maxRows
          AND NO_ORDEN IS NOT NULL
        `,
        cxpBinds,
      );

      for (const raw of cxp.rows ?? []) {
        const row = raw as OracleRow;
        const noOrden = asString(row.NO_ORDEN);
        const noFisico = asString(row.NO_FISICO);
        if (!noOrden || !noFisico) continue;
        hits.push({
          noCia: asString(row.NO_CIA) ?? "",
          noOrden,
          noFisico,
          numFac: asString(row.NUM_FAC) ?? "",
        });
      }
    }

    return hits;
  });
}

/**
 * Para un conjunto de OCs, devuelve mapa `ocKey → números de factura (NO_FISICO)`.
 */
export async function mapFacturasByOcNumbers(
  ocNumbers: string[],
  companyCode?: string,
): Promise<Map<string, string[]>> {
  const cleaned = [
    ...new Set(
      ocNumbers
        .map((o) => o.trim())
        .filter((o) => o.length > 0)
        .slice(0, 400),
    ),
  ];
  const out = new Map<string, string[]>();
  if (cleaned.length === 0) return out;

  const sapCodes = await resolveSapCodes(companyCode);

  try {
    await withNafOracleConnection(async (conn) => {
      const chunkSize = 80;
      for (let i = 0; i < cleaned.length; i += chunkSize) {
        const chunk = cleaned.slice(i, i + chunkSize);
        const binds: Record<string, unknown> = {};
        const ocPh = chunk.map((_, idx) => {
          binds[`oc${idx}`] = chunk[idx];
          return `:oc${idx}`;
        });
        const ciaFilter = sapCodes?.length
          ? `AND e.NO_CIA IN (${sapCodes.map((_, idx) => {
              binds[`cia${idx}`] = sapCodes[idx];
              return `:cia${idx}`;
            }).join(", ")})`
          : "";

        const result = await conn.execute(
          `
          SELECT DISTINCT
            e.NO_ORDEN,
            f.NO_FISICO
          FROM NAF5.ARIMENCORDEN e
          JOIN NAF5.ARIMDETFACTURAS d
            ON d.NO_CIA = e.NO_CIA AND d.NO_DOCU = e.NO_DOCU
          JOIN NAF5.ARIMENCFACTURAS f
            ON f.NO_CIA = d.NO_CIA AND f.NUM_FAC = d.NUM_FAC
          WHERE e.NO_ORDEN IN (${ocPh.join(", ")})
            AND f.NO_FISICO IS NOT NULL
            ${ciaFilter}
          `,
          binds,
        );

        for (const raw of result.rows ?? []) {
          const row = raw as OracleRow;
          const oc = asString(row.NO_ORDEN);
          const fis = asString(row.NO_FISICO);
          if (!oc || !fis) continue;
          const key = normalizeOcKey(oc);
          const list = out.get(key) ?? [];
          if (!list.some((x) => normalizeFacturaKey(x) === normalizeFacturaKey(fis))) {
            list.push(fis);
            out.set(key, list);
          }
        }
      }
    });
  } catch (err) {
    console.warn("[pagos] no se pudieron cargar facturas NAF por OC:", err);
  }

  return out;
}

export { normalizeOcKey, normalizeFacturaKey };

export type NafFacturaLinea = {
  noLinea: number;
  noArti: string;
  descripcion: string | null;
  cantidad: number;
  precio: number;
  montoLinea: number;
  noDocu: string | null;
  noOrden: string | null;
};

export type NafFacturaProveedorDetalle = {
  noCia: string;
  companyCode: string | null;
  numFac: string;
  noFisico: string;
  serieFisico: string | null;
  fecha: string | null;
  fechaDoc: string | null;
  proveedorCodigo: string | null;
  proveedor: string | null;
  estado: string | null;
  total: number | null;
  moneda: string | null;
  impuesto: number | null;
  tipoFac: string | null;
  ordenes: string[];
  lineas: NafFacturaLinea[];
};

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
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

async function loadCompanyMap(): Promise<Map<string, string>> {
  try {
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
  } catch (err) {
    console.warn("[pagos] no se pudo mapear compañías para detalle factura:", err);
    return new Map();
  }
}

/**
 * Detalle de factura de proveedor NAF (ARIMENCFACTURAS + líneas + OCs ligadas).
 */
export async function getFacturaProveedorDetalleNaf(input: {
  noFisico: string;
  companyCode?: string;
  noOrden?: string;
  noCia?: string;
}): Promise<NafFacturaProveedorDetalle | null> {
  const noFisico = input.noFisico.trim();
  if (!noFisico) return null;

  const sapCodes =
    (input.noCia?.trim()
      ? [input.noCia.trim().padStart(2, "0"), input.noCia.trim()]
      : null) ?? (await resolveSapCodes(input.companyCode));
  const companyMap = await loadCompanyMap();
  const noOrdenHint = input.noOrden?.trim() || "";

  return withNafOracleConnection(async (conn) => {
    const binds: Record<string, unknown> = {
      searchExact: normalizeFacturaKey(noFisico).toUpperCase(),
      searchRaw: noFisico.toUpperCase(),
    };
    const ciaFilter = sapCodes?.length
      ? `AND f.NO_CIA IN (${sapCodes.map((_, i) => {
          binds[`cia${i}`] = sapCodes[i];
          return `:cia${i}`;
        }).join(", ")})`
      : "";
    const ordenFilter = noOrdenHint
      ? `AND EXISTS (
          SELECT 1 FROM NAF5.ARIMDETFACTURAS dx
          JOIN NAF5.ARIMENCORDEN ex
            ON ex.NO_CIA = dx.NO_CIA AND ex.NO_DOCU = dx.NO_DOCU
          WHERE dx.NO_CIA = f.NO_CIA AND dx.NUM_FAC = f.NUM_FAC
            AND ex.NO_ORDEN = :noOrdenHint
        )`
      : "";
    if (noOrdenHint) binds.noOrdenHint = noOrdenHint;

    const headerResult = await conn.execute(
      `
      SELECT * FROM (
        SELECT
          f.NO_CIA,
          f.NUM_FAC,
          f.NO_FISICO,
          f.SERIE_FISICO,
          f.FECHA,
          f.FECHA_DOC,
          f.COD_PROVEEDOR,
          f.ESTADO,
          f.TOTAL_GENERAL,
          f.MONEDA,
          f.IMPUESTO,
          f.TIPO_FAC,
          NVL(p.NOMBRE_LARGO, p.NOMBRE) AS PROVEEDOR
        FROM NAF5.ARIMENCFACTURAS f
        LEFT JOIN NAF5.ARCPMP p
          ON p.NO_CIA = f.NO_CIA AND p.NO_PROVE = f.COD_PROVEEDOR
        WHERE (
          LTRIM(TRIM(f.NO_FISICO), '0') = :searchExact
          OR UPPER(TRIM(f.NO_FISICO)) = :searchRaw
        )
        ${ciaFilter}
        ${ordenFilter}
        ORDER BY f.FECHA_DOC DESC NULLS LAST, f.NUM_FAC DESC
      ) WHERE ROWNUM <= 1
      `,
      binds,
    );

    const headerRaw = (headerResult.rows?.[0] ?? null) as OracleRow | null;
    if (!headerRaw) return null;

    const noCia = asString(headerRaw.NO_CIA) ?? "";
    const numFac = asString(headerRaw.NUM_FAC) ?? "";
    if (!noCia || !numFac) return null;

    const [linesResult, ordenesResult] = await Promise.all([
      conn.execute(
        `
        SELECT
          d.NO_LINEA,
          d.NO_ARTI,
          a.DESCRIPCION,
          d.CANT_FACT,
          d.PRECIO,
          d.MONTO_LINEA,
          d.NO_DOCU,
          e.NO_ORDEN
        FROM NAF5.ARIMDETFACTURAS d
        LEFT JOIN NAF5.ARINDA a
          ON a.NO_CIA = d.NO_CIA AND a.NO_ARTI = d.NO_ARTI
        LEFT JOIN NAF5.ARIMENCORDEN e
          ON e.NO_CIA = d.NO_CIA AND e.NO_DOCU = d.NO_DOCU
        WHERE d.NO_CIA = :noCia AND d.NUM_FAC = :numFac
        ORDER BY d.NO_LINEA
        `,
        { noCia, numFac },
      ),
      conn.execute(
        `
        SELECT DISTINCT e.NO_ORDEN
        FROM NAF5.ARIMDETFACTURAS d
        JOIN NAF5.ARIMENCORDEN e
          ON e.NO_CIA = d.NO_CIA AND e.NO_DOCU = d.NO_DOCU
        WHERE d.NO_CIA = :noCia AND d.NUM_FAC = :numFac
          AND e.NO_ORDEN IS NOT NULL
        ORDER BY e.NO_ORDEN
        `,
        { noCia, numFac },
      ),
    ]);

    const lineas: NafFacturaLinea[] = (linesResult.rows ?? []).map((raw) => {
      const row = raw as OracleRow;
      return {
        noLinea: asNumber(row.NO_LINEA) ?? 0,
        noArti: asString(row.NO_ARTI) ?? "",
        descripcion: asString(row.DESCRIPCION),
        cantidad: asNumber(row.CANT_FACT) ?? 0,
        precio: asNumber(row.PRECIO) ?? 0,
        montoLinea: asNumber(row.MONTO_LINEA) ?? 0,
        noDocu: asString(row.NO_DOCU),
        noOrden: asString(row.NO_ORDEN),
      };
    });

    const ordenes = (ordenesResult.rows ?? [])
      .map((raw) => asString((raw as OracleRow).NO_ORDEN))
      .filter((v): v is string => Boolean(v));

    return {
      noCia,
      companyCode: companyMap.get(noCia) ?? companyMap.get(noCia.replace(/^0+/, "") || noCia) ?? null,
      numFac,
      noFisico: asString(headerRaw.NO_FISICO) ?? noFisico,
      serieFisico: asString(headerRaw.SERIE_FISICO),
      fecha: asDateIso(headerRaw.FECHA),
      fechaDoc: asDateIso(headerRaw.FECHA_DOC),
      proveedorCodigo: asString(headerRaw.COD_PROVEEDOR),
      proveedor: asString(headerRaw.PROVEEDOR),
      estado: asString(headerRaw.ESTADO),
      total: asNumber(headerRaw.TOTAL_GENERAL),
      moneda: asString(headerRaw.MONEDA),
      impuesto: asNumber(headerRaw.IMPUESTO),
      tipoFac: asString(headerRaw.TIPO_FAC),
      ordenes,
      lineas,
    };
  });
}
