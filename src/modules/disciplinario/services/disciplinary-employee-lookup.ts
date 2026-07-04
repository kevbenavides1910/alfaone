import { prisma } from "@/modules/core/db/prisma";

export type DisciplinaryEmployeeInfo = {
  codigoEmpleado: string;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  zona: string | null;
};

/** Datos de empleado desde el módulo Empleados (tabla `employees`). */
export async function getEmployeesForDisciplinaryByCodes(
  codigos: string[],
): Promise<Map<string, DisciplinaryEmployeeInfo>> {
  if (codigos.length === 0) return new Map();

  const rows = await prisma.employee.findMany({
    where: { codigoEmpleado: { in: codigos } },
    select: {
      codigoEmpleado: true,
      nombre: true,
      cedula: true,
      email: true,
      zona: true,
    },
  });

  return new Map(rows.map((r) => [r.codigoEmpleado, r]));
}

export async function getEmployeeCedulaForDisciplinary(
  codigoEmpleado: string,
): Promise<string | null> {
  const row = await prisma.employee.findUnique({
    where: { codigoEmpleado },
    select: { cedula: true },
  });
  return row?.cedula?.trim() || null;
}

/** Ubicación y sucursal del oficial (último apercibimiento; ubicación también desde asignación RRHH). */
export async function getEmployeeDisciplinaryUbicacion(
  codigoEmpleado: string,
): Promise<{ ubicacion: string | null; sucursal: string | null }> {
  const [latestAperc, placement] = await Promise.all([
    prisma.disciplinaryApercibimiento.findFirst({
      where: { codigoEmpleado },
      orderBy: [{ fechaEmision: "desc" }, { numero: "desc" }],
      select: { zona: true, sucursal: true },
    }),
    prisma.employeePlacement.findFirst({
      where: { employee: { codigoEmpleado } },
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
