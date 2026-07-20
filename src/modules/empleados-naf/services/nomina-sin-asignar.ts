import { prisma } from "@/modules/core/db/prisma";
import {
  buildManualAllocationAmounts,
  hasAsistenciaSalaryAllocation,
  manualAllocationEmployeeKey,
  parsePeriodDate,
  validateManualAllocationTotals,
  type ManualAllocationLineInput,
  type ManualAllocationRow,
} from "@/modules/empleados-naf/business/nomina-manual-allocation";
import { loadManualAllocationsGrouped } from "@/modules/empleados-naf/services/nomina-manual-allocation-repo";
import { enrichEmpleadoAsistenciaAsignada } from "@/modules/empleados-naf/business/nomina-asistencia-allocate";
import {
  getNafNominaByDateRange,
  listNafNominaEmpresas,
  listNafNominaPeriodos,
  type NafNominaEmpleadoRow,
} from "@/modules/empleados-naf/services/list-nomina";
import {
  asistenciaEmployeeKey,
  fetchNominaAsistenciaContratos,
} from "@/modules/empleados-naf/services/nomina-asistencia";
import { buildNominaContractContext } from "@/modules/empleados-naf/services/nomina-contract-resolve";

export type NominaSinAsignarEmpleadoRow = NafNominaEmpleadoRow & {
  manualAllocations: ManualAllocationRow[];
  status: "pendiente" | "asignado_manual";
};

export type NominaSinAsignarResult = {
  fDesde: string;
  fHasta: string;
  noCias: string[];
  meta: {
    asistenciaLabel: string;
  };
  summary: {
    pendientes: number;
    asignadosManual: number;
    devengadoPendiente: number;
    devengadoAsignado: number;
  };
  pendientes: NominaSinAsignarEmpleadoRow[];
  asignados: NominaSinAsignarEmpleadoRow[];
  contracts: Array<{
    id: string;
    licitacionNo: string;
    client: string;
    company: string;
    status: string;
  }>;
};

async function listContractsForAllocation(noCias: string[]) {
  const empresas = await listNafNominaEmpresas();
  const companyCodes = new Set(
    empresas.filter((e) => noCias.includes(e.noCia) && e.companyCode).map((e) => e.companyCode!),
  );

  return prisma.contract.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      ...(companyCodes.size > 0 ? { company: { in: [...companyCodes] } } : {}),
    },
    select: {
      id: true,
      licitacionNo: true,
      client: true,
      company: true,
      status: true,
    },
    orderBy: [{ client: "asc" }, { licitacionNo: "asc" }],
  });
}

function toSinAsignarRow(
  empleado: NafNominaEmpleadoRow,
  manualByKey: Map<string, ManualAllocationRow[]>,
): NominaSinAsignarEmpleadoRow | null {
  if (hasAsistenciaSalaryAllocation(empleado.contratosAsistencia)) {
    return null;
  }
  if (empleado.devengado <= 0 && empleado.neto <= 0) {
    return null;
  }

  const manualAllocations =
    manualByKey.get(manualAllocationEmployeeKey(empleado.noCia, empleado.noEmple, empleado.codPla)) ??
    [];

  return {
    ...empleado,
    manualAllocations,
    status: manualAllocations.length > 0 ? "asignado_manual" : "pendiente",
  };
}

export async function listNominaSinAsignar(input: {
  fDesde: string;
  fHasta: string;
  noCias: string[];
  q?: string;
}): Promise<NominaSinAsignarResult> {
  const { fDesde, fHasta, noCias, q } = input;
  if (noCias.length === 0) {
    throw new Error("Seleccione al menos una empresa");
  }

  const [detalle, manualByKey, contracts] = await Promise.all([
    getNafNominaByDateRange(fDesde, fHasta, noCias, { q }, {
      allowUnresolvedContracts: true,
      skipManualApply: true,
    }),
    loadManualAllocationsGrouped(fDesde, fHasta, noCias),
    listContractsForAllocation(noCias),
  ]);

  const pendientes: NominaSinAsignarEmpleadoRow[] = [];
  const asignados: NominaSinAsignarEmpleadoRow[] = [];

  for (const empleado of detalle.empleados) {
    const row = toSinAsignarRow(empleado, manualByKey);
    if (!row) continue;
    if (row.status === "pendiente") {
      pendientes.push(row);
    } else {
      asignados.push(row);
    }
  }

  pendientes.sort((a, b) => b.devengado - a.devengado || a.noEmple.localeCompare(b.noEmple));
  asignados.sort((a, b) => b.devengado - a.devengado || a.noEmple.localeCompare(b.noEmple));

  return {
    fDesde,
    fHasta,
    noCias,
    meta: {
      asistenciaLabel: detalle.meta.asistenciaLabel,
    },
    summary: {
      pendientes: pendientes.length,
      asignadosManual: asignados.length,
      devengadoPendiente: pendientes.reduce((sum, row) => sum + row.devengado, 0),
      devengadoAsignado: asignados.reduce((sum, row) => sum + row.devengado, 0),
    },
    pendientes,
    asignados,
    contracts,
  };
}

export async function saveNominaManualAllocation(input: {
  noCia: string;
  noEmple: string;
  fDesde: string;
  fHasta: string;
  codPla: string;
  lines: ManualAllocationLineInput[];
  notes?: string;
  createdById?: string;
}): Promise<{ saved: number }> {
  const { noCia, noEmple, fDesde, fHasta, codPla, lines, notes, createdById } = input;

  if (lines.length === 0) {
    throw new Error("Indique al menos un contrato");
  }

  const contractIds = [...new Set(lines.map((line) => line.contractId))];
  if (contractIds.length !== lines.length) {
    throw new Error("No repita el mismo contrato en la asignación");
  }

  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, deletedAt: null },
    select: { id: true },
  });
  if (contracts.length !== contractIds.length) {
    throw new Error("Uno o más contratos no existen");
  }

  const contractCtx = await buildNominaContractContext();
  const asistenciaByEmployee = await fetchNominaAsistenciaContratos(
    fDesde,
    fHasta,
    [noCia],
    contractCtx,
  );
  const asistencia = asistenciaByEmployee.get(asistenciaEmployeeKey(noCia, noEmple));
  const enriched = enrichEmpleadoAsistenciaAsignada({
    sourceKey: "",
    noCia,
    noEmple,
    nombre: null,
    companyLabel: "",
    contratoRrhh: null,
    contratoNormalizado: null,
    contractId: null,
    licitacionNo: null,
    client: null,
    devengado: 0,
    deducciones: 0,
    neto: 0,
    contratosAsistencia: asistencia?.contratos ?? [],
  });
  if (hasAsistenciaSalaryAllocation(enriched.contratosAsistencia)) {
    throw new Error(
      "Este empleado ya tiene asistencia en la quincena; la asignación manual no aplica",
    );
  }

  const detalle = await getNafNominaByDateRange(
    fDesde,
    fHasta,
    [noCia],
    undefined,
    { allowUnresolvedContracts: true, skipManualApply: true },
  );
  const empleado = detalle.empleados.find(
    (row) => row.noEmple === noEmple && row.codPla === codPla,
  );
  if (!empleado) {
    throw new Error("Empleado no encontrado en la quincena seleccionada");
  }

  validateManualAllocationTotals(lines, empleado.devengado);
  const amounts = buildManualAllocationAmounts(
    lines,
    empleado.devengado,
    empleado.deducciones,
    empleado.neto,
  );

  const fDesdeDate = parsePeriodDate(fDesde);
  const fHastaDate = parsePeriodDate(fHasta);

  await prisma.$transaction([
    prisma.nafNominaManualAllocation.deleteMany({
      where: { noCia, noEmple, fDesde: fDesdeDate, fHasta: fHastaDate, codPla },
    }),
    prisma.nafNominaManualAllocation.createMany({
      data: amounts.map((line) => ({
        noCia,
        noEmple,
        fDesde: fDesdeDate,
        fHasta: fHastaDate,
        codPla,
        contractId: line.contractId,
        devengado: line.devengado,
        deducciones: line.deducciones,
        neto: line.neto,
        notes: notes?.trim() || null,
        createdById: createdById ?? null,
      })),
    }),
  ]);

  void import("@/modules/empleados-naf/services/contract-month-labor-cache").then(
    ({ invalidateContractMonthLaborCacheForDateRange }) =>
      invalidateContractMonthLaborCacheForDateRange(fDesdeDate, fHastaDate),
  );

  return { saved: amounts.length };
}

export async function deleteNominaManualAllocation(input: {
  noCia: string;
  noEmple: string;
  fDesde: string;
  fHasta: string;
  codPla: string;
}): Promise<{ deleted: number }> {
  const result = await prisma.nafNominaManualAllocation.deleteMany({
    where: {
      noCia: input.noCia,
      noEmple: input.noEmple,
      fDesde: parsePeriodDate(input.fDesde),
      fHasta: parsePeriodDate(input.fHasta),
      codPla: input.codPla,
    },
  });

  void import("@/modules/empleados-naf/services/contract-month-labor-cache").then(
    ({ invalidateContractMonthLaborCacheForDateRange }) =>
      invalidateContractMonthLaborCacheForDateRange(
        parsePeriodDate(input.fDesde),
        parsePeriodDate(input.fHasta),
      ),
  );

  return { deleted: result.count };
}

export { listNafNominaEmpresas, listNafNominaPeriodos };
