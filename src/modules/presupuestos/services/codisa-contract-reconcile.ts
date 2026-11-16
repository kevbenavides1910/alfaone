/**
 * Conciliación Codisa (NAF5.ARCOMC) ↔ contratos Alfa-One/Neo.
 * Completa en Postgres los campos que ARCOMC no tiene, usando datos de One.
 * Fetch: solo contratos activos (ESTADO = 'A').
 */

import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

export const SAP_TO_COMPANY: Record<string, string> = {
  "01": "ALFA",
  "02": "TANGO",
  "03": "MONITOREO",
  "04": "BENA",
  "05": "CONSORCIO",
  "06": "GRUPO",
  "08": "DESARROLLOS",
  "09": "ALFATRONIC",
  "10": "JOBEN",
  "11": "BENLO",
  "15": "KBA",
  "30": "ACE",
  "31": "AS",
};

export type CodisaContractRow = {
  NO_CIA: string;
  NO_CONTRATO: string;
  NO_LICITACION: string | null;
  ESTADO: string | null;
  TIPO_CONTRATO: string | null;
  CLASE_CONTRATO: string | null;
  NO_CLIENTE: string | null;
  CLIENTE: string | null;
  EXCENTO_IMP: string | null;
  FECHA_INI: string | null;
  FECHA_FIN: string | null;
  MONTO_FACTURAR: number | null;
  PORC_PRESUP_MANO_OBRA: number | null;
  PORC_PRESUP_GAST_ADM: number | null;
  PORC_PRESUP_INSUMOS: number | null;
  PORC_PRESUP_UTILIDAD: number | null;
  DIA_FACTURAR_I: number | null;
  DIA_PERIODO_I: number | null;
  DIA_PERIODO_II: number | null;
  OBSERVACIONES: string | null;
};

export type NeoContractAutocomplete = {
  noCia: string;
  noContrato: string;
  noLicitacion: string | null;
  companyCode: string | null;
  codisa: {
    estado: string | null;
    tipoContrato: string | null;
    claseContrato: string | null;
    cliente: string | null;
    fechaIni: string | null;
    fechaFin: string | null;
    montoFacturar: number | null;
    pctManoObra: number | null;
    pctAdmin: number | null;
    pctInsumos: number | null;
    pctUtilidad: number | null;
    diaFacturar: number | null;
    diaPeriodoI: number | null;
    diaPeriodoIi: number | null;
    observaciones: string | null;
    clienteExcentoImp: boolean;
  };
  extension: {
    contractId: string | null;
    officersCount: number | null;
    positionsCount: number | null;
    administrationsCount: number | null;
    ivaPct: number | null;
    billingPeriodToDay: number | null;
    matchMethod: string | null;
    source: string | null;
    lastReconciledAt: string | null;
  } | null;
  form: {
    licitacionNo: string;
    company: string | null;
    client: string | null;
    clientType: "PUBLIC" | "PRIVATE" | null;
    hiringType: "FIXED" | "ON_DEMAND" | null;
    status: string | null;
    officersCount: number | null;
    positionsCount: number | null;
    administrationsCount: number | null;
    monthlyBilling: number | null;
    ivaPct: number | null;
    billingDay: number | null;
    billingPeriodFromDay: number | null;
    billingPeriodToDay: number | null;
    laborPct: number | null;
    suppliesPct: number | null;
    adminPct: number | null;
    profitPct: number | null;
    startDate: string | null;
    endDate: string | null;
    notes: string | null;
  };
};

function normKey(s: string | null | undefined): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
}

function padCia(v: string | number | null | undefined): string {
  return String(v ?? "").trim().padStart(2, "0");
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function pct100ToFraction(v: number | null): number | null {
  if (v == null) return null;
  return Math.round((v / 100) * 10000) / 10000;
}

function mapEstado(cod: string | null): string | null {
  if (!cod) return null;
  if (cod === "A") return "ACTIVE";
  if (cod === "F") return "FINISHED";
  if (cod === "X") return "CANCELLED";
  if (cod === "T") return "OTHER_T";
  return cod;
}

function mapTipo(cod: string | null): "FIXED" | "ON_DEMAND" | null {
  if (cod === "C") return "FIXED";
  if (cod === "D") return "ON_DEMAND";
  return null;
}

function mapClase(cod: string | null): "PUBLIC" | "PRIVATE" | null {
  if (cod === "P") return "PUBLIC";
  if (cod === "R") return "PRIVATE";
  return null;
}

function inferIvaFromClient(excento: string | null, alfaIva: number | null): number {
  if (alfaIva != null && Number.isFinite(alfaIva)) return alfaIva;
  if ((excento || "").toUpperCase() === "S") return 0;
  return 13;
}

/** Solo contratos activos en Codisa (ESTADO = A). */
export async function fetchCodisaContractsFromOracle(): Promise<CodisaContractRow[]> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `SELECT c.NO_CIA,
              c.NO_CONTRATO,
              c.NO_LICITACION,
              c.ESTADO,
              c.TIPO_CONTRATO,
              c.CLASE_CONTRATO,
              c.NO_CLIENTE,
              (SELECT MAX(cl.NOMBRE) FROM NAF5.ARCCMC cl
                WHERE cl.NO_CIA = c.NO_CIA AND cl.NO_CLIENTE = c.NO_CLIENTE) CLIENTE,
              (SELECT MAX(cl.EXCENTO_IMP) FROM NAF5.ARCCMC cl
                WHERE cl.NO_CIA = c.NO_CIA AND cl.NO_CLIENTE = c.NO_CLIENTE) EXCENTO_IMP,
              TO_CHAR(c.FECHA_INI,'YYYY-MM-DD') FECHA_INI,
              TO_CHAR(c.FECHA_FIN,'YYYY-MM-DD') FECHA_FIN,
              c.MONTO_FACTURAR,
              c.PORC_PRESUP_MANO_OBRA,
              c.PORC_PRESUP_GAST_ADM,
              c.PORC_PRESUP_INSUMOS,
              c.PORC_PRESUP_UTILIDAD,
              c.DIA_FACTURAR_I,
              c.DIA_PERIODO_I,
              c.DIA_PERIODO_II,
              c.OBSERVACIONES
         FROM NAF5.ARCOMC c
        WHERE c.ESTADO = 'A'`,
    );
    const rows = (result.rows || []) as Record<string, unknown>[];
    return rows.map((r) => ({
      NO_CIA: padCia(r.NO_CIA as string),
      NO_CONTRATO: String(r.NO_CONTRATO || "").trim(),
      NO_LICITACION: r.NO_LICITACION != null ? String(r.NO_LICITACION).trim() : null,
      ESTADO: r.ESTADO != null ? String(r.ESTADO) : null,
      TIPO_CONTRATO: r.TIPO_CONTRATO != null ? String(r.TIPO_CONTRATO) : null,
      CLASE_CONTRATO: r.CLASE_CONTRATO != null ? String(r.CLASE_CONTRATO) : null,
      NO_CLIENTE: r.NO_CLIENTE != null ? String(r.NO_CLIENTE) : null,
      CLIENTE: r.CLIENTE != null ? String(r.CLIENTE) : null,
      EXCENTO_IMP: r.EXCENTO_IMP != null ? String(r.EXCENTO_IMP) : null,
      FECHA_INI: r.FECHA_INI != null ? String(r.FECHA_INI) : null,
      FECHA_FIN: r.FECHA_FIN != null ? String(r.FECHA_FIN) : null,
      MONTO_FACTURAR: toNum(r.MONTO_FACTURAR),
      PORC_PRESUP_MANO_OBRA: toNum(r.PORC_PRESUP_MANO_OBRA),
      PORC_PRESUP_GAST_ADM: toNum(r.PORC_PRESUP_GAST_ADM),
      PORC_PRESUP_INSUMOS: toNum(r.PORC_PRESUP_INSUMOS),
      PORC_PRESUP_UTILIDAD: toNum(r.PORC_PRESUP_UTILIDAD),
      DIA_FACTURAR_I: toNum(r.DIA_FACTURAR_I),
      DIA_PERIODO_I: toNum(r.DIA_PERIODO_I),
      DIA_PERIODO_II: toNum(r.DIA_PERIODO_II),
      OBSERVACIONES: r.OBSERVACIONES != null ? String(r.OBSERVACIONES) : null,
    }));
  });
}

type AlfaContractLite = {
  id: string;
  licitacionNo: string;
  company: string;
  officersCount: number;
  positionsCount: number;
  administrationsCount: number;
  ivaPct: Prisma.Decimal | number;
  billingPeriodToDay: number;
  companyEntity: { sapCode: string | null } | null;
};

type AliasLite = {
  licitacionNoOne: string;
  companyOne: string | null;
  noCia: string;
  noContrato: string;
};

type MatchMethod = "exact" | "licitacion" | "alias_manual";

function buildAlfaIndexes(alfa: AlfaContractLite[]) {
  const byLicitacion = new Map<string, AlfaContractLite[]>();
  for (const a of alfa) {
    const k = normKey(a.licitacionNo);
    if (!k) continue;
    const list = byLicitacion.get(k) || [];
    list.push(a);
    byLicitacion.set(k, list);
  }
  return { byLicitacion };
}

function buildAliasIndexes(aliases: AliasLite[]) {
  const byCodisaKey = new Map<string, AliasLite[]>();
  const byOneKey = new Map<string, AliasLite[]>();
  for (const a of aliases) {
    const ck = `${padCia(a.noCia)}|${normKey(a.noContrato)}`;
    const ckList = byCodisaKey.get(ck) || [];
    ckList.push(a);
    byCodisaKey.set(ck, ckList);

    const ok = normKey(a.licitacionNoOne);
    if (!ok) continue;
    const okList = byOneKey.get(ok) || [];
    okList.push(a);
    byOneKey.set(ok, okList);
  }
  return { byCodisaKey, byOneKey };
}

function pickAlfaMatch(
  c: CodisaContractRow,
  indexes: ReturnType<typeof buildAlfaIndexes>,
  aliasIndexes: ReturnType<typeof buildAliasIndexes>,
): { alfa: AlfaContractLite; method: MatchMethod } | null {
  const cia = padCia(c.NO_CIA);
  const tryKeys = [normKey(c.NO_CONTRATO), normKey(c.NO_LICITACION)].filter(Boolean);
  for (let i = 0; i < tryKeys.length; i++) {
    const list = indexes.byLicitacion.get(tryKeys[i]) || [];
    if (!list.length) continue;
    const bySap = list.find((a) => padCia(a.companyEntity?.sapCode || "") === cia);
    const alfa = bySap || list[0];
    return { alfa, method: i === 0 ? "exact" : "licitacion" };
  }

  const aliasHits =
    aliasIndexes.byCodisaKey.get(`${cia}|${normKey(c.NO_CONTRATO)}`) || [];
  for (const alias of aliasHits) {
    const list = indexes.byLicitacion.get(normKey(alias.licitacionNoOne)) || [];
    if (!list.length) continue;
    const byCompany = alias.companyOne
      ? list.find((a) => a.company === alias.companyOne)
      : null;
    const bySap = list.find((a) => padCia(a.companyEntity?.sapCode || "") === cia);
    return { alfa: byCompany || bySap || list[0], method: "alias_manual" };
  }
  return null;
}

export type ReconcileResult = {
  codisaTotal: number;
  alfaTotal: number;
  aliasTotal: number;
  matched: number;
  upserted: number;
  unmatchedCodisa: number;
  unmatchedAlfa: string[];
  byMethod: Record<string, number>;
};

/**
 * Lee Codisa activos + aliases PG + contratos One y hace upsert de
 * `codisa_contract_extensions` con oficiales, puestos, admins, IVA y fin de periodo.
 */
export async function reconcileCodisaContractExtensions(
  db: PrismaClient,
  options?: { dryRun?: boolean },
): Promise<ReconcileResult> {
  const dryRun = Boolean(options?.dryRun);
  const [codisa, alfa, aliases] = await Promise.all([
    fetchCodisaContractsFromOracle(),
    db.contract.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        licitacionNo: true,
        company: true,
        officersCount: true,
        positionsCount: true,
        administrationsCount: true,
        ivaPct: true,
        billingPeriodToDay: true,
        companyEntity: { select: { sapCode: true } },
      },
    }),
    db.codisaContractAlias.findMany({
      select: {
        licitacionNoOne: true,
        companyOne: true,
        noCia: true,
        noContrato: true,
      },
    }),
  ]);

  const indexes = buildAlfaIndexes(alfa);
  const aliasIndexes = buildAliasIndexes(aliases);
  const matchedAlfaIds = new Set<string>();
  const byMethod: Record<string, number> = {};
  let matched = 0;
  let upserted = 0;
  const now = new Date();

  for (const c of codisa) {
    const hit = pickAlfaMatch(c, indexes, aliasIndexes);
    if (!hit) continue;
    matched += 1;
    matchedAlfaIds.add(hit.alfa.id);
    byMethod[hit.method] = (byMethod[hit.method] || 0) + 1;

    const companyCode = SAP_TO_COMPANY[padCia(c.NO_CIA)] || hit.alfa.company;
    const ivaPct = inferIvaFromClient(c.EXCENTO_IMP, toNum(hit.alfa.ivaPct));
    const data = {
      contractId: hit.alfa.id,
      companyCode,
      officersCount: hit.alfa.officersCount,
      positionsCount: hit.alfa.positionsCount,
      administrationsCount: hit.alfa.administrationsCount,
      ivaPct: new Prisma.Decimal(ivaPct.toFixed(2)),
      billingPeriodToDay: hit.alfa.billingPeriodToDay,
      matchMethod: hit.method,
      source: "alfa_one",
      lastReconciledAt: now,
    };

    if (!dryRun) {
      await db.codisaContractExtension.upsert({
        where: {
          noCia_noContrato: {
            noCia: padCia(c.NO_CIA),
            noContrato: c.NO_CONTRATO,
          },
        },
        create: {
          noCia: padCia(c.NO_CIA),
          noContrato: c.NO_CONTRATO,
          ...data,
        },
        update: data,
      });
    }
    upserted += 1;
  }

  const unmatchedAlfa = alfa
    .filter((a) => !matchedAlfaIds.has(a.id))
    .map((a) => a.licitacionNo)
    .sort();

  return {
    codisaTotal: codisa.length,
    alfaTotal: alfa.length,
    aliasTotal: aliases.length,
    matched,
    upserted,
    unmatchedCodisa: codisa.length - matched,
    unmatchedAlfa,
    byMethod,
  };
}

function buildFormPayload(
  c: CodisaContractRow,
  ext: {
    officersCount: number | null;
    positionsCount: number | null;
    administrationsCount: number | null;
    ivaPct: Prisma.Decimal | number | null;
    billingPeriodToDay: number | null;
  } | null,
): NeoContractAutocomplete["form"] {
  const companyCode = SAP_TO_COMPANY[padCia(c.NO_CIA)] || null;
  const iva =
    ext?.ivaPct != null
      ? toNum(ext.ivaPct)
      : inferIvaFromClient(c.EXCENTO_IMP, null);
  const periodTo =
    ext?.billingPeriodToDay ??
    toNum(c.DIA_PERIODO_II) ??
    null;

  return {
    licitacionNo: c.NO_CONTRATO,
    company: companyCode,
    client: c.CLIENTE,
    clientType: mapClase(c.CLASE_CONTRATO),
    hiringType: mapTipo(c.TIPO_CONTRATO),
    status: mapEstado(c.ESTADO),
    officersCount: ext?.officersCount ?? null,
    positionsCount: ext?.positionsCount ?? null,
    administrationsCount: ext?.administrationsCount ?? null,
    monthlyBilling: c.MONTO_FACTURAR,
    ivaPct: iva,
    billingDay: toNum(c.DIA_FACTURAR_I),
    billingPeriodFromDay: toNum(c.DIA_PERIODO_I),
    billingPeriodToDay: periodTo,
    laborPct: pct100ToFraction(c.PORC_PRESUP_MANO_OBRA),
    suppliesPct: pct100ToFraction(c.PORC_PRESUP_INSUMOS),
    adminPct: pct100ToFraction(c.PORC_PRESUP_GAST_ADM),
    profitPct: pct100ToFraction(c.PORC_PRESUP_UTILIDAD),
    startDate: c.FECHA_INI,
    endDate: c.FECHA_FIN,
    notes: c.OBSERVACIONES,
  };
}

async function hydrateAutocomplete(
  db: PrismaClient,
  c: CodisaContractRow,
): Promise<NeoContractAutocomplete> {
  const ext = await db.codisaContractExtension.findUnique({
    where: {
      noCia_noContrato: {
        noCia: padCia(c.NO_CIA),
        noContrato: c.NO_CONTRATO,
      },
    },
  });

  return {
    noCia: padCia(c.NO_CIA),
    noContrato: c.NO_CONTRATO,
    noLicitacion: c.NO_LICITACION,
    companyCode: SAP_TO_COMPANY[padCia(c.NO_CIA)] || null,
    codisa: {
      estado: c.ESTADO,
      tipoContrato: c.TIPO_CONTRATO,
      claseContrato: c.CLASE_CONTRATO,
      cliente: c.CLIENTE,
      fechaIni: c.FECHA_INI,
      fechaFin: c.FECHA_FIN,
      montoFacturar: c.MONTO_FACTURAR,
      pctManoObra: c.PORC_PRESUP_MANO_OBRA,
      pctAdmin: c.PORC_PRESUP_GAST_ADM,
      pctInsumos: c.PORC_PRESUP_INSUMOS,
      pctUtilidad: c.PORC_PRESUP_UTILIDAD,
      diaFacturar: c.DIA_FACTURAR_I,
      diaPeriodoI: c.DIA_PERIODO_I,
      diaPeriodoIi: c.DIA_PERIODO_II,
      observaciones: c.OBSERVACIONES,
      clienteExcentoImp: (c.EXCENTO_IMP || "").toUpperCase() === "S",
    },
    extension: ext
      ? {
          contractId: ext.contractId,
          officersCount: ext.officersCount,
          positionsCount: ext.positionsCount,
          administrationsCount: ext.administrationsCount,
          ivaPct: toNum(ext.ivaPct),
          billingPeriodToDay: ext.billingPeriodToDay,
          matchMethod: ext.matchMethod,
          source: ext.source,
          lastReconciledAt: ext.lastReconciledAt?.toISOString() ?? null,
        }
      : null,
    form: buildFormPayload(c, ext),
  };
}

export type NeoContractLookupResult = {
  query: string;
  resolvedVia: "codisa_exact" | "codisa_licitacion" | "alias" | "none";
  oneLicitacionNo: string | null;
  parts: NeoContractAutocomplete[];
};

/**
 * Lookup Neo: Codisa (Oracle, solo A) + extensión/alias (Postgres).
 * Acepta nombre Codisa o nombre One (vía `codisa_contract_aliases`).
 */
export async function lookupNeoContractFromCodisa(
  db: PrismaClient,
  noContrato: string,
  noCia?: string | null,
): Promise<NeoContractLookupResult> {
  const key = noContrato.trim();
  const empty: NeoContractLookupResult = {
    query: key,
    resolvedVia: "none",
    oneLicitacionNo: null,
    parts: [],
  };
  if (!key) return empty;

  const [rows, aliases] = await Promise.all([
    fetchCodisaContractsFromOracle(),
    db.codisaContractAlias.findMany({
      select: {
        licitacionNoOne: true,
        companyOne: true,
        noCia: true,
        noContrato: true,
      },
    }),
  ]);

  const cia = noCia ? padCia(noCia) : null;
  const aliasIndexes = buildAliasIndexes(aliases);
  const byCodisa = new Map(
    rows.map((r) => [`${padCia(r.NO_CIA)}|${normKey(r.NO_CONTRATO)}`, r] as const),
  );

  const findCodisa = (ciaKey: string, contrato: string): CodisaContractRow | undefined =>
    byCodisa.get(`${padCia(ciaKey)}|${normKey(contrato)}`);

  const direct =
    rows.find(
      (r) =>
        normKey(r.NO_CONTRATO) === normKey(key) &&
        (!cia || padCia(r.NO_CIA) === cia),
    ) ||
    rows.find((r) => normKey(r.NO_CONTRATO) === normKey(key));

  if (direct) {
    const part = await hydrateAutocomplete(db, direct);
    return {
      query: key,
      resolvedVia: "codisa_exact",
      oneLicitacionNo: null,
      parts: [part],
    };
  }

  const byLicitacion = rows.filter(
    (r) =>
      r.NO_LICITACION &&
      normKey(r.NO_LICITACION) === normKey(key) &&
      (!cia || padCia(r.NO_CIA) === cia),
  );
  if (byLicitacion.length) {
    const parts = await Promise.all(byLicitacion.map((r) => hydrateAutocomplete(db, r)));
    return {
      query: key,
      resolvedVia: "codisa_licitacion",
      oneLicitacionNo: null,
      parts,
    };
  }

  const aliasHits = (aliasIndexes.byOneKey.get(normKey(key)) || []).filter(
    (a) => !cia || padCia(a.noCia) === cia,
  );
  if (aliasHits.length) {
    const seen = new Set<string>();
    const codisaRows: CodisaContractRow[] = [];
    for (const a of aliasHits) {
      const row = findCodisa(a.noCia, a.noContrato);
      if (!row) continue;
      const sk = `${padCia(row.NO_CIA)}|${row.NO_CONTRATO}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      codisaRows.push(row);
    }
    if (codisaRows.length) {
      const parts = await Promise.all(codisaRows.map((r) => hydrateAutocomplete(db, r)));
      return {
        query: key,
        resolvedVia: "alias",
        oneLicitacionNo: aliasHits[0].licitacionNoOne,
        parts,
      };
    }
  }

  return empty;
}

/** Autocomplete Neo (compat): primera parte del lookup Codisa + extensión. */
export async function getNeoContractAutocomplete(
  db: PrismaClient,
  noContrato: string,
  noCia?: string | null,
): Promise<NeoContractAutocomplete | null> {
  const result = await lookupNeoContractFromCodisa(db, noContrato, noCia);
  return result.parts[0] ?? null;
}

export async function listCodisaContractAliases(db: PrismaClient) {
  return db.codisaContractAlias.findMany({
    orderBy: [{ licitacionNoOne: "asc" }, { noContrato: "asc" }],
  });
}
