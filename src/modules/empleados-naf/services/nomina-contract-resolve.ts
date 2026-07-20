import { prisma } from "@/modules/core/db/prisma";
import { normalizeCedula } from "@/modules/empleados/business/employee-identity";
import {
  normalizeRrhhContrato,
  rankContractCandidates,
} from "@/modules/empleados/business/contract-match";
import { normalizeLicitacionNo } from "@/modules/presupuestos/import/expense-rows";

export type NominaContractSource =
  | "rol"
  | "placement"
  | "empleado"
  | "zona"
  | "planilla"
  | "inferido";

export type ResolvedNominaContract = {
  noRol: string | null;
  contratoRrhh: string | null;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  contratoSource: NominaContractSource | null;
  unresolved: boolean;
};

type PlacementRow = {
  noRol: string | null;
  contrato: string | null;
  contratoNormalizado: string | null;
  contractId: string | null;
  updatedAt: Date;
};

type ContractInfo = {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
};

export type NominaContractContext = {
  roleContratoByRol: Map<string, string>;
  roleContratoByUbicacion: Map<string, string>;
  linkByRrhh: Map<string, string>;
  contractById: Map<string, ContractInfo>;
  contractIdByLicitacion: Map<string, string>;
  placementsByCedula: Map<string, PlacementRow[]>;
  placementsByCodigo: Map<string, PlacementRow[]>;
  contractsCatalog: ContractInfo[];
};

export type PeerContractHint = {
  contratoRrhh: string;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  noRol: string | null;
  share: number;
};

export type PeerContractHints = {
  byZona: Map<string, PeerContractHint>;
  byPlanilla: Map<string, PeerContractHint>;
  forcedByZona: Map<string, PeerContractHint>;
  forcedByPlanilla: Map<string, PeerContractHint>;
};

type EmployeeLookup = {
  cedula: string | null;
  noRol: string | null;
  contrato: string | null;
  ubicacionCode: string | null;
  zona: string | null;
};

function employeeCodigoKeys(noCia: string, noEmple: string): string[] {
  const trimmed = noEmple.trim();
  const unpadded = trimmed.replace(/^0+/, "") || trimmed;
  const padded = unpadded.padStart(6, "0");
  return [...new Set([`${noCia}|${trimmed}`, `${noCia}|${unpadded}`, `${noCia}|${padded}`])];
}

function cedulaKeys(raw: string | null): string[] {
  const full = normalizeCedula(raw);
  if (!full) return [];
  const unpadded = full.replace(/^0+/, "") || full;
  return [...new Set([full, unpadded])];
}

function pickPlacement(
  placements: PlacementRow[],
  preferredNoRol: string | null,
): PlacementRow | null {
  if (placements.length === 0) return null;

  if (preferredNoRol) {
    const byRol = placements.find(
      (p) => p.noRol === preferredNoRol && (p.contrato || p.contratoNormalizado || p.contractId),
    );
    if (byRol) return byRol;
  }

  const withContractId = placements.find((p) => p.contractId);
  if (withContractId) return withContractId;

  const withContrato = placements.find((p) => p.contrato || p.contratoNormalizado);
  if (withContrato) return withContrato;

  const withRol = placements.find((p) => p.noRol);
  if (withRol) return withRol;

  return placements[0] ?? null;
}

function finalizeResolvedContract(
  partial: {
    noRol: string | null;
    contratoRrhh: string | null;
    contratoSource: NominaContractSource | null;
    contractId?: string | null;
    licitacionNo?: string | null;
    client?: string | null;
  },
  ctx: NominaContractContext,
): ResolvedNominaContract {
  const contratoNormalizado = partial.contratoRrhh
    ? normalizeRrhhContrato(partial.contratoRrhh)
    : null;

  if (partial.contractId) {
    const contract = ctx.contractById.get(partial.contractId);
    return {
      noRol: partial.noRol,
      contratoRrhh: partial.contratoRrhh,
      contratoNormalizado,
      contractId: partial.contractId,
      licitacionNo: contract?.licitacionNo ?? partial.licitacionNo ?? partial.contratoRrhh,
      client: contract?.client ?? partial.client ?? null,
      contratoSource: partial.contratoSource,
      unresolved: false,
    };
  }

  const resolved = resolveContractId(partial.contratoRrhh, ctx);
  const hasContract = Boolean(resolved.contractId || contratoNormalizado || partial.contratoRrhh);

  return {
    noRol: partial.noRol,
    contratoRrhh: partial.contratoRrhh,
    contratoNormalizado,
    contractId: resolved.contractId,
    licitacionNo: resolved.licitacionNo,
    client: resolved.client,
    contratoSource: partial.contratoSource,
    unresolved: !hasContract,
  };
}

function resolveContractId(
  contratoRrhh: string | null,
  ctx: NominaContractContext,
): { contractId: string | null; licitacionNo: string | null; client: string | null } {
  const normalized = contratoRrhh ? normalizeRrhhContrato(contratoRrhh) : null;
  if (!normalized) {
    return { contractId: null, licitacionNo: null, client: null };
  }

  const contractId =
    ctx.linkByRrhh.get(normalized) ?? ctx.contractIdByLicitacion.get(normalized) ?? null;
  if (contractId) {
    const contract = ctx.contractById.get(contractId);
    return {
      contractId,
      licitacionNo: contract?.licitacionNo ?? contratoRrhh,
      client: contract?.client ?? null,
    };
  }

  const fuzzy = rankContractCandidates(normalized, ctx.contractsCatalog, 1)[0];
  if (fuzzy && fuzzy.score >= 85) {
    const contract = ctx.contractById.get(fuzzy.contractId);
    return {
      contractId: fuzzy.contractId,
      licitacionNo: contract?.licitacionNo ?? contratoRrhh,
      client: contract?.client ?? null,
    };
  }

  return { contractId: null, licitacionNo: contratoRrhh, client: null };
}

export async function buildNominaContractContext(): Promise<NominaContractContext> {
  const [roleRows, links, contracts, placements, employees] = await Promise.all([
    prisma.nafRoleContract.findMany({
      where: { estado: "A" },
      select: { noRol: true, noContrato: true, noUbicacion: true },
    }),
    prisma.employeeContractLink.findMany({
      select: { contratoRrhh: true, contractId: true },
    }),
    prisma.contract.findMany({
      where: { deletedAt: null },
      select: { id: true, licitacionNo: true, client: true, company: true },
    }),
    prisma.employeePlacement.findMany({
      select: {
        noRol: true,
        contrato: true,
        contratoNormalizado: true,
        contractId: true,
        updatedAt: true,
        companySapCode: true,
        employee: {
          select: {
            cedulaNormalizada: true,
            codigoEmpleado: true,
            companySapCode: true,
          },
        },
      },
    }),
    prisma.employee.findMany({
      select: {
        codigoEmpleado: true,
        cedulaNormalizada: true,
        companySapCode: true,
      },
    }),
  ]);

  const roleContratoByRol = new Map<string, string>();
  const roleContratoByUbicacion = new Map<string, string>();
  for (const row of roleRows) {
    if (!roleContratoByRol.has(row.noRol)) {
      roleContratoByRol.set(row.noRol, row.noContrato);
    }
    if (row.noUbicacion && !roleContratoByUbicacion.has(row.noUbicacion)) {
      roleContratoByUbicacion.set(row.noUbicacion, row.noContrato);
    }
  }

  const linkByRrhh = new Map(links.map((l) => [l.contratoRrhh, l.contractId]));
  const contractById = new Map(contracts.map((c) => [c.id, c]));
  const contractIdByLicitacion = new Map<string, string>();
  for (const c of contracts) {
    const key = normalizeLicitacionNo(c.licitacionNo);
    contractIdByLicitacion.set(key, c.id);
    contractIdByLicitacion.set(c.licitacionNo.trim(), c.id);
  }

  const placementsByCedula = new Map<string, PlacementRow[]>();
  const placementsByCodigo = new Map<string, PlacementRow[]>();

  const pushPlacement = (map: Map<string, PlacementRow[]>, key: string, row: PlacementRow) => {
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  };

  for (const row of placements) {
    const placement: PlacementRow = {
      noRol: row.noRol,
      contrato: row.contrato,
      contratoNormalizado: row.contratoNormalizado,
      contractId: row.contractId,
      updatedAt: row.updatedAt,
    };

    for (const key of cedulaKeys(row.employee.cedulaNormalizada)) {
      pushPlacement(placementsByCedula, key, placement);
    }

    const sap = row.companySapCode ?? row.employee.companySapCode;
    if (sap) {
      for (const codigoKey of employeeCodigoKeys(sap, row.employee.codigoEmpleado)) {
        pushPlacement(placementsByCodigo, codigoKey, placement);
      }
    }
  }

  for (const employee of employees) {
    const sap = employee.companySapCode ?? "";
    if (!sap) continue;
    const keys = employeeCodigoKeys(sap, employee.codigoEmpleado);
    if (placementsByCodigo.has(keys[0])) continue;
    for (const key of cedulaKeys(employee.cedulaNormalizada)) {
      const fromCedula = placementsByCedula.get(key);
      if (!fromCedula?.length) continue;
      for (const codigoKey of keys) {
        for (const placement of fromCedula) {
          pushPlacement(placementsByCodigo, codigoKey, placement);
        }
      }
      break;
    }
  }

  for (const map of [placementsByCedula, placementsByCodigo]) {
    for (const [key, rows] of map) {
      rows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      map.set(key, rows);
    }
  }

  return {
    roleContratoByRol,
    roleContratoByUbicacion,
    linkByRrhh,
    contractById,
    contractIdByLicitacion,
    placementsByCedula,
    placementsByCodigo,
    contractsCatalog: contracts,
  };
}

function lookupPlacements(
  employee: EmployeeLookup,
  noCia: string,
  noEmple: string,
  ctx: NominaContractContext,
): PlacementRow[] {
  const byCodigo = employeeCodigoKeys(noCia, noEmple).flatMap(
    (key) => ctx.placementsByCodigo.get(key) ?? [],
  );
  if (byCodigo.length) return byCodigo;

  return cedulaKeys(employee.cedula).flatMap((key) => ctx.placementsByCedula.get(key) ?? []);
}

export function resolveNominaContract(
  employee: EmployeeLookup,
  noCia: string,
  noEmple: string,
  codPla: string,
  ctx: NominaContractContext,
  peerHints?: PeerContractHints,
): ResolvedNominaContract {
  const placements = lookupPlacements(employee, noCia, noEmple, ctx);
  const placement = pickPlacement(placements, employee.noRol);
  const noRol = employee.noRol ?? placement?.noRol ?? null;

  let contratoRrhh: string | null = null;
  let contratoSource: NominaContractSource | null = null;
  let contractId: string | null = null;
  let licitacionNo: string | null = null;
  let client: string | null = null;

  if (noRol) {
    const fromRol = ctx.roleContratoByRol.get(noRol);
    if (fromRol) {
      contratoRrhh = fromRol;
      contratoSource = "rol";
    }
  }

  if (!contratoRrhh && employee.ubicacionCode) {
    const fromUbicacion = ctx.roleContratoByUbicacion.get(employee.ubicacionCode);
    if (fromUbicacion) {
      contratoRrhh = fromUbicacion;
      contratoSource = "rol";
    }
  }

  if (!contratoRrhh && placement) {
    contratoRrhh = placement.contrato ?? placement.contratoNormalizado ?? null;
    if (contratoRrhh) contratoSource = "placement";
    contractId = placement.contractId;
  }

  if (!contratoRrhh && employee.contrato) {
    contratoRrhh = employee.contrato;
    contratoSource = "empleado";
  }

  if (!contratoRrhh && employee.zona && peerHints) {
    const hint = peerHints.byZona.get(`${noCia}|${employee.zona.trim()}`);
    if (hint) {
      contratoRrhh = hint.contratoRrhh;
      contratoSource = "zona";
      contractId = hint.contractId;
      licitacionNo = hint.licitacionNo;
      client = hint.client;
    }
  }

  if (!contratoRrhh && peerHints) {
    const hint = peerHints.byPlanilla.get(`${noCia}|${codPla}`);
    if (hint) {
      contratoRrhh = hint.contratoRrhh;
      contratoSource = "planilla";
      contractId = hint.contractId;
      licitacionNo = hint.licitacionNo;
      client = hint.client;
    }
  }

  return finalizeResolvedContract(
    { noRol, contratoRrhh, contratoSource, contractId, licitacionNo, client },
    ctx,
  );
}

function buildHintFromCounts(
  counts: Map<string, {
    contratoRrhh: string;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    noRol: string | null;
    count: number;
  }>,
  minShare = 0.45,
): PeerContractHint | null {
  let best: {
    contratoRrhh: string;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    noRol: string | null;
    count: number;
  } | null = null;
  let total = 0;
  for (const value of counts.values()) total += value.count;
  if (total === 0) return null;

  for (const value of counts.values()) {
    if (!best || value.count > best.count) best = value;
  }
  if (!best) return null;

  const share = best.count / total;
  const distinctContracts = counts.size;
  if (distinctContracts > 1 && share < minShare) return null;

  return {
    contratoRrhh: best.contratoRrhh,
    contratoNormalizado: best.contratoNormalizado,
    contractId: best.contractId,
    licitacionNo: best.licitacionNo,
    client: best.client,
    noRol: best.noRol,
    share,
  };
}

function buildForcedHint(
  counts: Map<string, {
    contratoRrhh: string;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    noRol: string | null;
    count: number;
  }>,
): PeerContractHint | null {
  let best: {
    contratoRrhh: string;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    noRol: string | null;
    count: number;
  } | null = null;
  for (const value of counts.values()) {
    if (!best) {
      best = value;
      continue;
    }
    if (value.contractId && !best.contractId) {
      best = value;
      continue;
    }
    if (value.count > best.count) best = value;
  }
  if (!best) return null;
  const total = [...counts.values()].reduce((sum, row) => sum + row.count, 0);
  return {
    contratoRrhh: best.contratoRrhh,
    contratoNormalizado: best.contratoNormalizado,
    contractId: best.contractId,
    licitacionNo: best.licitacionNo,
    client: best.client,
    noRol: best.noRol,
    share: total > 0 ? best.count / total : 1,
  };
}

export function buildPeerContractHints(
  rows: Array<{
    noCia: string;
    codPla: string;
    zona: string | null;
    resolved: ResolvedNominaContract;
  }>,
): PeerContractHints {
  const zonaCounts = new Map<string, Map<string, {
    contratoRrhh: string;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    noRol: string | null;
    count: number;
  }>>();
  const planillaCounts = new Map<string, Map<string, {
    contratoRrhh: string;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    noRol: string | null;
    count: number;
  }>>();

  for (const row of rows) {
    if (row.resolved.unresolved || !row.resolved.contratoRrhh) continue;
    const bucket = {
      contratoRrhh: row.resolved.contratoRrhh,
      contratoNormalizado: row.resolved.contratoNormalizado,
      contractId: row.resolved.contractId,
      licitacionNo: row.resolved.licitacionNo,
      client: row.resolved.client,
      noRol: row.resolved.noRol,
      count: 1,
    };
    const contractKey =
      row.resolved.contractId ??
      row.resolved.contratoNormalizado ??
      row.resolved.contratoRrhh;

    if (row.zona?.trim()) {
      const zonaKey = `${row.noCia}|${row.zona.trim()}`;
      const map = zonaCounts.get(zonaKey) ?? new Map();
      const current = map.get(contractKey) ?? { ...bucket, count: 0 };
      current.count += 1;
      map.set(contractKey, current);
      zonaCounts.set(zonaKey, map);
    }

    const planillaKey = `${row.noCia}|${row.codPla}`;
    const map = planillaCounts.get(planillaKey) ?? new Map();
    const current = map.get(contractKey) ?? { ...bucket, count: 0 };
    current.count += 1;
    map.set(contractKey, current);
    planillaCounts.set(planillaKey, map);
  }

  const hintsByZona = new Map<string, PeerContractHint>();
  const forcedByZona = new Map<string, PeerContractHint>();
  for (const [key, counts] of zonaCounts) {
    const hint = buildHintFromCounts(counts, 0.4);
    if (hint) hintsByZona.set(key, hint);
    const forced = buildForcedHint(counts);
    if (forced) forcedByZona.set(key, forced);
  }

  const hintsByPlanilla = new Map<string, PeerContractHint>();
  const forcedByPlanilla = new Map<string, PeerContractHint>();
  for (const [key, counts] of planillaCounts) {
    const hint = buildHintFromCounts(counts, 0.35);
    if (hint) hintsByPlanilla.set(key, hint);
    const forced = buildForcedHint(counts);
    if (forced) forcedByPlanilla.set(key, forced);
  }

  return {
    byZona: hintsByZona,
    byPlanilla: hintsByPlanilla,
    forcedByZona,
    forcedByPlanilla,
  };
}

export function applyPeerHint(
  current: ResolvedNominaContract,
  noCia: string,
  codPla: string,
  zona: string | null,
  peerHints: PeerContractHints,
  ctx: NominaContractContext,
): ResolvedNominaContract {
  if (!current.unresolved) return current;

  const zonaHint = zona?.trim()
    ? (peerHints.byZona.get(`${noCia}|${zona.trim()}`) ??
      peerHints.forcedByZona.get(`${noCia}|${zona.trim()}`))
    : null;
  const planillaHint =
    peerHints.byPlanilla.get(`${noCia}|${codPla}`) ??
    peerHints.forcedByPlanilla.get(`${noCia}|${codPla}`);
  const hint = zonaHint ?? planillaHint;
  if (!hint) return current;

  const usedZona = Boolean(zonaHint);
  return finalizeResolvedContract(
    {
      noRol: current.noRol ?? hint.noRol,
      contratoRrhh: hint.contratoRrhh,
      contratoSource: usedZona ? "zona" : hint.share < 0.35 ? "inferido" : "planilla",
      contractId: hint.contractId,
      licitacionNo: hint.licitacionNo,
      client: hint.client,
    },
    ctx,
  );
}

export type NafNominaContratoResumen = {
  contratoRrhh: string;
  contratoNormalizado: string | null;
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  empleados: number;
  dias?: number;
  horas?: number;
  pagoRol?: number;
  devengado: number;
  deducciones: number;
  neto: number;
  sinVinculo: boolean;
  /** directa = rol/placement/empleado; inferida = fila de resumen sin contrato fiable */
  clasificacion?: "directa" | "inferida";
};

const DIRECT_CONTRACT_SOURCES = new Set<NominaContractSource>(["rol", "placement", "empleado"]);

export function aggregateNominaByContrato(
  rows: Array<{
    sourceKey: string;
    contratoRrhh: string | null;
    contratoNormalizado: string | null;
    contractId: string | null;
    licitacionNo: string | null;
    client: string | null;
    contratoSource?: NominaContractSource | null;
    devengado: number;
    deducciones: number;
    neto: number;
    unresolved?: boolean;
  }>,
): NafNominaContratoResumen[] {
  const agg = new Map<
    string,
    NafNominaContratoResumen & { empleadoIds: Set<string> }
  >();
  const inferredBucket = {
    empleadoIds: new Set<string>(),
    devengado: 0,
    deducciones: 0,
    neto: 0,
  };

  for (const row of rows) {
    const isDirect =
      !row.unresolved &&
      Boolean(row.contratoRrhh) &&
      Boolean(row.contratoSource && DIRECT_CONTRACT_SOURCES.has(row.contratoSource));

    if (!isDirect) {
      if (!row.unresolved && row.contratoRrhh) {
        inferredBucket.empleadoIds.add(row.sourceKey);
        inferredBucket.devengado += row.devengado;
        inferredBucket.deducciones += row.deducciones;
        inferredBucket.neto += row.neto;
      }
      continue;
    }

    const key = row.contractId ?? row.contratoNormalizado ?? row.contratoRrhh!;
    const current = agg.get(key) ?? {
      contratoRrhh: row.contratoRrhh!,
      contratoNormalizado: row.contratoNormalizado,
      contractId: row.contractId,
      licitacionNo: row.licitacionNo,
      client: row.client,
      empleados: 0,
      devengado: 0,
      deducciones: 0,
      neto: 0,
      sinVinculo: !row.contractId,
      clasificacion: "directa" as const,
      empleadoIds: new Set<string>(),
    };

    current.empleadoIds.add(row.sourceKey);
    current.empleados = current.empleadoIds.size;
    current.devengado += row.devengado;
    current.deducciones += row.deducciones;
    current.neto += row.neto;
    if (row.contractId) current.sinVinculo = false;
    agg.set(key, current);
  }

  const result = Array.from(agg.values())
    .map(({ empleadoIds: _empleadoIds, ...row }) => row)
    .sort((a, b) => b.neto - a.neto);

  if (inferredBucket.empleadoIds.size > 0) {
    result.push({
      contratoRrhh: "SIN-CLASIFICAR",
      contratoNormalizado: null,
      contractId: null,
      licitacionNo: null,
      client: "Salario sin contrato fiable (inferido por planilla/zona)",
      empleados: inferredBucket.empleadoIds.size,
      devengado: inferredBucket.devengado,
      deducciones: inferredBucket.deducciones,
      neto: inferredBucket.neto,
      sinVinculo: true,
      clasificacion: "inferida",
    });
  }

  return result;
}

export function countUnresolvedEmployees(
  rows: Array<{ sourceKey: string; unresolved?: boolean; contratoRrhh: string | null }>,
): number {
  const unresolved = new Set<string>();
  for (const row of rows) {
    if (row.unresolved || !row.contratoRrhh) unresolved.add(row.sourceKey);
  }
  return unresolved.size;
}
