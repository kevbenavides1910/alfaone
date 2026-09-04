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
