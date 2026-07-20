/**
 * Lista de activos sin E5 con zona NAF (mismo campo que Empleados NAF)
 * y seguimiento manual conforme se van completando.
 *
 * Persistencia bajo APP_DATA_ROOT/faltantes-e5/:
 * - baseline.json  → códigos capturados al generar/refrescar la lista
 * - tracking.json  → estado manual por noEmple
 */
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { appDataRoot } from "@/lib/storage/paths";
import { isNafEstadoActivo } from "@/modules/empleados-naf/business/employee-estado";
import {
  padNoEmple,
  expedienteTipoDir,
  pickBestExpedientePdfFilename,
} from "@/modules/expediente-digital/business/paths";
import {
  isExpedienteSmbConfigured,
  listExpedienteTipoFilenames,
} from "@/modules/expediente-digital/services/smb-expediente";

export type FaltanteE5Estado =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "COMPLETADO"
  | "NO_APLICA";

export type FaltanteE5Track = {
  noEmple: string;
  estado: FaltanteE5Estado;
  notas: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type FaltanteE5Item = {
  noEmple: string;
  cedula: string;
  nombre: string;
  noCia: string;
  puesto: string;
  fIngreso: string | null;
  /** Misma zona que Empleados NAF (`NafEmployee.zona`). */
  zona: string;
  zonaCode: string;
  ubicacionNombre: string;
  hasE5Live: boolean;
  e5Path: string | null;
  track: FaltanteE5Track;
  /** Estado efectivo para filtros/UI: si ya hay E5 vivo, cuenta como EN_EXPEDIENTE. */
  estadoEfectivo: FaltanteE5Estado | "EN_EXPEDIENTE";
};

export type FaltanteE5Summary = {
  total: number;
  pendientes: number;
  enProceso: number;
  completados: number;
  noAplica: number;
  enExpediente: number;
  sinZona: number;
  porZona: Record<string, number>;
};

type BaselineFile = {
  generatedAt: string;
  codes: string[];
};

function dataRoot(): string {
  const fromEnv = process.env.FALTANTES_E5_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(appDataRoot(), "faltantes-e5");
}

function baselinePath(): string {
  return path.join(dataRoot(), "baseline.json");
}

function trackingPath(): string {
  return path.join(dataRoot(), "tracking.json");
}

async function ensureRoot(): Promise<void> {
  await fs.mkdir(dataRoot(), { recursive: true });
}

async function loadTracking(): Promise<Record<string, FaltanteE5Track>> {
  try {
    const raw = await fs.readFile(trackingPath(), "utf8");
    const data = JSON.parse(raw) as Record<string, FaltanteE5Track>;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function saveTracking(map: Record<string, FaltanteE5Track>): Promise<void> {
  await ensureRoot();
  const tmp = trackingPath() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmp, trackingPath());
}

async function loadBaseline(): Promise<BaselineFile | null> {
  try {
    const raw = await fs.readFile(baselinePath(), "utf8");
    const data = JSON.parse(raw) as BaselineFile;
    if (!data || !Array.isArray(data.codes)) return null;
    return data;
  } catch {
    return null;
  }
}

async function saveBaseline(codes: string[]): Promise<BaselineFile> {
  await ensureRoot();
  const file: BaselineFile = {
    generatedAt: new Date().toISOString(),
    codes: Array.from(new Set(codes.map((c) => padNoEmple(c)).filter(Boolean))).sort(),
  };
  const tmp = baselinePath() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(file, null, 2), "utf8");
  await fs.rename(tmp, baselinePath());
  return file;
}

function formatDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

async function loadLiveE5Set(): Promise<{
  configured: boolean;
  names: string[];
  dirRel: string;
}> {
  if (!isExpedienteSmbConfigured()) {
    return { configured: false, names: [], dirRel: expedienteTipoDir("E5") };
  }
  const names = (await listExpedienteTipoFilenames("E5")) ?? [];
  return { configured: true, names, dirRel: expedienteTipoDir("E5") };
}

function hasE5InNames(names: string[], noEmple: string): { has: boolean; path: string | null } {
  const file = pickBestExpedientePdfFilename(names, noEmple);
  if (!file) return { has: false, path: null };
  return { has: true, path: `${expedienteTipoDir("E5")}/${file}` };
}

/** Activos NAF sin E5 en el expediente vivo (dedupe por noEmple). */
async function computeMissingCodes(names: string[]): Promise<string[]> {
  const rows = await prisma.nafEmployee.findMany({
    where: { estado: { equals: "A", mode: "insensitive" } },
    select: { noEmple: true, estado: true },
  });

  const byCode = new Map<string, boolean>();
  for (const row of rows) {
    if (!isNafEstadoActivo(row.estado)) continue;
    const code = padNoEmple(row.noEmple);
    if (!code) continue;
    byCode.set(code, true);
  }

  const missing: string[] = [];
  for (const code of byCode.keys()) {
    if (!hasE5InNames(names, code).has) missing.push(code);
  }
  return missing.sort();
}

type NafLite = {
  noEmple: string;
  noCia: string;
  nombre: string | null;
  cedula: string | null;
  puesto: string | null;
  fIngreso: Date | null;
  zona: string | null;
  zonaCode: string | null;
  ubicacionNombre: string | null;
  estado: string | null;
  updatedAt: Date;
};

async function loadNafByCodes(codes: string[]): Promise<Map<string, NafLite>> {
  if (!codes.length) return new Map();

  const variants = new Set<string>();
  for (const c of codes) {
    const padded = padNoEmple(c);
    variants.add(padded);
    variants.add(c.replace(/^0+/, "") || c);
    // CSV sometimes has unpadded 6-digit
    if (/^\d+$/.test(c)) variants.add(c.padStart(6, "0"));
  }

  const rows = await prisma.nafEmployee.findMany({
    where: {
      noEmple: { in: Array.from(variants) },
      estado: { equals: "A", mode: "insensitive" },
    },
    select: {
      noEmple: true,
      noCia: true,
      nombre: true,
      cedula: true,
      puesto: true,
      fIngreso: true,
      zona: true,
      zonaCode: true,
      ubicacionNombre: true,
      estado: true,
      updatedAt: true,
    },
    orderBy: [{ noCia: "asc" }],
  });

  // Prefer one row per noEmple (first cia if several).
  const map = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!isNafEstadoActivo(row.estado)) continue;
    const key = padNoEmple(row.noEmple);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

function defaultTrack(noEmple: string): FaltanteE5Track {
  return { noEmple, estado: "PENDIENTE", notas: "" };
}

function buildSummary(items: FaltanteE5Item[]): FaltanteE5Summary {
  const summary: FaltanteE5Summary = {
    total: items.length,
    pendientes: 0,
    enProceso: 0,
    completados: 0,
    noAplica: 0,
    enExpediente: 0,
    sinZona: 0,
    porZona: {},
  };
  for (const it of items) {
    if (!it.zona) summary.sinZona += 1;
    const zLabel = it.zona || "(sin zona)";
    summary.porZona[zLabel] = (summary.porZona[zLabel] ?? 0) + 1;

    switch (it.estadoEfectivo) {
      case "EN_EXPEDIENTE":
        summary.enExpediente += 1;
        break;
      case "EN_PROCESO":
        summary.enProceso += 1;
        break;
      case "COMPLETADO":
        summary.completados += 1;
        break;
      case "NO_APLICA":
        summary.noAplica += 1;
        break;
      default:
        summary.pendientes += 1;
    }
  }
  return summary;
}

export async function listFaltantesE5(options?: {
  /** Si true, regenera la baseline con activos NAF sin E5 vivo. */
  refreshBaseline?: boolean;
  /** Si false, oculta los que ya tienen E5 en vivo (default true = mostrar todos del baseline). */
  includeEnExpediente?: boolean;
}): Promise<{
  root: string;
  baselineAt: string | null;
  smbConfigured: boolean;
  items: FaltanteE5Item[];
  summary: FaltanteE5Summary;
}> {
  const includeEnExpediente = options?.includeEnExpediente !== false;
  const live = await loadLiveE5Set();
  let baseline = await loadBaseline();

  if (!baseline || options?.refreshBaseline) {
    const missing = await computeMissingCodes(live.names);
    // Preserve previously tracked codes that gained E5 so progress is visible.
    const prev = new Set(baseline?.codes ?? []);
    const tracking = await loadTracking();
    for (const code of Object.keys(tracking)) {
      prev.add(padNoEmple(code));
    }
    for (const code of missing) prev.add(code);
    // On first create, baseline = only missing. On refresh, keep tracked + still missing.
    const codes = options?.refreshBaseline && baseline
      ? Array.from(prev).filter((c) => {
          const stillMissing = !hasE5InNames(live.names, c).has;
          const tracked = Boolean(tracking[c] || tracking[padNoEmple(c)]);
          return stillMissing || tracked;
        }).sort()
      : missing;
    baseline = await saveBaseline(codes.length ? codes : missing);
  }

  const tracking = await loadTracking();
  const nafMap = await loadNafByCodes(baseline.codes);

  const items: FaltanteE5Item[] = [];
  for (const code of baseline.codes) {
    const noEmple = padNoEmple(code);
    const e5 = hasE5InNames(live.names, noEmple);
    if (e5.has && !includeEnExpediente) continue;

    const emp = nafMap.get(noEmple);
    const track = tracking[noEmple] ?? tracking[code] ?? defaultTrack(noEmple);
    const estadoEfectivo: FaltanteE5Item["estadoEfectivo"] = e5.has
      ? "EN_EXPEDIENTE"
      : track.estado;

    items.push({
      noEmple,
      cedula: emp?.cedula?.trim() ?? "",
      nombre: emp?.nombre?.trim() ?? "",
      noCia: emp?.noCia ?? "",
      puesto: emp?.puesto?.trim() ?? "",
      fIngreso: formatDate(emp?.fIngreso),
      zona: emp?.zona?.trim() ?? "",
      zonaCode: emp?.zonaCode?.trim() ?? "",
      ubicacionNombre: emp?.ubicacionNombre?.trim() ?? "",
      hasE5Live: e5.has,
      e5Path: e5.path,
      track: { ...track, noEmple },
      estadoEfectivo,
    });
  }

  items.sort((a, b) => {
    const z = (a.zona || "zzz").localeCompare(b.zona || "zzz", "es");
    if (z !== 0) return z;
    return (a.nombre || a.noEmple).localeCompare(b.nombre || b.noEmple, "es");
  });

  return {
    root: dataRoot(),
    baselineAt: baseline.generatedAt,
    smbConfigured: live.configured,
    items,
    summary: buildSummary(items),
  };
}

export async function updateFaltanteE5Status(input: {
  noEmple: string;
  estado: FaltanteE5Estado;
  notas?: string;
  userEmail?: string;
}): Promise<FaltanteE5Track> {
  const noEmple = padNoEmple(input.noEmple.trim());
  if (!noEmple) throw new Error("noEmple requerido");

  const map = await loadTracking();
  const row: FaltanteE5Track = {
    noEmple,
    estado: input.estado,
    notas: (input.notas || "").trim(),
    updatedBy: input.userEmail,
    updatedAt: new Date().toISOString(),
  };
  map[noEmple] = row;
  await saveTracking(map);
  return row;
}

/** Regenera baseline desde NAF activos × expediente vivo, conservando tracking. */
export async function refreshFaltantesE5Baseline(): Promise<{
  baselineAt: string;
  total: number;
}> {
  const result = await listFaltantesE5({ refreshBaseline: true, includeEnExpediente: true });
  return {
    baselineAt: result.baselineAt ?? new Date().toISOString(),
    total: result.items.length,
  };
}
