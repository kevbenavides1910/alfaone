import { prisma } from "@/modules/core/db/prisma";
import { scoreContractMatch } from "@/modules/presupuestos/business/contract-match";
import { normalizeCedulaDigits } from "@/modules/presupuestos/business/cedula-normalize";

const MIN_CONTRATO_SCORE = 55;

export type ContractEmployeeMatch = {
  cedulaDigits: string;
  nombre: string | null;
  source: "naf_contrato";
  nafNoEmple: string | null;
};

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
    if (!contrato || scoreContractMatch(contrato, contract.licitacionNo) < MIN_CONTRATO_SCORE) {
      continue;
    }
    byDigits.set(digits, {
      cedulaDigits: digits,
      nombre: n.nombre,
      source: "naf_contrato",
      nafNoEmple: n.noEmple,
    });
  }

  return {
    licitacionNo: contract.licitacionNo,
    client: contract.client,
    employees: [...byDigits.values()].sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "")),
  };
}
