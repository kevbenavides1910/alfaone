import { prisma } from "@/modules/core/db/prisma";
import {
  buildSapToCompanyMap,
  companySapLabel,
  normalizeSapCode,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

export type RevisionPlanillaRubroLine = {
  codigo: string;
  descripcion: string;
  cantidad: number | null;
  monto: number;
};

export type RevisionPlanillaDetalleResult = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  fDesde: string;
  fHasta: string;
  fuente: "abierta" | "cerrada";
  estado: string | null;
  estadoLabel: string | null;
  ingresos: RevisionPlanillaRubroLine[];
  deducciones: RevisionPlanillaRubroLine[];
  totales: {
    ingresos: number;
    deducciones: number;
    liquido: number;
  };
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

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calendarDateKey(value: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

function normalizeCodPla(value: string): string {
  const raw = value.trim();
  if (/^\d+$/.test(raw) && raw.length < 2) return raw.padStart(2, "0");
  return raw;
}

function estadoLabel(estado: string | null | undefined): string | null {
  const code = (estado ?? "").trim().toUpperCase();
  if (code === "C") return "Calculada";
  if (code === "M") return "En proceso";
  if (code === "A") return "Abierta";
  if (!code) return null;
  return code;
}

async function resolveCompanyLabel(noCia: string): Promise<string> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { code: true, name: true, sapCode: true },
  });
  const sapToCompany = buildSapToCompanyMap(companies);
  const companyByCode = new Map(companies.map((c) => [c.code, c]));
  const { sapCode, companyCode } = resolveCompanyFromSapCode(noCia, sapToCompany);
  const company = companyCode ? companyByCode.get(companyCode) : undefined;
  return companySapLabel(sapCode, companyCode, company?.name ?? null);
}

/**
 * COD_PLA exacto (= :codPla del control ARPLCP), como Codisa/RPL3071.
 * No LPAD: evita mezclar filas basura COD_PLA='4' con planilla '04'.
 */
const OPEN_INGRESOS_QUERY = `
SELECT
  p.NO_INGRE AS CODIGO,
  NVL(i.DESCRI, p.NO_INGRE) AS DESCRI,
  SUM(NVL(p.CANTIDAD, 0)) AS CANTIDAD,
  SUM(NVL(p.MONTO, 0)) AS MONTO
FROM NAF5.ARPLPPI p
LEFT JOIN NAF5.ARPLMI i
  ON i.NO_CIA = p.NO_CIA AND i.NO_INGRE = p.NO_INGRE
WHERE p.NO_CIA = :noCia
  AND TRIM(p.COD_PLA) = :codPla
GROUP BY p.NO_INGRE, i.DESCRI
HAVING SUM(NVL(p.MONTO, 0)) <> 0
ORDER BY MONTO DESC
`;

/** Solo deducciones activas (ESTATUS=A), como RPL3071; excluye anuladas (X). */
const OPEN_DEDUCCIONES_QUERY = `
SELECT
  p.NO_DEDU AS CODIGO,
  NVL(d.DESCRI, NVL(p.DESCRIPCION, p.NO_DEDU)) AS DESCRI,
  SUM(
    CASE
      WHEN NVL(p.SOLO_CIA, 'N') = 'N' AND NVL(p.ESTATUS, 'A') = 'A'
      THEN NVL(p.MONTO, 0)
      ELSE 0
    END
  ) AS MONTO
FROM NAF5.ARPLPPD p
LEFT JOIN NAF5.ARPLMD d
  ON d.NO_CIA = p.NO_CIA AND d.NO_DEDU = p.NO_DEDU
WHERE p.NO_CIA = :noCia
  AND TRIM(p.COD_PLA) = :codPla
  AND EXISTS (
    SELECT 1
    FROM NAF5.ARPLPPI i
    WHERE i.NO_CIA = p.NO_CIA
      AND TRIM(i.COD_PLA) = TRIM(p.COD_PLA)
      AND i.NO_EMPLE = p.NO_EMPLE
  )
GROUP BY p.NO_DEDU, d.DESCRI, p.DESCRIPCION
HAVING SUM(
  CASE
    WHEN NVL(p.SOLO_CIA, 'N') = 'N' AND NVL(p.ESTATUS, 'A') = 'A'
    THEN NVL(p.MONTO, 0)
    ELSE 0
  END
) <> 0
ORDER BY MONTO DESC
`;

const CLOSED_RUBROS_QUERY = `
SELECT
  h.TIPO_M,
  h.CODIGO,
  CASE
    WHEN h.TIPO_M = 'I' THEN NVL(i.DESCRI, h.CODIGO)
    ELSE NVL(d.DESCRI, h.CODIGO)
  END AS DESCRI,
  SUM(NVL(h.MONTO, 0)) AS MONTO
FROM NAF5.ARPLHS h
LEFT JOIN NAF5.ARPLMI i
  ON i.NO_CIA = h.NO_CIA AND i.NO_INGRE = h.CODIGO AND h.TIPO_M = 'I'
LEFT JOIN NAF5.ARPLMD d
  ON d.NO_CIA = h.NO_CIA AND d.NO_DEDU = h.CODIGO AND h.TIPO_M = 'D'
WHERE h.NO_CIA = :noCia
  AND LPAD(TRIM(h.COD_PLA), 2, '0') = :codPla
  AND h.ANO = :ano
  AND h.PERIODO = :periodo
  AND (
    h.TIPO_M = 'I'
    OR (h.TIPO_M = 'D' AND NVL(h.SOLO_CIA, 'N') = 'N')
  )
GROUP BY
  h.TIPO_M,
  h.CODIGO,
  CASE
    WHEN h.TIPO_M = 'I' THEN NVL(i.DESCRI, h.CODIGO)
    ELSE NVL(d.DESCRI, h.CODIGO)
  END
HAVING SUM(NVL(h.MONTO, 0)) <> 0
ORDER BY h.TIPO_M DESC, MONTO DESC
`;

const OPEN_CONTROL_QUERY = `
SELECT
  LPAD(TRIM(CODPLA), 2, '0') AS COD_PLA,
  DESCRI,
  ESTADO,
  ANO_PROCE,
  NO_PLANI,
  F_DESDE,
  F_HASTA
FROM NAF5.ARPLCP
WHERE NO_CIA = :noCia
  AND LPAD(TRIM(CODPLA), 2, '0') = :codPla
  AND ESTADO IN ('C', 'M', 'A')
  AND F_DESDE IS NOT NULL
  AND F_HASTA IS NOT NULL
`;

function mapIngresoRows(rows: OracleRow[]): RevisionPlanillaRubroLine[] {
  return rows.map((row) => ({
    codigo: asString(row.CODIGO) ?? "",
    descripcion: asString(row.DESCRI) ?? asString(row.CODIGO) ?? "",
    cantidad: row.CANTIDAD == null ? null : asNumber(row.CANTIDAD),
    monto: roundMoney(asNumber(row.MONTO)),
  }));
}

function mapDeduccionRows(rows: OracleRow[]): RevisionPlanillaRubroLine[] {
  return rows.map((row) => ({
    codigo: asString(row.CODIGO) ?? "",
    descripcion: asString(row.DESCRI) ?? asString(row.CODIGO) ?? "",
    cantidad: null,
    monto: roundMoney(asNumber(row.MONTO)),
  }));
}

export async function getRevisionPlanillaDetalle(params: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
}): Promise<RevisionPlanillaDetalleResult> {
  const noCia = normalizeSapCode(params.noCia.trim()) ?? params.noCia.trim();
  const codPla = normalizeCodPla(params.codPla);
  if (!noCia || !codPla) {
    throw new Error("Parámetros noCia y codPla requeridos");
  }

  const desdeKey = calendarDateKey(parseDateInput(params.fDesde));
  const hastaKey = calendarDateKey(parseDateInput(params.fHasta));
  if (!desdeKey || !hastaKey) {
    throw new Error("Rango de fechas inválido");
  }

  const companyLabel = await resolveCompanyLabel(noCia);

  return withNafOracleConnection(async (conn) => {
    const openCtrl = await conn.execute<OracleRow>(OPEN_CONTROL_QUERY, { noCia, codPla });
    const openRow = (openCtrl.rows ?? []).find((row) => {
      if (!row.F_DESDE || !row.F_HASTA) return false;
      return (
        calendarDateKey(row.F_DESDE as Date) === desdeKey &&
        calendarDateKey(row.F_HASTA as Date) === hastaKey
      );
    });

    if (openRow) {
      const [ingRes, dedRes] = await Promise.all([
        conn.execute<OracleRow>(OPEN_INGRESOS_QUERY, { noCia, codPla }),
        conn.execute<OracleRow>(OPEN_DEDUCCIONES_QUERY, { noCia, codPla }),
      ]);
      const ingresos = mapIngresoRows(ingRes.rows ?? []);
      const deducciones = mapDeduccionRows(dedRes.rows ?? []);
      const totalIngresos = roundMoney(ingresos.reduce((s, r) => s + r.monto, 0));
      const totalDeducciones = roundMoney(deducciones.reduce((s, r) => s + r.monto, 0));
      const estado = asString(openRow.ESTADO);

      return {
        noCia,
        companyLabel,
        codPla,
        nominaNombre: asString(openRow.DESCRI),
        fDesde: params.fDesde,
        fHasta: params.fHasta,
        fuente: "abierta",
        estado,
        estadoLabel: estadoLabel(estado),
        ingresos,
        deducciones,
        totales: {
          ingresos: totalIngresos,
          deducciones: totalDeducciones,
          liquido: roundMoney(totalIngresos - totalDeducciones),
        },
      };
    }

    const meta = await prisma.nafNominaPeriodMeta.findFirst({
      where: {
        noCia,
        codPla,
        fDesde: parseDateInput(params.fDesde),
        fHasta: parseDateInput(params.fHasta),
      },
      select: {
        ano: true,
        periodo: true,
        descri: true,
        tipoEmp: true,
      },
    });

    if (!meta) {
      // Intentar match por clave de calendario por si hay desfase de timezone en PG.
      const metas = await prisma.nafNominaPeriodMeta.findMany({
        where: { noCia, codPla },
        select: {
          ano: true,
          periodo: true,
          descri: true,
          tipoEmp: true,
          fDesde: true,
          fHasta: true,
        },
      });
      const matched = metas.find(
        (row) =>
          row.fDesde &&
          row.fHasta &&
          calendarDateKey(row.fDesde) === desdeKey &&
          calendarDateKey(row.fHasta) === hastaKey,
      );
      if (!matched) {
        throw new Error("No se encontró la planilla para el periodo indicado");
      }

      const closedRes = await conn.execute<OracleRow>(CLOSED_RUBROS_QUERY, {
        noCia,
        codPla,
        ano: matched.ano,
        periodo: matched.periodo,
      });
      const rows = closedRes.rows ?? [];
      const ingresos = mapIngresoRows(rows.filter((r) => asString(r.TIPO_M) === "I"));
      const deducciones = mapDeduccionRows(rows.filter((r) => asString(r.TIPO_M) === "D"));
      const totalIngresos = roundMoney(ingresos.reduce((s, r) => s + r.monto, 0));
      const totalDeducciones = roundMoney(deducciones.reduce((s, r) => s + r.monto, 0));
      const estado = matched.tipoEmp?.trim().toUpperCase() ?? null;
      const estadoNorm = estado && ["C", "M", "A"].includes(estado) ? estado : null;

      return {
        noCia,
        companyLabel,
        codPla,
        nominaNombre: matched.descri,
        fDesde: params.fDesde,
        fHasta: params.fHasta,
        fuente: "cerrada",
        estado: estadoNorm,
        estadoLabel: estadoLabel(estadoNorm),
        ingresos,
        deducciones,
        totales: {
          ingresos: totalIngresos,
          deducciones: totalDeducciones,
          liquido: roundMoney(totalIngresos - totalDeducciones),
        },
      };
    }

    const closedRes = await conn.execute<OracleRow>(CLOSED_RUBROS_QUERY, {
      noCia,
      codPla,
      ano: meta.ano,
      periodo: meta.periodo,
    });
    const rows = closedRes.rows ?? [];
    const ingresos = mapIngresoRows(rows.filter((r) => asString(r.TIPO_M) === "I"));
    const deducciones = mapDeduccionRows(rows.filter((r) => asString(r.TIPO_M) === "D"));
    const totalIngresos = roundMoney(ingresos.reduce((s, r) => s + r.monto, 0));
    const totalDeducciones = roundMoney(deducciones.reduce((s, r) => s + r.monto, 0));
    const estado = meta.tipoEmp?.trim().toUpperCase() ?? null;
    const estadoNorm = estado && ["C", "M", "A"].includes(estado) ? estado : null;

    return {
      noCia,
      companyLabel,
      codPla,
      nominaNombre: meta.descri,
      fDesde: params.fDesde,
      fHasta: params.fHasta,
      fuente: "cerrada",
      estado: estadoNorm,
      estadoLabel: estadoLabel(estadoNorm),
      ingresos,
      deducciones,
      totales: {
        ingresos: totalIngresos,
        deducciones: totalDeducciones,
        liquido: roundMoney(totalIngresos - totalDeducciones),
      },
    };
  });
}
