import { prisma } from "@/modules/core/db/prisma";
import {
  normalizeRrhhContrato,
  scoreContractMatch,
} from "@/modules/presupuestos/business/contract-match";
import { normalizeCedulaDigits } from "@/modules/presupuestos/business/cedula-normalize";

const MIN_CONTRATO_SCORE = 55;

export type ContractEmployeeMatch = {
  cedulaDigits: string;
  nombre: string | null;
  source: "naf_contrato" | "rrhh_placement";
  nafNoEmple: string | null;
};

function addPlacementEmployees(
  byDigits: Map<string, ContractEmployeeMatch>,
  placements: {
    employee: { cedula: string | null; cedulaNormalizada: string | null; nombre: string | null };
  }[],
) {
  for (const p of placements) {
    const digits =
      normalizeCedulaDigits(p.employee.cedulaNormalizada) ||
      normalizeCedulaDigits(p.employee.cedula);
    if (!digits) continue;
    const existing = byDigits.get(digits);
    if (existing) {
      if (!existing.nombre && p.employee.nombre) existing.nombre = p.employee.nombre;
      continue;
    }
    byDigits.set(digits, {
      cedulaDigits: digits,
      nombre: p.employee.nombre,
      source: "rrhh_placement",
      nafNoEmple: null,
    });
  }
}

export async function getContractEmployeeCedulas(contractId: string): Promise<{
  licitacionNo: string;
  client: string;
  employees: ContractEmployeeMatch[];
}> {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, deletedAt: null },
    select: { id: true, licitacionNo: true, client: true },
  });
  if (!contract) {
    throw new Error("Contrato no encontrado");
  }

  // Contratos importados a veces traen espacios en licitacionNo (p. ej. Alajuela Sur REMES).
  const licitacionNo = contract.licitacionNo.trim();
  const licitacionNorm = normalizeRrhhContrato(licitacionNo) ?? licitacionNo;

  const byDigits = new Map<string, ContractEmployeeMatch>();

  const nafWithContrato = await prisma.nafEmployee.findMany({
    where: {
      cedula: { not: null },
      contrato: { not: null },
      NOT: { contrato: "" },
    },
    select: {
      cedula: true,
      nombre: true,
      contrato: true,
      noEmple: true,
    },
  });

  for (const n of nafWithContrato) {
    const digits = normalizeCedulaDigits(n.cedula);
    if (!digits) continue;
    const contrato = n.contrato?.trim();
    if (!contrato || scoreContractMatch(contrato, licitacionNo) < MIN_CONTRATO_SCORE) {
      continue;
    }
    byDigits.set(digits, {
      cedulaDigits: digits,
      nombre: n.nombre,
      source: "naf_contrato",
      nafNoEmple: n.noEmple,
    });
  }

  // Muchos contratos activos (p. ej. REMES) no tienen `naf_employees.contrato` lleno;
  // la asignación RRHH (`employee_placements.contractId`) es la fuente confiable.
  // Algunos (p. ej. Alajuela Sur) tienen placements con contratoNormalizado correcto
  // pero `contractId` NULL y sin EmployeeContractLink.
  const [placements, rrhhLinks, unlinkedContratoGroups] = await Promise.all([
    prisma.employeePlacement.findMany({
      where: { contractId: contract.id },
      select: {
        employee: {
          select: { cedula: true, cedulaNormalizada: true, nombre: true },
        },
      },
    }),
    prisma.employeeContractLink.findMany({
      where: { contractId: contract.id },
      select: { contratoRrhh: true },
    }),
    prisma.employeePlacement.groupBy({
      by: ["contratoNormalizado"],
      where: {
        contractId: null,
        contratoNormalizado: { not: null },
        NOT: { contratoNormalizado: "" },
      },
    }),
  ]);

  const rrhhKeys = rrhhLinks.map((l) => l.contratoRrhh).filter(Boolean);
  const fuzzyKeys = unlinkedContratoGroups
    .map((g) => g.contratoNormalizado)
    .filter((k): k is string => Boolean(k))
    .filter((k) => {
      const norm = normalizeRrhhContrato(k);
      if (norm && norm === licitacionNorm) return true;
      return scoreContractMatch(k, licitacionNo) >= MIN_CONTRATO_SCORE;
    });

  const placementKeys = [...new Set([...rrhhKeys, ...fuzzyKeys])];
  const placementsByKey =
    placementKeys.length === 0
      ? []
      : await prisma.employeePlacement.findMany({
          where: {
            contractId: null,
            OR: [
              { contratoNormalizado: { in: placementKeys } },
              { contrato: { in: placementKeys } },
            ],
          },
          select: {
            employee: {
              select: { cedula: true, cedulaNormalizada: true, nombre: true },
            },
          },
        });

  addPlacementEmployees(byDigits, placements);
  addPlacementEmployees(byDigits, placementsByKey);

  return {
    licitacionNo: contract.licitacionNo,
    client: contract.client,
    employees: [...byDigits.values()].sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")),
  };
}
