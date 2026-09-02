import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type {
  OrdenesCompraDetalleInput,
  OrdenesCompraListInput,
} from "../validations/ordenes-compra.schema";

export type OrdenCompraLinea = {
  noLinea: number;
  noArti: string;
  descripcion: string | null;
  cantidad: number;
  precioUni: number;
  subtotal: number;
  unidad: string | null;
};

export type OrdenCompraNafRow = {
  noCia: string;
  companyCode: string | null;
  noOrden: string;
  noDocu: string | null;
  noProve: string;
  proveedor: string | null;
  fecha: string | null;
  estado: string;
  observaciones: string | null;
  /** Total de líneas (sin IVA; ARIMIMPORDEN dispara error ORA-20026 en lectura). */
  monto: number | null;
  moneda: string | null;
  aplicaImpuesto: boolean;
  lineas?: OrdenCompraLinea[];
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

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
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

function mapHeader(row: OracleRow, companyMap: Map<string, string>): OrdenCompraNafRow {
  const cia = asString(row.NO_CIA) ?? "";
  return {
    noCia: cia,
    companyCode: companyMap.get(cia) ?? companyMap.get(cia.replace(/^0+/, "") || cia) ?? null,
    noOrden: asString(row.NO_ORDEN) ?? "",
    noDocu: asString(row.NO_DOCU),
    noProve: asString(row.NO_PROVE) ?? "",
    proveedor: asString(row.PROVEEDOR),
    fecha: asDateIso(row.FECHA),
    estado: asString(row.ESTADO) ?? "",
    observaciones: asString(row.OBSERVACIONES),
    monto: asNumber(row.MONTO_TOTAL),
    moneda: asString(row.MONEDA),
    aplicaImpuesto: (asString(row.APLICA_IMPUESTO) ?? "").toUpperCase() === "S",
  };
}

/**
 * Órdenes de compra Codisa/NAF (ARIMENCORDEN).
 * Solo lectura. No tocar ARIMIMPORDEN (trigger NAF5.IMPUESTO → ORA-20026).
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
          e.NO_DOCU,
          e.NO_PROVE,
          e.FECHA,
          e.ESTADO,
          e.OBSERVACIONES,
          e.MONEDA,
          e.APLICA_IMPUESTO,
          NVL(p.NOMBRE_LARGO, p.NOMBRE) AS PROVEEDOR,
          NVL((
            SELECT SUM(NVL(d.CANTIDAD_PEDIDA, 0) * NVL(d.PRECIO_UNI, 0))
            FROM NAF5.ARIMDETORDEN d
            WHERE d.NO_CIA = e.NO_CIA AND d.NO_DOCU = e.NO_DOCU
          ), 0) AS MONTO_TOTAL
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

    const rows = (result.rows ?? []).map((raw) => mapHeader(raw as OracleRow, companyMap));
    return { rows, fetchedAt: new Date().toISOString() };
  });
}

/** Detalle de una OC + líneas (ARIMDETORDEN + descripción ARINDA). */
export async function getOrdenCompraDetalleNaf(
  input: OrdenesCompraDetalleInput,
): Promise<OrdenCompraNafRow | null> {
  const noOrden = input.noOrden.trim();
  if (!noOrden) return null;

  const noCia =
    (input.noCia?.trim() ? input.noCia.trim().padStart(2, "0") : null) ??
    (await resolveNoCia(input.company));
  const companyMap = await loadCompanyMap();

  return withNafOracleConnection(async (conn) => {
    const binds: Record<string, unknown> = { noOrden };
    let ciaFilter = "";
    if (noCia) {
      binds.noCia = noCia;
      ciaFilter = "AND e.NO_CIA = :noCia";
    }

    const headerResult = await conn.execute(
      `
      SELECT * FROM (
        SELECT
          e.NO_CIA,
          e.NO_ORDEN,
          e.NO_DOCU,
          e.NO_PROVE,
          e.FECHA,
          e.ESTADO,
          e.OBSERVACIONES,
          e.MONEDA,
          e.APLICA_IMPUESTO,
          NVL(p.NOMBRE_LARGO, p.NOMBRE) AS PROVEEDOR,
          NVL((
            SELECT SUM(NVL(d.CANTIDAD_PEDIDA, 0) * NVL(d.PRECIO_UNI, 0))
            FROM NAF5.ARIMDETORDEN d
            WHERE d.NO_CIA = e.NO_CIA AND d.NO_DOCU = e.NO_DOCU
          ), 0) AS MONTO_TOTAL
        FROM NAF5.ARIMENCORDEN e
        LEFT JOIN NAF5.ARCPMP p
          ON p.NO_CIA = e.NO_CIA AND p.NO_PROVE = e.NO_PROVE
        WHERE e.NO_ORDEN = :noOrden
          ${ciaFilter}
        ORDER BY e.FECHA DESC NULLS LAST
      ) WHERE ROWNUM <= 1
      `,
      binds,
    );

    const headerRaw = (headerResult.rows?.[0] ?? null) as OracleRow | null;
    if (!headerRaw) return null;

    const header = mapHeader(headerRaw, companyMap);
    if (!header.noDocu) {
      return { ...header, lineas: [] };
    }

    const linesResult = await conn.execute(
      `
      SELECT
        d.NO_LINEA,
        d.NO_ARTI,
        a.DESCRIPCION,
        d.CANTIDAD_PEDIDA,
        d.PRECIO_UNI,
        NVL(d.CANTIDAD_PEDIDA, 0) * NVL(d.PRECIO_UNI, 0) AS SUBTOTAL,
        d.UNIDAD_MEDIDA,
        d.OBSERVACIONES_LIN
      FROM NAF5.ARIMDETORDEN d
      LEFT JOIN NAF5.ARINDA a
        ON a.NO_CIA = d.NO_CIA AND a.NO_ARTI = d.NO_ARTI
      WHERE d.NO_CIA = :noCia AND d.NO_DOCU = :noDocu
      ORDER BY d.NO_LINEA
      `,
      { noCia: header.noCia, noDocu: header.noDocu },
    );

    const lineas: OrdenCompraLinea[] = (linesResult.rows ?? []).map((raw) => {
      const row = raw as OracleRow;
      return {
        noLinea: asNumber(row.NO_LINEA) ?? 0,
        noArti: asString(row.NO_ARTI) ?? "",
        descripcion: asString(row.DESCRIPCION) ?? asString(row.OBSERVACIONES_LIN),
        cantidad: asNumber(row.CANTIDAD_PEDIDA) ?? 0,
        precioUni: asNumber(row.PRECIO_UNI) ?? 0,
        subtotal: asNumber(row.SUBTOTAL) ?? 0,
        unidad: asString(row.UNIDAD_MEDIDA),
      };
    });

    return { ...header, lineas };
  });
}
