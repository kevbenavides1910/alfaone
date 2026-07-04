import { prisma } from "@/modules/core/db/prisma";
import { isNafEstadoActivo } from "@/modules/empleados-naf/business/employee-estado";

/** Misma regla que `normalizeEmployeeCode` en disciplinario (evita dependencia cruzada). */
export function normalizeNafNoEmple(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) {
    const stripped = s.replace(/^0+/, "");
    return stripped || "0";
  }
  return s.toUpperCase();
}

export type NafEmployeeLookup = {
  codigoEmpleado: string;
  noCia: string;
  noEmple: string;
  sourceKey: string;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  zona: string | null;
  telefono: string | null;
  area: string | null;
  depto: string | null;
  estado: string | null;
};

const NAF_EMPLOYEE_SELECT = {
  sourceKey: true,
  noCia: true,
  noEmple: true,
  nombre: true,
  cedula: true,
  correoElectronico: true,
  area: true,
  depto: true,
  telefono: true,
  estado: true,
  zona: true,
  syncedAt: true,
} as const;

type NafEmployeeRow = {
  sourceKey: string;
  noCia: string;
  noEmple: string;
  nombre: string | null;
  cedula: string | null;
  correoElectronico: string | null;
  area: string | null;
  depto: string | null;
  telefono: string | null;
  estado: string | null;
  zona: string | null;
  syncedAt: Date;
};

function preferNafRow(candidate: NafEmployeeRow, current: NafEmployeeRow): boolean {
  const candActivo = isNafEstadoActivo(candidate.estado);
  const currActivo = isNafEstadoActivo(current.estado);
  if (candActivo !== currActivo) return candActivo;
  return candidate.syncedAt.getTime() > current.syncedAt.getTime();
}

function mapNafRow(row: NafEmployeeRow): NafEmployeeLookup {
  const codigoEmpleado = normalizeNafNoEmple(row.noEmple);
  /** Zona RRHH (Pacífico, GAM Oeste, Atlántico…) — misma que reporte APEX / catálogo disciplinario. */
  const zona = row.zona?.trim() || null;
  return {
    codigoEmpleado,
    noCia: row.noCia,
    noEmple: row.noEmple,
    sourceKey: row.sourceKey,
    nombre: row.nombre?.trim() || null,
    cedula: row.cedula?.trim() || null,
    email: row.correoElectronico?.trim() || null,
    zona,
    telefono: row.telefono?.trim() || null,
    area: row.area?.trim() || null,
    depto: row.depto?.trim() || null,
    estado: row.estado?.trim() || null,
  };
}

function registerRow(
  acc: Map<string, NafEmployeeRow>,
  row: NafEmployeeRow,
  normalizedTargets: Set<string>,
) {
  const key = normalizeNafNoEmple(row.noEmple);
  if (!normalizedTargets.has(key)) return;
  const prev = acc.get(key);
  if (!prev || preferNafRow(row, prev)) acc.set(key, row);
}

/** Busca empleados NAF por código (NO_EMPLE), cruzando ceros a la izquierda. */
export async function getNafEmployeesByNoEmple(
  codigos: string[],
): Promise<Map<string, NafEmployeeLookup>> {
  const normalizedTargets = new Set(
    codigos.map(normalizeNafNoEmple).filter((c) => c.length > 0),
  );
  if (normalizedTargets.size === 0) return new Map();

  const searchTokens = new Set<string>();
  for (const code of normalizedTargets) {
    searchTokens.add(code);
    if (/^\d+$/.test(code)) {
      searchTokens.add(code.padStart(5, "0"));
      searchTokens.add(code.padStart(6, "0"));
      searchTokens.add(code.padStart(7, "0"));
    }
  }

  const byNormalized = new Map<string, NafEmployeeRow>();

  const directRows = await prisma.nafEmployee.findMany({
    where: { noEmple: { in: [...searchTokens] } },
    select: NAF_EMPLOYEE_SELECT,
  });
  for (const row of directRows) registerRow(byNormalized, row, normalizedTargets);

  const missing = [...normalizedTargets].filter((k) => !byNormalized.has(k));
  if (missing.length > 0) {
    const extraRows = await prisma.$queryRaw<NafEmployeeRow[]>`
      SELECT
        "sourceKey",
        "noCia",
        "noEmple",
        nombre,
        cedula,
        "correoElectronico",
        area,
        depto,
        telefono,
        estado,
        zona,
        "syncedAt"
      FROM naf_employees
      WHERE CASE
        WHEN "noEmple" ~ '^[0-9]+$' THEN regexp_replace("noEmple", '^0+', '')
        ELSE upper(trim("noEmple"))
      END = ANY(${missing}::text[])
    `;
    for (const row of extraRows) registerRow(byNormalized, row, normalizedTargets);
  }

  return new Map(
    [...byNormalized.entries()].map(([key, row]) => [key, mapNafRow(row)]),
  );
}

export async function getNafEmployeeByNoEmple(
  codigo: string,
): Promise<NafEmployeeLookup | null> {
  const map = await getNafEmployeesByNoEmple([codigo]);
  const key = normalizeNafNoEmple(codigo);
  return map.get(key) ?? null;
}
