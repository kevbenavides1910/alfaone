import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

const NAF_NOMINA_SUMMARY_QUERY = `
SELECT
  h.NO_CIA,
  h.NO_EMPLE,
  h.ANO,
  h.MES,
  h.PERIODO,
  h.COD_PLA,
  SUM(CASE WHEN h.TIPO_M = 'I' THEN NVL(h.MONTO, 0) ELSE 0 END) AS DEVENG,
  SUM(
    CASE
      WHEN h.TIPO_M = 'D' AND NVL(h.SOLO_CIA, 'N') = 'N' THEN NVL(h.MONTO, 0)
      ELSE 0
    END
  ) AS DEDUC,
  MAX(vn.DESCRI_NOMINA) AS DESCRI_NOMINA
FROM NAF5.ARPLHS h
LEFT JOIN (
  SELECT NO_CIA, COD_PLA, MAX(DESCRI_NOMINA) AS DESCRI_NOMINA
  FROM NAF5.V_APRL_NOMINAS
  GROUP BY NO_CIA, COD_PLA
) vn ON vn.NO_CIA = h.NO_CIA AND vn.COD_PLA = h.COD_PLA
WHERE h.ANO = :ano
GROUP BY h.NO_CIA, h.NO_EMPLE, h.ANO, h.MES, h.PERIODO, h.COD_PLA
`;

const NAF_NOMINA_PERIOD_META_QUERY = `
SELECT
  NO_CIA,
  COD_PLA,
  ANO_PROCE,
  MES_PROCE,
  NO_PLANI,
  DESCRI,
  F_DESDE,
  F_HASTA,
  F_CALCULO,
  TIPO_EMP
FROM NAF5.ARPLHCP
WHERE ANO_PROCE = :ano
`;

/** Planillas abiertas/en proceso (antes de cerrar a ARPLHCP/ARPLHS). */
const NAF_NOMINA_OPEN_PERIOD_QUERY = `
SELECT
  NO_CIA,
  LPAD(TRIM(CODPLA), 2, '0') AS COD_PLA,
  ANO_PROCE,
  MES_PROCE,
  NO_PLANI,
  DESCRI,
  F_DESDE,
  F_HASTA,
  F_CALCULO,
  TIPO_EMP,
  ESTADO
FROM NAF5.ARPLCP
WHERE ANO_PROCE = :ano
  AND ESTADO IN ('C', 'M', 'A')
  AND F_DESDE IS NOT NULL
  AND F_HASTA IS NOT NULL
  AND F_HASTA - F_DESDE <= 45
`;

/**
 * Solo empleados con ingresos (ARPLPPI), como RPL3071 / Codisa.
 * Evita arrastrar deducciones huérfanas (p.ej. embargos manuales de
 * empleados inactivos sin salario en la planilla).
 *
 * COD_PLA se empareja en forma exacta con ARPLCP.CODPLA (TRIM), igual que Codisa.
 * No usar LPAD sobre PPI/PPD: filas basura con COD_PLA='4' se mezclaban con '04'
 * e inflaban embargos / deducciones vs el reporte para firmar.
 *
 * ESTATUS='A' en ARPLPPD: RPL3071 ignora deducciones anuladas (ESTATUS='X'),
 * p.ej. daños/multas suspendidos que inflaban el total vs el reporte para firmar.
 */
const NAF_NOMINA_OPEN_SUMMARY_QUERY = `
SELECT
  p.NO_CIA,
  p.COD_PLA,
  p.NO_EMPLE,
  p.DEVENG,
  NVL(d.DEDUC, 0) AS DEDUC
FROM (
  SELECT
    i.NO_CIA,
    LPAD(TRIM(c.CODPLA), 2, '0') AS COD_PLA,
    i.NO_EMPLE,
    SUM(NVL(i.MONTO, 0)) AS DEVENG
  FROM NAF5.ARPLPPI i
  INNER JOIN NAF5.ARPLCP c
    ON c.NO_CIA = i.NO_CIA
   AND TRIM(c.CODPLA) = TRIM(i.COD_PLA)
   AND c.ESTADO IN ('C', 'M', 'A')
   AND c.F_DESDE IS NOT NULL
   AND c.F_HASTA IS NOT NULL
   AND c.F_HASTA - c.F_DESDE <= 45
  GROUP BY i.NO_CIA, LPAD(TRIM(c.CODPLA), 2, '0'), i.NO_EMPLE
) p
LEFT JOIN (
  SELECT
    d.NO_CIA,
    LPAD(TRIM(c.CODPLA), 2, '0') AS COD_PLA,
    d.NO_EMPLE,
    SUM(
      CASE
        WHEN NVL(d.SOLO_CIA, 'N') = 'N' AND NVL(d.ESTATUS, 'A') = 'A'
        THEN NVL(d.MONTO, 0)
        ELSE 0
      END
    ) AS DEDUC
  FROM NAF5.ARPLPPD d
  INNER JOIN NAF5.ARPLCP c
    ON c.NO_CIA = d.NO_CIA
   AND TRIM(c.CODPLA) = TRIM(d.COD_PLA)
   AND c.ESTADO IN ('C', 'M', 'A')
   AND c.F_DESDE IS NOT NULL
   AND c.F_HASTA IS NOT NULL
   AND c.F_HASTA - c.F_DESDE <= 45
  GROUP BY d.NO_CIA, LPAD(TRIM(c.CODPLA), 2, '0'), d.NO_EMPLE
) d
  ON d.NO_CIA = p.NO_CIA
 AND d.COD_PLA = p.COD_PLA
 AND d.NO_EMPLE = p.NO_EMPLE
`;

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asDecimal(value: unknown): Prisma.Decimal {
  if (value == null || value === "") return new Prisma.Decimal(0);
  const n = Number(value);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : new Prisma.Decimal(0);
}

function mapSummaryRow(row: OracleRow, syncedAt: Date) {
  const noCia = asString(row.NO_CIA);
  const noEmple = asString(row.NO_EMPLE);
  const ano = asInt(row.ANO);
  const mes = asInt(row.MES);
  const periodo = asInt(row.PERIODO);
  const codPla = asString(row.COD_PLA);
  if (!noCia || !noEmple || ano == null || mes == null || periodo == null || !codPla) {
    throw new Error("Fila ARPLHS agregada incompleta");
  }
  const devengado = asDecimal(row.DEVENG);
  const deducciones = asDecimal(row.DEDUC);
  const neto = devengado.minus(deducciones);
  return {
    noCia,
    noEmple,
    ano,
    periodo,
    mes,
    codPla,
    nominaNombre: asString(row.DESCRI_NOMINA),
    devengado,
    deducciones,
    neto,
    syncedAt,
  };
}

function mapPeriodMetaRow(row: OracleRow, syncedAt: Date) {
  const noCia = asString(row.NO_CIA);
  const codPla = asString(row.COD_PLA);
  const ano = asInt(row.ANO_PROCE);
  const mes = asInt(row.MES_PROCE);
  const periodo = asInt(row.NO_PLANI);
  if (!noCia || !codPla || ano == null || mes == null || periodo == null) {
    throw new Error("Fila ARPLHCP incompleta");
  }
  return {
    noCia,
    codPla,
    ano,
    periodo,
    mes,
    fDesde: asDate(row.F_DESDE),
    fHasta: asDate(row.F_HASTA),
    fCalculo: asDate(row.F_CALCULO),
    tipoEmp: asString(row.TIPO_EMP),
    descri: asString(row.DESCRI),
    syncedAt,
  };
}

async function upsertSummaryBatch(batch: ReturnType<typeof mapSummaryRow>[]) {
  await prisma.$transaction(
    batch.map((mapped) =>
      prisma.nafNominaSummary.upsert({
        where: {
          noCia_ano_periodo_noEmple_codPla: {
            noCia: mapped.noCia,
            ano: mapped.ano,
            periodo: mapped.periodo,
            noEmple: mapped.noEmple,
            codPla: mapped.codPla,
          },
        },
        create: mapped,
        update: mapped,
      }),
    ),
  );
}

async function upsertPeriodMetaBatch(batch: ReturnType<typeof mapPeriodMetaRow>[]) {
  await prisma.$transaction(
    batch.map((mapped) =>
      prisma.nafNominaPeriodMeta.upsert({
        where: {
          noCia_codPla_ano_periodo: {
            noCia: mapped.noCia,
            codPla: mapped.codPla,
            ano: mapped.ano,
            periodo: mapped.periodo,
          },
        },
        create: mapped,
        update: mapped,
      }),
    ),
  );
}

function normalizeCodPla(value: string | null | undefined): string | null {
  const raw = asString(value);
  if (!raw) return null;
  if (/^\d+$/.test(raw) && raw.length < 2) return raw.padStart(2, "0");
  return raw;
}

/**
 * Planillas aún no cerradas: lee ARPLCP (control) + ARPLPPI/ARPLPPD (montos vivos)
 * y las materializa en las mismas tablas históricas para revisión / nómina.
 */
async function syncOpenPlanillas(
  ano: number,
  syncedAt: Date,
  batchSize: number,
): Promise<{ fetched: number; upserted: number }> {
  const [metaRows, amountRows] = await withNafOracleConnection(async (conn) => {
    const meta = await conn.execute<OracleRow>(NAF_NOMINA_OPEN_PERIOD_QUERY, { ano });
    const amounts = await conn.execute<OracleRow>(NAF_NOMINA_OPEN_SUMMARY_QUERY);
    return [meta.rows ?? [], amounts.rows ?? []];
  });

  if (metaRows.length === 0) {
    return { fetched: amountRows.length, upserted: 0 };
  }

  const openKeys = new Set<string>();
  const mappedMeta: ReturnType<typeof mapPeriodMetaRow>[] = [];
  for (const row of metaRows) {
    const noCia = asString(row.NO_CIA);
    const codPla = normalizeCodPla(asString(row.COD_PLA));
    const periodo = asInt(row.NO_PLANI);
    const mes = asInt(row.MES_PROCE);
    if (!noCia || !codPla || periodo == null || mes == null) continue;
    openKeys.add(`${noCia}|${codPla}`);
    mappedMeta.push(
      mapPeriodMetaRow(
        {
          NO_CIA: noCia,
          COD_PLA: codPla,
          ANO_PROCE: ano,
          MES_PROCE: mes,
          NO_PLANI: periodo,
          DESCRI: asString(row.DESCRI),
          F_DESDE: row.F_DESDE,
          F_HASTA: row.F_HASTA,
          F_CALCULO: row.F_CALCULO,
          /** Reutilizamos tipoEmp para estado de planilla abierta (C/M/A). */
          TIPO_EMP: asString(row.ESTADO),
        },
        syncedAt,
      ),
    );
  }

  let upserted = 0;
  for (let i = 0; i < mappedMeta.length; i += batchSize) {
    const batch = mappedMeta.slice(i, i + batchSize);
    await upsertPeriodMetaBatch(batch);
    upserted += batch.length;
  }

  /** Meta por (noCia|codPla) → periodo abierto vigente (el de mayor NO_PLANI). */
  const metaByPlanilla = new Map<string, ReturnType<typeof mapPeriodMetaRow>>();
  for (const meta of mappedMeta) {
    const key = `${meta.noCia}|${meta.codPla}`;
    const prev = metaByPlanilla.get(key);
    if (!prev || meta.periodo >= prev.periodo) metaByPlanilla.set(key, meta);
  }

  const nombreByPlanilla = new Map(
    mappedMeta.map((m) => [`${m.noCia}|${m.codPla}`, m.descri] as const),
  );

  const summaryBatch: ReturnType<typeof mapSummaryRow>[] = [];
  for (const row of amountRows) {
    const noCia = asString(row.NO_CIA);
    const codPla = normalizeCodPla(asString(row.COD_PLA));
    const noEmple = asString(row.NO_EMPLE);
    if (!noCia || !codPla || !noEmple) continue;
    if (!openKeys.has(`${noCia}|${codPla}`)) continue;
    const meta = metaByPlanilla.get(`${noCia}|${codPla}`);
    if (!meta) continue;
    const devengado = asDecimal(row.DEVENG);
    const deducciones = asDecimal(row.DEDUC);
    summaryBatch.push({
      noCia,
      noEmple,
      ano: meta.ano,
      periodo: meta.periodo,
      mes: meta.mes,
      codPla,
      nominaNombre: nombreByPlanilla.get(`${noCia}|${codPla}`) ?? null,
      devengado,
      deducciones,
      neto: devengado.minus(deducciones),
      syncedAt,
    });
  }

  for (let i = 0; i < summaryBatch.length; i += batchSize) {
    const batch = summaryBatch.slice(i, i + batchSize);
    await upsertSummaryBatch(batch);
    upserted += batch.length;
  }

  // Quitar empleados que ya no aplican (p.ej. solo tenían deducción huérfana).
  const keepByPlanilla = new Map<string, Set<string>>();
  for (const row of summaryBatch) {
    const key = `${row.noCia}|${row.codPla}|${row.ano}|${row.periodo}`;
    let set = keepByPlanilla.get(key);
    if (!set) {
      set = new Set();
      keepByPlanilla.set(key, set);
    }
    set.add(row.noEmple);
  }
  for (const meta of metaByPlanilla.values()) {
    const key = `${meta.noCia}|${meta.codPla}|${meta.ano}|${meta.periodo}`;
    const keep = keepByPlanilla.get(key) ?? new Set<string>();
    await prisma.nafNominaSummary.deleteMany({
      where: {
        noCia: meta.noCia,
        codPla: meta.codPla,
        ano: meta.ano,
        periodo: meta.periodo,
        ...(keep.size > 0 ? { noEmple: { notIn: [...keep] } } : {}),
      },
    });
  }

  return { fetched: metaRows.length + amountRows.length, upserted };
}

export type NafNominaSyncResult = {
  runId: string;
  rowsFetched: number;
  rowsUpserted: number;
  desdeAno: number;
  finishedAt: Date;
};

export async function syncNafNomina(options?: {
  triggeredBy?: string;
  desdeAno?: number;
}): Promise<NafNominaSyncResult> {
  const currentYear = new Date().getFullYear();
  const desdeAno = options?.desdeAno ?? currentYear;

  const run = await prisma.nafNominaSyncRun.create({
    data: {
      status: "running",
      triggeredBy: options?.triggeredBy ?? "system",
      desdeAno,
    },
  });

  try {
    const syncedAt = new Date();
    let rowsFetched = 0;
    let rowsUpserted = 0;
    const batchSize = 200;

    for (let ano = desdeAno; ano <= currentYear; ano++) {
      const [summaryRows, metaRows] = await withNafOracleConnection(async (conn) => {
        const summary = await conn.execute<OracleRow>(NAF_NOMINA_SUMMARY_QUERY, { ano });
        const meta = await conn.execute<OracleRow>(NAF_NOMINA_PERIOD_META_QUERY, { ano });
        return [summary.rows ?? [], meta.rows ?? []];
      });

      rowsFetched += summaryRows.length + metaRows.length;

      for (let i = 0; i < summaryRows.length; i += batchSize) {
        const batch = summaryRows.slice(i, i + batchSize).map((row) => mapSummaryRow(row, syncedAt));
        await upsertSummaryBatch(batch);
        rowsUpserted += batch.length;
      }

      for (let i = 0; i < metaRows.length; i += batchSize) {
        const batch = metaRows.slice(i, i + batchSize).map((row) => mapPeriodMetaRow(row, syncedAt));
        await upsertPeriodMetaBatch(batch);
        rowsUpserted += batch.length;
      }

      // Abiertas / en cálculo (RPL3071 etc.) — ARPLCP + PPI/PPD.
      const open = await syncOpenPlanillas(ano, syncedAt, batchSize);
      rowsFetched += open.fetched;
      rowsUpserted += open.upserted;
    }

    const finishedAt = new Date();
    await prisma.nafNominaSyncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt,
        rowsFetched,
        rowsUpserted,
      },
    });

    void (async () => {
      try {
        const { invalidateContractMonthLaborCacheForYear } = await import(
          "@/modules/empleados-naf/services/contract-month-labor-cache"
        );
        for (let ano = desdeAno; ano <= currentYear; ano++) {
          await invalidateContractMonthLaborCacheForYear(ano);
        }
      } catch (error) {
        console.warn("[sync-nomina] no se pudo invalidar caché MO mensual:", error);
      }
    })();

    return {
      runId: run.id,
      rowsFetched,
      rowsUpserted,
      desdeAno,
      finishedAt,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.nafNominaSyncRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    throw e;
  }
}

export async function getLatestNafNominaSyncRun() {
  return prisma.nafNominaSyncRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
}
