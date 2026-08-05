import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { labelMonedaCxp } from "../business/cxp-status";
import {
  labelCxpDocumentoClase,
  labelCxpTipoDoc,
} from "../business/cxp-movimientos";
import type { CxpMovimientosListInput } from "../validations/cxp-movimientos.schema";

export type CxpMovimientoRow = {
  id: string;
  noCia: string;
  companyCode: string | null;
  companyName: string | null;
  noProve: string;
  proveedor: string;
  cedula: string | null;
  tipoDoc: string;
  tipoDocDesc: string | null;
  tipoDocLabel: string;
  documentoClase: string | null;
  documentoClaseLabel: string;
  noDocu: string;
  noFisico: string | null;
  serieFisico: string | null;
  fecha: string;
  fechaDocumento: string | null;
  fechaVence: string | null;
  subtotal: number;
  monto: number;
  saldo: number;
  moneda: string;
  monedaLabel: string;
  anulado: string | null;
  detalle: string | null;
  concepto: string | null;
  indAct: string | null;
};

export type CxpMovimientosListResult = {
  rows: CxpMovimientoRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    count: number;
    monto: number;
    saldo: number;
    anulados: number;
    porTipo: { tipoDoc: string; label: string; count: number; monto: number }[];
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

function mapRow(
  row: OracleRow,
  companyMap: Map<string, { code: string; name: string }>,
): CxpMovimientoRow {
  const noCia = asString(row.NO_CIA) ?? "";
  const company = companyMap.get(noCia) ?? companyMap.get(noCia.padStart(2, "0"));
  const tipoDoc = asString(row.TIPO_DOC) ?? "";
  const tipoDocDesc = asString(row.TIPO_DESC);
  const noDocu = asString(row.NO_DOCU) ?? "";
  const noProve = asString(row.NO_PROVE) ?? "";
  const documentoClase = asString(row.DOCUMENTO);
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
    tipoDocDesc,
    tipoDocLabel: labelCxpTipoDoc(tipoDoc, tipoDocDesc),
    documentoClase,
    documentoClaseLabel: labelCxpDocumentoClase(documentoClase),
    noDocu,
    noFisico: asString(row.NO_FISICO),
    serieFisico: asString(row.SERIE_FISICO),
    fecha: asIsoDate(row.FECHA) ?? new Date(0).toISOString(),
    fechaDocumento: asIsoDate(row.FECHA_DOCUMENTO),
    fechaVence: asIsoDate(row.FECHA_VENCE),
    subtotal: asNumber(row.SUBTOTAL),
    monto: asNumber(row.MONTO),
    saldo: asNumber(row.SALDO),
    moneda,
    monedaLabel: labelMonedaCxp(moneda),
    anulado: asString(row.ANULADO),
    detalle: asString(row.DETALLE),
    concepto: asString(row.CONCEPTO),
    indAct: asString(row.IND_ACT),
  };
}

/**
 * Todos los movimientos CXP de NAF5.ARCPMD (sin restringir a DOCUMENTO='F'),
 * filtrables por rango de fecha y tipo (NC, ND, FA, TR, …).
 */
export async function listCxpMovimientos(
  input: CxpMovimientosListInput,
): Promise<CxpMovimientosListResult> {
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

  const fromDate = new Date(`${input.dateFrom}T00:00:00.000Z`);
  const toDateExclusive = new Date(`${input.dateTo}T00:00:00.000Z`);
  toDateExclusive.setUTCDate(toDateExclusive.getUTCDate() + 1);

  const binds: Record<string, unknown> = {
    fromDate,
    toDate: toDateExclusive,
  };

  const filters: string[] = ["m.FECHA >= :fromDate AND m.FECHA < :toDate"];

  if (noCia) {
    filters.push("m.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const noProve = input.noProve?.trim();
  if (noProve) {
    filters.push("m.NO_PROVE = :noProve");
    binds.noProve = noProve;
  }

  const tipoDocs = input.tipoDocs ?? [];
  if (tipoDocs.length === 1) {
    filters.push("m.TIPO_DOC = :tipoDoc0");
    binds.tipoDoc0 = tipoDocs[0];
  } else if (tipoDocs.length > 1) {
    const placeholders = tipoDocs.map((_, i) => {
      const key = `tipoDoc${i}`;
      binds[key] = tipoDocs[i];
      return `:${key}`;
    });
    filters.push(`m.TIPO_DOC IN (${placeholders.join(", ")})`);
  }

  const documentoClase = input.documentoClase?.trim();
  if (documentoClase) {
    filters.push("t.DOCUMENTO = :documentoClase");
    binds.documentoClase = documentoClase;
  }

  const search = input.search?.trim();
  if (search) {
    filters.push(`(
      UPPER(m.NO_DOCU) LIKE :search
      OR UPPER(NVL(m.NO_FISICO, ' ')) LIKE :search
      OR UPPER(NVL(p.NOMBRE, ' ')) LIKE :search
      OR UPPER(NVL(p.CEDULA, ' ')) LIKE :search
      OR UPPER(NVL(m.DETALLE, ' ')) LIKE :search
      OR UPPER(NVL(m.CONCEPTO, ' ')) LIKE :search
    )`);
    binds.search = `%${search.toUpperCase()}%`;
  }

  const whereSql = filters.join("\n    AND ");

  return withNafOracleConnection(async (conn) => {
    const t0 = Date.now();
    const allResult = await conn.execute(
      `
      SELECT
        m.NO_CIA,
        m.NO_PROVE,
        NVL(p.NOMBRE, m.NO_PROVE) AS PROVEEDOR,
        p.CEDULA,
        m.TIPO_DOC,
        t.DESCRIPCION AS TIPO_DESC,
        t.DOCUMENTO,
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
        m.CONCEPTO,
        m.IND_ACT
      FROM NAF5.ARCPMD m
      JOIN NAF5.ARCPTD t
        ON t.NO_CIA = m.NO_CIA AND t.TIPO_DOC = m.TIPO_DOC
      LEFT JOIN NAF5.ARCPMP p
        ON p.NO_CIA = m.NO_CIA AND p.NO_PROVE = m.NO_PROVE
      WHERE ${whereSql}
      ORDER BY m.FECHA DESC, m.TIPO_DOC, m.NO_DOCU DESC
      `,
      binds,
    );
    const queryMs = Date.now() - t0;
    const allOracleRows = (allResult.rows ?? []) as OracleRow[];
    const total = allOracleRows.length;

    let monto = 0;
    let saldo = 0;
    let anulados = 0;
    const porTipoMap = new Map<string, { tipoDoc: string; label: string; count: number; monto: number }>();

    for (const row of allOracleRows) {
      const rowMonto = asNumber(row.MONTO);
      monto += rowMonto;
      saldo += asNumber(row.SALDO);
      if ((asString(row.ANULADO) ?? "N").toUpperCase() === "S") anulados += 1;

      const tipoDoc = asString(row.TIPO_DOC) ?? "";
      const tipoDesc = asString(row.TIPO_DESC);
      const prev = porTipoMap.get(tipoDoc);
      if (prev) {
        prev.count += 1;
        prev.monto += rowMonto;
      } else {
        porTipoMap.set(tipoDoc, {
          tipoDoc,
          label: labelCxpTipoDoc(tipoDoc, tipoDesc),
          count: 1,
          monto: rowMonto,
        });
      }
    }

    const porTipo = [...porTipoMap.values()].sort((a, b) => b.count - a.count);

    const offset = (input.page - 1) * input.pageSize;
    const pageRows = allOracleRows.slice(offset, offset + input.pageSize);
    const rows = pageRows.map((row) => mapRow(row, companyMap));

    if (queryMs > 2000) {
      console.warn(
        `[cxp-movimientos] slow query ${queryMs}ms total=${total} page=${input.page} company=${input.company ?? "ALL"}`,
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
        anulados,
        porTipo,
      },
      fetchedAt: new Date().toISOString(),
    };
  });
}
