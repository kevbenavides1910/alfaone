import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  buildSapToCompanyMap,
  companySapLabel,
  normalizeSapCode,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import {
  NAF_CARGAS_SOCIALES_DEFAULTS,
  NAF_CARGAS_SOCIALES_DEFAULT_TOTAL_PCT,
} from "@/modules/empleados-naf/business/cargas-sociales-defaults";

export type NafCargaSocialRow = {
  codigo: string;
  nombre: string;
  porcentaje: number;
  grupo: string;
  sortOrder: number;
};

export type NafCargasSocialesEmpresaOption = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function mapRow(row: {
  codigo: string;
  nombre: string;
  porcentaje: { toNumber(): number };
  grupo: string;
  sortOrder: number;
}): NafCargaSocialRow {
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    porcentaje: decimalToNumber(row.porcentaje),
    grupo: row.grupo,
    sortOrder: row.sortOrder,
  };
}

function generateCodigo(): string {
  return `CS_${Date.now().toString(36).toUpperCase()}`;
}

export async function ensureNafCargasSocialesForCompany(noCia: string): Promise<void> {
  const normalized = normalizeSapCode(noCia.trim()) ?? noCia.trim();
  if (!normalized) return;

  const existing = await prisma.nafCargaSocial.count({
    where: { noCia: normalized, isActive: true },
  });
  if (existing > 0) return;

  await prisma.$transaction(
    NAF_CARGAS_SOCIALES_DEFAULTS.map((item, index) =>
      prisma.nafCargaSocial.upsert({
        where: { noCia_codigo: { noCia: normalized, codigo: item.codigo } },
        create: {
          noCia: normalized,
          codigo: item.codigo,
          nombre: item.nombre,
          porcentaje: toDecimal(item.porcentaje),
          grupo: item.grupo,
          sortOrder: index,
          isActive: true,
        },
        update: {
          nombre: item.nombre,
          porcentaje: toDecimal(item.porcentaje),
          grupo: item.grupo,
          sortOrder: index,
          isActive: true,
        },
      }),
    ),
  );
}

export async function ensureNafCargasSocialesForCompanies(noCias: string[]): Promise<void> {
  const unique = [...new Set(noCias.map((noCia) => normalizeSapCode(noCia.trim()) ?? noCia.trim()).filter(Boolean))];
  await Promise.all(unique.map((noCia) => ensureNafCargasSocialesForCompany(noCia)));
}

export async function listNafCargasSocialesEmpresas(): Promise<NafCargasSocialesEmpresaOption[]> {
  const [employeeRows, nominaRows, companies] = await Promise.all([
    prisma.nafEmployee.findMany({
      distinct: ["noCia"],
      select: { noCia: true },
      orderBy: { noCia: "asc" },
    }),
    prisma.nafNominaSummary.findMany({
      distinct: ["noCia"],
      select: { noCia: true },
      orderBy: { noCia: "asc" },
    }),
    prisma.company.findMany({
      where: { isActive: true, sapCode: { not: null } },
      select: { code: true, name: true, sapCode: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const sapToCompany = buildSapToCompanyMap(companies);
  const companyByCode = new Map(companies.map((company) => [company.code, company]));
  const noCiaSet = new Set<string>();

  for (const row of [...employeeRows, ...nominaRows]) {
    noCiaSet.add(normalizeSapCode(row.noCia) ?? row.noCia);
  }
  for (const company of companies) {
    if (company.sapCode) {
      noCiaSet.add(normalizeSapCode(company.sapCode) ?? company.sapCode);
    }
  }

  return [...noCiaSet]
    .sort((a, b) => a.localeCompare(b))
    .map((noCia) => {
      const { sapCode, companyCode } = resolveCompanyFromSapCode(noCia, sapToCompany);
      const company = companyCode ? companyByCode.get(companyCode) : undefined;
      return {
        noCia,
        companyCode,
        companyLabel: companySapLabel(sapCode, companyCode, company?.name ?? null),
      };
    });
}

export async function listNafCargasSociales(noCia: string): Promise<{
  noCia: string;
  items: NafCargaSocialRow[];
  totalPct: number;
}> {
  const normalized = normalizeSapCode(noCia.trim()) ?? noCia.trim();
  await ensureNafCargasSocialesForCompany(normalized);

  const rows = await prisma.nafCargaSocial.findMany({
    where: { noCia: normalized, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { nombre: "asc" }],
  });

  const items = rows.map(mapRow);
  const totalPct = items.reduce((sum, item) => sum + item.porcentaje, 0);

  return { noCia: normalized, items, totalPct };
}

export async function loadNafCargasSocialesPctByNoCia(noCias: string[]): Promise<Map<string, number>> {
  const normalized = [...new Set(noCias.map((noCia) => normalizeSapCode(noCia.trim()) ?? noCia.trim()).filter(Boolean))];
  if (normalized.length === 0) return new Map();

  await ensureNafCargasSocialesForCompanies(normalized);

  const rows = await prisma.nafCargaSocial.findMany({
    where: { noCia: { in: normalized }, isActive: true },
    select: { noCia: true, porcentaje: true },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.noCia, (totals.get(row.noCia) ?? 0) + decimalToNumber(row.porcentaje));
  }

  for (const noCia of normalized) {
    if (!totals.has(noCia)) {
      totals.set(noCia, NAF_CARGAS_SOCIALES_DEFAULT_TOTAL_PCT);
    }
  }

  return totals;
}

export async function updateNafCargaSocialPorcentaje(
  noCia: string,
  codigo: string,
  porcentaje: number,
): Promise<NafCargaSocialRow | null> {
  const normalized = normalizeSapCode(noCia.trim()) ?? noCia.trim();
  await ensureNafCargasSocialesForCompany(normalized);

  try {
    const row = await prisma.nafCargaSocial.update({
      where: { noCia_codigo: { noCia: normalized, codigo } },
      data: { porcentaje: toDecimal(porcentaje) },
    });
    return mapRow(row);
  } catch {
    return null;
  }
}

export async function createNafCargaSocialLine(
  noCia: string,
  input: { nombre: string; porcentaje: number; grupo?: string; codigo?: string },
): Promise<NafCargaSocialRow> {
  const normalized = normalizeSapCode(noCia.trim()) ?? noCia.trim();
  await ensureNafCargasSocialesForCompany(normalized);

  const maxSort = await prisma.nafCargaSocial.aggregate({
    where: { noCia: normalized },
    _max: { sortOrder: true },
  });

  const codigo = input.codigo?.trim() || generateCodigo();
  const row = await prisma.nafCargaSocial.create({
    data: {
      noCia: normalized,
      codigo,
      nombre: input.nombre.trim() || "Nueva carga social",
      porcentaje: toDecimal(input.porcentaje),
      grupo: input.grupo?.trim() || "OTROS",
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      isActive: true,
    },
  });

  return mapRow(row);
}

export async function deleteNafCargaSocialLine(noCia: string, codigo: string): Promise<boolean> {
  const normalized = normalizeSapCode(noCia.trim()) ?? noCia.trim();

  try {
    await prisma.nafCargaSocial.update({
      where: { noCia_codigo: { noCia: normalized, codigo } },
      data: { isActive: false },
    });
    return true;
  } catch {
    return false;
  }
}
