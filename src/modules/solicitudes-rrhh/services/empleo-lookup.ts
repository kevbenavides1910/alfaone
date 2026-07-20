import { prisma } from "@/modules/core/db/prisma";
import { normalizeCedula } from "@/modules/empleados/business/employee-identity";
import {
  buildSapToCompanyMap,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import { companyDisplayName } from "@/lib/utils/constants";
import { formatCedulaDisplay } from "@/modules/solicitudes-rrhh/business/format";

export type EmpleoSnapshot = {
  nombre: string;
  cedula: string;
  cedulaDisplay: string;
  fechaIngreso: string | null;
  fechaEgreso: string | null;
  puesto: string;
  empresaNombre: string;
  noCia: string | null;
  estado: string | null;
};

function pickCanonicalEmpleo<T extends { estado: string | null; fEgreso: Date | null; fIngreso: Date | null; syncedAt: Date }>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  const activos = rows.filter((r) => (r.estado ?? "").trim().toUpperCase() === "A");
  const pool = activos.length > 0 ? activos : rows;
  return [...pool].sort((a, b) => {
    const aEnd = a.fEgreso?.getTime() ?? a.fIngreso?.getTime() ?? a.syncedAt.getTime();
    const bEnd = b.fEgreso?.getTime() ?? b.fIngreso?.getTime() ?? b.syncedAt.getTime();
    return bEnd - aEnd;
  })[0];
}

function digitsMatch(cedula: string | null | undefined, target: string): boolean {
  const n = normalizeCedula(cedula);
  return n !== null && n === target;
}

/** Variantes de búsqueda: NAF suele guardar `4-0250-0022`, no solo dígitos. */
function cedulaQueryVariants(digits: string): string[] {
  const out = new Set<string>([digits]);
  if (digits.length === 9) {
    out.add(`${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5)}`);
  }
  if (digits.length === 10) {
    out.add(`${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`);
  }
  return [...out];
}

export async function resolveEmpleoByCedula(rawCedula: string): Promise<EmpleoSnapshot | null> {
  const cedula = normalizeCedula(rawCedula);
  if (!cedula) return null;

  // Match por dígitos aunque en BD venga con guiones/espacios (p. ej. 4-0250-0022).
  const nafIdRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM naf_employees
    WHERE regexp_replace(coalesce(cedula, ''), '[^0-9]', '', 'g') = ${cedula}
       OR NULLIF(ltrim(regexp_replace(coalesce(cedula, ''), '[^0-9]', '', 'g'), '0'), '') = ${cedula}
    LIMIT 80
  `;

  const variants = cedulaQueryVariants(cedula);
  const nafCandidates =
    nafIdRows.length > 0
      ? await prisma.nafEmployee.findMany({
          where: { id: { in: nafIdRows.map((r) => r.id) } },
        })
      : await prisma.nafEmployee.findMany({
          where: {
            OR: variants.flatMap((v) => [{ cedula: v }, { cedula: { contains: v } }]),
          },
          take: 80,
        });
  const nafRows = nafCandidates.filter((r) => digitsMatch(r.cedula, cedula));
  const naf = pickCanonicalEmpleo(nafRows);

  const companies = await prisma.company.findMany({
    select: { code: true, name: true, sapCode: true },
  });
  const sapMap = buildSapToCompanyMap(companies);
  const companyByCode = new Map(companies.map((c) => [c.code, c.name]));

  if (naf) {
    const { companyCode } = resolveCompanyFromSapCode(naf.noCia, sapMap);
    const empresaNombre =
      (companyCode ? companyByCode.get(companyCode) : null) ??
      (companyCode ? companyDisplayName(companyCode) : null) ??
      `Compañía ${naf.noCia}`;
    const nombre =
      [naf.nombre].filter(Boolean).join(" ").trim() ||
      [naf.apePat, naf.apeMat, naf.nombrePila].filter(Boolean).join(" ").trim() ||
      "SIN NOMBRE";
    const puesto = (naf.puesto || naf.tituloNombre || "NO ESPECIFICADO").trim();
    return {
      nombre: nombre.toUpperCase(),
      cedula,
      cedulaDisplay: formatCedulaDisplay(normalizeCedula(naf.cedula) ?? cedula),
      fechaIngreso: naf.fIngreso ? naf.fIngreso.toISOString() : null,
      fechaEgreso: naf.fEgreso ? naf.fEgreso.toISOString() : null,
      puesto: puesto.toUpperCase(),
      empresaNombre: empresaNombre.toUpperCase(),
      noCia: naf.noCia,
      estado: naf.estado,
    };
  }

  const empIdRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM employees
    WHERE "cedulaNormalizada" = ${cedula}
       OR regexp_replace(coalesce(cedula, ''), '[^0-9]', '', 'g') = ${cedula}
       OR NULLIF(ltrim(regexp_replace(coalesce(cedula, ''), '[^0-9]', '', 'g'), '0'), '') = ${cedula}
    LIMIT 20
  `;
  const empCandidates =
    empIdRows.length > 0
      ? await prisma.employee.findMany({ where: { id: { in: empIdRows.map((r) => r.id) } } })
      : await prisma.employee.findMany({
          where: {
            OR: [
              { cedulaNormalizada: cedula },
              ...variants.flatMap((v) => [{ cedula: v }, { cedula: { contains: v } }]),
            ],
          },
          take: 20,
        });
  const emp = empCandidates.find((e) => (e.cedulaNormalizada || normalizeCedula(e.cedula)) === cedula);
  if (!emp) return null;

  const empresaNombre =
    (emp.company ? companyByCode.get(emp.company) : null) ??
    (emp.company ? companyDisplayName(emp.company) : null) ??
    "EMPRESA DEL GRUPO";

  return {
    nombre: (emp.nombre ?? "SIN NOMBRE").trim().toUpperCase(),
    cedula,
    cedulaDisplay: formatCedulaDisplay(emp.cedulaNormalizada || cedula),
    fechaIngreso: emp.fechaIngreso ? emp.fechaIngreso.toISOString() : null,
    fechaEgreso: null,
    puesto: (emp.tituloNombre || "NO ESPECIFICADO").trim().toUpperCase(),
    empresaNombre: empresaNombre.toUpperCase(),
    noCia: emp.companySapCode,
    estado: emp.estado,
  };
}
