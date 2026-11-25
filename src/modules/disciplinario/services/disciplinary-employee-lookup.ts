import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  getNafEmployeesByNoEmple,
  normalizeNafNoEmple,
} from "@/modules/empleados-naf/services/lookup-by-no-emple";
import { isNafEstadoActivo } from "@/modules/empleados-naf/business/employee-estado";

export type DisciplinaryEmployeeInfo = {
  codigoEmpleado: string;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  zona: string | null;
  /** Origen del dato: maestro local o réplica NAF. */
  source?: "employees" | "naf";
};

function mapEmployeeRow(r: {
  codigoEmpleado: string;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  zona: string | null;
}): DisciplinaryEmployeeInfo {
  return {
    codigoEmpleado: r.codigoEmpleado,
    nombre: r.nombre,
    cedula: r.cedula,
    email: r.email,
    zona: r.zona,
    source: "employees",
  };
}

/** Datos de empleado desde el módulo Empleados, con fallback a Directorio NAF. */
export async function getEmployeesForDisciplinaryByCodes(
  codigos: string[],
): Promise<Map<string, DisciplinaryEmployeeInfo>> {
  if (codigos.length === 0) return new Map();

  const normalized = [
    ...new Set(codigos.map(normalizeEmployeeCode).filter((c) => c.length > 0)),
  ];
  if (normalized.length === 0) return new Map();

  const rows = await prisma.employee.findMany({
    where: { codigoEmpleado: { in: normalized } },
    select: {
      codigoEmpleado: true,
      nombre: true,
      cedula: true,
      email: true,
      zona: true,
    },
  });

  const result = new Map<string, DisciplinaryEmployeeInfo>(
    rows.map((r) => [r.codigoEmpleado, mapEmployeeRow(r)]),
  );

  const missing = normalized.filter((c) => !result.has(c));
  const missingEmail = normalized.filter((c) => {
    const row = result.get(c);
    return !!row && !row.email?.trim();
  });
  const needNaf = [...new Set([...missing, ...missingEmail])];
  if (needNaf.length === 0) return result;

  const nafMap = await getNafEmployeesByNoEmple(needNaf);
  for (const code of needNaf) {
    const naf = nafMap.get(normalizeNafNoEmple(code));
    if (!naf) continue;
    const existing = result.get(code);
    if (!existing) {
      result.set(code, {
        codigoEmpleado: code,
        nombre: naf.nombre,
        cedula: naf.cedula,
        email: naf.email,
        zona: naf.zona,
        source: "naf",
      });
      continue;
    }
    if (!existing.email?.trim() && naf.email?.trim()) {
      result.set(code, { ...existing, email: naf.email.trim() });
    }
  }

  return result;
}

export async function getEmployeeCedulaForDisciplinary(
  codigoEmpleado: string,
): Promise<string | null> {
  const code = normalizeEmployeeCode(codigoEmpleado);
  const row = await prisma.employee.findUnique({
    where: { codigoEmpleado: code },
    select: { cedula: true },
  });
  if (row?.cedula?.trim()) return row.cedula.trim();

  const naf = (await getNafEmployeesByNoEmple([code])).get(normalizeNafNoEmple(code));
  return naf?.cedula?.trim() || null;
}

/**
 * Búsqueda para reasignación / autocompletado: maestro `employees` + réplica NAF.
 * Prioriza la fila local cuando el código existe en ambos.
 */
export async function searchEmployeesForDisciplinary(
  q: string,
  limit = 20,
): Promise<DisciplinaryEmployeeInfo[]> {
  const term = q.trim();
  if (!term) return [];
  const take = Math.min(50, Math.max(1, limit));

  const localRows = await prisma.employee.findMany({
    where: {
      OR: [
        { codigoEmpleado: { contains: term, mode: "insensitive" } },
        { nombre: { contains: term, mode: "insensitive" } },
        { cedula: { contains: term } },
      ],
    },
    select: {
      codigoEmpleado: true,
      nombre: true,
      cedula: true,
      email: true,
      zona: true,
    },
    take,
    orderBy: [{ nombre: "asc" }],
  });

  const byCode = new Map<string, DisciplinaryEmployeeInfo>();
  for (const r of localRows) {
    byCode.set(normalizeEmployeeCode(r.codigoEmpleado), mapEmployeeRow(r));
  }

  const localSinCorreo = [...byCode.values()].filter((r) => !r.email?.trim());
  if (localSinCorreo.length > 0) {
    const nafByCode = await getNafEmployeesByNoEmple(localSinCorreo.map((r) => r.codigoEmpleado));
    for (const row of localSinCorreo) {
      const naf = nafByCode.get(normalizeNafNoEmple(row.codigoEmpleado));
      if (!naf?.email?.trim()) continue;
      byCode.set(row.codigoEmpleado, { ...row, email: naf.email.trim() });
    }
  }

  if (byCode.size < take) {
    const nafRows = await prisma.nafEmployee.findMany({
      where: {
        OR: [
          { noEmple: { contains: term, mode: "insensitive" } },
          { nombre: { contains: term, mode: "insensitive" } },
          { cedula: { contains: term } },
        ],
      },
      select: {
        noEmple: true,
        nombre: true,
        cedula: true,
        correoElectronico: true,
        zona: true,
        estado: true,
        syncedAt: true,
      },
      take: take * 3,
      orderBy: [{ nombre: "asc" }],
    });

    // Prefer active NAF rows when several companies share the same NO_EMPLE.
    const bestNaf = new Map<
      string,
      (typeof nafRows)[number] & { codigo: string }
    >();
    for (const row of nafRows) {
      const codigo = normalizeNafNoEmple(row.noEmple);
      if (!codigo) continue;
      const prev = bestNaf.get(codigo);
      if (!prev) {
        bestNaf.set(codigo, { ...row, codigo });
        continue;
      }
      const candActivo = isNafEstadoActivo(row.estado);
      const prevActivo = isNafEstadoActivo(prev.estado);
      if (candActivo !== prevActivo) {
        if (candActivo) bestNaf.set(codigo, { ...row, codigo });
        continue;
      }
      if (row.syncedAt.getTime() > prev.syncedAt.getTime()) {
        bestNaf.set(codigo, { ...row, codigo });
      }
    }

    for (const row of bestNaf.values()) {
      if (byCode.has(row.codigo)) continue;
      byCode.set(row.codigo, {
        codigoEmpleado: row.codigo,
        nombre: row.nombre?.trim() || null,
        cedula: row.cedula?.trim() || null,
        email: row.correoElectronico?.trim() || null,
        zona: row.zona?.trim() || null,
        source: "naf",
      });
      if (byCode.size >= take) break;
    }
  }

  return [...byCode.values()]
    .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"))
    .slice(0, take);
}

/** Ubicación y sucursal del oficial (último apercibimiento; ubicación también desde asignación RRHH). */
export async function getEmployeeDisciplinaryUbicacion(
  codigoEmpleado: string,
): Promise<{ ubicacion: string | null; sucursal: string | null }> {
  const code = normalizeEmployeeCode(codigoEmpleado);
  const [latestAperc, placement] = await Promise.all([
    prisma.disciplinaryApercibimiento.findFirst({
      where: { codigoEmpleado: code },
      orderBy: [{ fechaEmision: "desc" }, { numero: "desc" }],
      select: { zona: true, sucursal: true },
    }),
    prisma.employeePlacement.findFirst({
      where: { employee: { codigoEmpleado: code } },
      orderBy: { updatedAt: "desc" },
      select: { ubicacionNombre: true, zona: true },
    }),
  ]);

  const ubicacion =
    latestAperc?.zona?.trim() ||
    placement?.ubicacionNombre?.trim() ||
    placement?.zona?.trim() ||
    null;
  const sucursal = latestAperc?.sucursal?.trim() || null;

  return { ubicacion, sucursal };
}
