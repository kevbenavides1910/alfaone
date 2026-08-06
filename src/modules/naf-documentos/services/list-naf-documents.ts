import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { batchNafDocumentPdfAvailability } from "./resolve-naf-document-pdf";

export type NafDocumentoRow = {
  id: string;
  noCia: string;
  companyCode: string | null;
  companyName: string | null;
  tipoDoc: string;
  noFactu: string;
  noFisico: string | null;
  serieFisico: string | null;
  cliente: string;
  noCliente: string | null;
  contrato: string | null;
  fecha: string;
  subtotal: number;
  impuesto: number;
  total: number;
  estado: string | null;
  claveFactura: string | null;
  consecutivoFe: string | null;
  estadoTributacion: string | null;
  plazo: number | null;
  fechaIngreso: string | null;
  fechaModifico: string | null;
  pdfDisponible: boolean;
  ligadoAFacturacion: boolean;
  ligadoEmisionId: string | null;
};

export type NafDocumentosListResult = {
  rows: NafDocumentoRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    count: number;
    subtotal: number;
    impuesto: number;
    total: number;
  };
  fetchedAt: string;
};

type ListInput = {
  /** Rango YYYY-MM-DD (preferido). */
  dateFrom?: string;
  dateTo?: string;
  /** Compat mes/año cuando no hay dateFrom/dateTo. */
  periodMonth?: number;
  periodYear?: number;
  company?: string;
  tipoDoc?: string;
  search?: string;
  page: number;
  pageSize: number;
  /** ALL | LIGADOS | NO_LIGADOS */
  ligadoFilter?: "ALL" | "LIGADOS" | "NO_LIGADOS";
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

function resolveDateBounds(input: ListInput): { from: Date; to: Date } {
  if (input.dateFrom && input.dateTo) {
    const from = new Date(`${input.dateFrom}T00:00:00.000Z`);
    const toExclusive = new Date(`${input.dateTo}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    return { from, to: toExclusive };
  }
  if (input.periodMonth != null && input.periodYear != null) {
    return periodBounds(input.periodMonth, input.periodYear);
  }
  throw new Error("Indique dateFrom/dateTo o periodMonth/periodYear");
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
): Omit<NafDocumentoRow, "pdfDisponible" | "ligadoAFacturacion" | "ligadoEmisionId"> {
  const noCia = asString(row.NO_CIA) ?? "";
  const company = companyMap.get(noCia) ?? companyMap.get(noCia.padStart(2, "0"));
  const noFactu = asString(row.NO_FACTU) ?? "";
  const tipoDoc = asString(row.TIPO_DOC) ?? "";
  return {
    id: `${noCia}-${tipoDoc}-${noFactu}`,
    noCia,
    companyCode: company?.code ?? null,
    companyName: company?.name ?? null,
    tipoDoc,
    noFactu,
    noFisico: asString(row.NO_FISICO),
    serieFisico: asString(row.SERIE_FISICO),
    cliente: asString(row.NBR_CLIENTE) ?? "—",
    noCliente: asString(row.NO_CLIENTE),
    contrato: asString(row.NO_CONTRATO),
    fecha: asIsoDate(row.FECHA) ?? new Date(0).toISOString(),
    subtotal: asNumber(row.SUB_TOTAL),
    impuesto: asNumber(row.IMPUESTO),
    total: asNumber(row.TOTAL),
    estado: asString(row.ESTADO),
    claveFactura: asString(row.CLAVE_FACTURA),
    consecutivoFe: asString(row.F_ELECTRONICA),
    estadoTributacion: asString(row.ESTADO_TRIBUTACION),
    plazo: row.PLAZO == null ? null : asNumber(row.PLAZO),
    fechaIngreso: asIsoDate(row.FECHA_INGRESO),
    fechaModifico: asIsoDate(row.FECHA_MODIFICO),
  };
}

function buildWhereClause(
  input: ListInput,
  noCia: string | null,
): { whereClause: string; binds: Record<string, unknown> } {
  const { from, to } = resolveDateBounds(input);
  const conditions = ["f.FECHA >= :fromDate", "f.FECHA < :toDate"];
  const binds: Record<string, unknown> = { fromDate: from, toDate: to };

  if (noCia) {
    conditions.push("f.NO_CIA = :noCia");
    binds.noCia = noCia;
  }

  const tipoDoc = input.tipoDoc?.trim();
  if (tipoDoc) {
    conditions.push("f.TIPO_DOC = :tipoDoc");
    binds.tipoDoc = tipoDoc;
  }

  const search = input.search?.trim();
  if (search) {
    conditions.push(`(
      UPPER(f.NBR_CLIENTE) LIKE :searchLike
      OR UPPER(NVL(f.NO_CONTRATO, ' ')) LIKE :searchLike
      OR TO_CHAR(f.NO_FACTU) LIKE :searchLike
      OR TO_CHAR(f.NO_FISICO) LIKE :searchLike
      OR NVL(f.CLAVE_FACTURA, ' ') LIKE :searchLike
      OR NVL(f.F_ELECTRONICA, ' ') LIKE :searchLike
      OR LTRIM(NVL(f.F_ELECTRONICA, '0'), '0') LIKE :searchLikeTrim
    )`);
    binds.searchLike = `%${search.toUpperCase()}%`;
    const trimmedDigits = search.replace(/^0+/, "") || search;
    binds.searchLikeTrim = `%${trimmedDigits.toUpperCase()}%`;
  }

  return { whereClause: conditions.join("\n  AND "), binds };
}

const LIST_COLUMNS = `
  f.NO_CIA,
  f.TIPO_DOC,
  f.NO_FACTU,
  f.NO_FISICO,
  f.SERIE_FISICO,
  f.NBR_CLIENTE,
  f.NO_CLIENTE,
  f.NO_CONTRATO,
  f.FECHA,
  f.SUB_TOTAL,
  f.IMPUESTO,
  f.TOTAL,
  f.ESTADO,
  f.CLAVE_FACTURA,
  f.F_ELECTRONICA,
  f.ESTADO_TRIBUTACION,
  f.PLAZO,
  f.FECHA_INGRESO,
  f.FECHA_MODIFICO
`;

export async function listNafDocuments(input: ListInput): Promise<NafDocumentosListResult> {
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
        NVL(SUM(f.SUB_TOTAL), 0) AS SUBTOTAL,
        NVL(SUM(f.IMPUESTO), 0) AS IMPUESTO,
        NVL(SUM(f.TOTAL), 0) AS TOTAL
      FROM NAF5.ARFAFE f
      WHERE ${whereClause}
      `,
      filterBinds
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
          FROM NAF5.ARFAFE f
          WHERE ${whereClause}
          ORDER BY f.FECHA DESC, f.NO_FACTU DESC
        ) inner_query
        WHERE ROWNUM <= :maxRow
      )
      WHERE rnum > :minRow
      `,
      listBinds
    );

    const rows = (listResult.rows ?? []).map((row) =>
      mapRow(row as OracleRow, companyMap)
    );

    const pdfAvailability = await batchNafDocumentPdfAvailability(
      rows.map((row) => ({
        noCia: row.noCia,
        companyCode: row.companyCode,
        tipoDoc: row.tipoDoc,
        noFactu: row.noFactu,
        claveFactura: row.claveFactura,
        consecutivoFe: row.consecutivoFe,
      })),
    );
    const rowsWithPdf = rows.map((row) => ({
      ...row,
      pdfDisponible: pdfAvailability.get(row.id) ?? false,
    }));

    const linked =
      rowsWithPdf.length === 0
        ? []
        : await prisma.facturaEmisionNafDocumento.findMany({
            where: {
              OR: rowsWithPdf.map((r) => ({
                nafNoCia: r.noCia,
                nafTipoDoc: r.tipoDoc,
                nafNoFactu: r.noFactu,
              })),
            },
            select: {
              id: true,
              nafNoCia: true,
              nafTipoDoc: true,
              nafNoFactu: true,
              facturaMensualEmisionId: true,
            },
          });
    const linkedMap = new Map(
      linked.map((l) => [
        `${l.nafNoCia}-${l.nafTipoDoc}-${l.nafNoFactu}`,
        l.facturaMensualEmisionId,
      ]),
    );

    let enriched = rowsWithPdf.map((row) => {
      const emisionId = linkedMap.get(`${row.noCia}-${row.tipoDoc}-${row.noFactu}`) ?? null;
      return {
        ...row,
        ligadoAFacturacion: emisionId != null,
        ligadoEmisionId: emisionId,
      };
    });

    const ligadoFilter = input.ligadoFilter ?? "ALL";
    if (ligadoFilter === "LIGADOS") {
      enriched = enriched.filter((r) => r.ligadoAFacturacion);
    } else if (ligadoFilter === "NO_LIGADOS") {
      enriched = enriched.filter((r) => !r.ligadoAFacturacion);
    }

    return {
      rows: enriched,
      total: ligadoFilter === "ALL" ? total : enriched.length,
      page: input.page,
      pageSize: input.pageSize,
      summary: {
        count: total,
        subtotal: asNumber(summaryRow.SUBTOTAL),
        impuesto: asNumber(summaryRow.IMPUESTO),
        total: asNumber(summaryRow.TOTAL),
      },
      fetchedAt: new Date().toISOString(),
    };
  });
}
