import { normalizeRrhhContrato, rankContractCandidates } from "@/modules/empleados/business/contract-match";
import type { NafAsistenciaContratoRow } from "@/modules/empleados-naf/business/nomina-asistencia-format";
import { parseHorarioHours } from "@/modules/empleados-naf/business/nomina-asistencia-hours";
import { deriveAsistenciaDateRange } from "@/modules/empleados-naf/business/nomina-asistencia-period";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { NominaContractContext } from "@/modules/empleados-naf/services/nomina-contract-resolve";

export type { NafAsistenciaContratoRow } from "@/modules/empleados-naf/business/nomina-asistencia-format";

export type NafAsistenciaEmpleadoResumen = {
  noCia: string;
  noEmple: string;
  contratoCount: number;
  contratos: NafAsistenciaContratoRow[];
};

type OracleRow = Record<string, unknown>;

type ContratoAgg = {
  noContrato: string;
  marcas: number;
  roles: Set<string>;
  ubicaciones: Set<string>;
  diasConMarca: number;
  horas: number;
  pagoRol: number;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveContractFromRrhh(
  contratoRrhh: string,
  ctx: NominaContractContext,
): Pick<NafAsistenciaContratoRow, "contractId" | "licitacionNo" | "client" | "contratoNormalizado"> {
  const contratoNormalizado = normalizeRrhhContrato(contratoRrhh);
  if (!contratoNormalizado) {
    return {
      contratoNormalizado: null,
      contractId: null,
      licitacionNo: contratoRrhh,
      client: null,
    };
  }

  const contractId =
    ctx.linkByRrhh.get(contratoNormalizado) ??
    ctx.contractIdByLicitacion.get(contratoNormalizado) ??
    null;

  if (contractId) {
    const contract = ctx.contractById.get(contractId);
    return {
      contratoNormalizado,
      contractId,
      licitacionNo: contract?.licitacionNo ?? contratoRrhh,
      client: contract?.client ?? null,
    };
  }

  const fuzzy = rankContractCandidates(contratoNormalizado, ctx.contractsCatalog, 1)[0];
  if (fuzzy && fuzzy.score >= 85) {
    const contract = ctx.contractById.get(fuzzy.contractId);
    return {
      contratoNormalizado,
      contractId: fuzzy.contractId,
      licitacionNo: contract?.licitacionNo ?? contratoRrhh,
      client: contract?.client ?? null,
    };
  }

  return {
    contratoNormalizado,
    contractId: null,
    licitacionNo: contratoRrhh,
    client: null,
  };
}

export function asistenciaEmployeeKey(noCia: string, noEmple: string): string {
  const trimmed = noEmple.trim();
  const unpadded = trimmed.replace(/^0+/, "") || trimmed;
  return `${noCia}|${unpadded}`;
}

/**
 * Trae asistencia diaria desde VIOPPR + salario del rol (AROPPR) y agrega por empleado×contrato.
 * Peso preferido: pagoRol; fallback horas parseadas de HORARIO; luego marcas.
 */
export async function fetchNominaAsistenciaContratos(
  fDesde: string,
  fHasta: string,
  noCias: string[],
  contractCtx: NominaContractContext,
): Promise<Map<string, NafAsistenciaEmpleadoResumen>> {
  if (noCias.length === 0) return new Map();

  const asistenciaRange = deriveAsistenciaDateRange(fDesde, fHasta);
  const binds: Record<string, string> = {
    fDesde: asistenciaRange.fDesde,
    fHasta: asistenciaRange.fHasta,
  };
  const ciaPlaceholders = noCias.map((noCia, index) => {
    const key = `cia${index}`;
    binds[key] = noCia;
    return `:${key}`;
  });

  const query = `
    SELECT
      v.CIA_EMPLE AS NO_CIA,
      TRIM(v.OFICIAL) AS NO_EMPLE,
      TRIM(v.NO_CONTRATO) AS NO_CONTRATO,
      v.NO_ROL AS NO_ROL,
      TRIM(v.NO_UBICACION) AS NO_UBICACION,
      v.MARCA AS MARCA,
      v.HORARIO AS HORARIO,
      NVL(p.SALARIO, 0) + NVL(p.EXTRAS, 0) + NVL(p.FERIADO, 0) AS PAGO_ROL
    FROM NAF5.VIOPPR_DIARIO_ACTIVOS v
    LEFT JOIN NAF5.AROPPR p
      ON p.NO_ROL = v.NO_ROL
     AND TRUNC(p.DIA) = TRUNC(v.DIA)
    WHERE v.DIA >= TO_DATE(:fDesde, 'YYYY-MM-DD')
      AND v.DIA <= TO_DATE(:fHasta, 'YYYY-MM-DD')
      AND v.OFICIAL IS NOT NULL
      AND v.NO_CONTRATO IS NOT NULL
      AND v.CIA_EMPLE IN (${ciaPlaceholders.join(", ")})
  `;

  const rows = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute<OracleRow>(query, binds);
    return result.rows ?? [];
  });

  const byEmployee = new Map<
    string,
    {
      noCia: string;
      noEmple: string;
      contratos: Map<string, ContratoAgg>;
    }
  >();

  for (const row of rows) {
    const noCia = asString(row.NO_CIA);
    const noEmple = asString(row.NO_EMPLE);
    const noContrato = asString(row.NO_CONTRATO);
    if (!noCia || !noEmple || !noContrato) continue;

    const key = asistenciaEmployeeKey(noCia, noEmple);
    const employee = byEmployee.get(key) ?? {
      noCia,
      noEmple,
      contratos: new Map<string, ContratoAgg>(),
    };

    const contrato = employee.contratos.get(noContrato) ?? {
      noContrato,
      marcas: 0,
      roles: new Set<string>(),
      ubicaciones: new Set<string>(),
      diasConMarca: 0,
      horas: 0,
      pagoRol: 0,
    };

    contrato.marcas += 1;
    const noRol = asString(row.NO_ROL);
    if (noRol) contrato.roles.add(noRol);
    const noUbicacion = asString(row.NO_UBICACION);
    if (noUbicacion) contrato.ubicaciones.add(noUbicacion);
    if (asString(row.MARCA) === "S") contrato.diasConMarca += 1;
    contrato.horas += parseHorarioHours(asString(row.HORARIO));
    contrato.pagoRol += asNumber(row.PAGO_ROL);

    employee.contratos.set(noContrato, contrato);
    byEmployee.set(key, employee);
  }

  const result = new Map<string, NafAsistenciaEmpleadoResumen>();

  for (const [key, employee] of byEmployee) {
    const contratos: NafAsistenciaContratoRow[] = [...employee.contratos.values()].map((agg) => {
      const resolved = resolveContractFromRrhh(agg.noContrato, contractCtx);
      return {
        noContrato: agg.noContrato,
        ...resolved,
        dias: agg.marcas,
        marcas: agg.marcas,
        roles: agg.roles.size,
        ubicaciones: agg.ubicaciones.size,
        diasConMarca: agg.diasConMarca,
        horas: Math.round(agg.horas * 100) / 100,
        pagoRol: Math.round(agg.pagoRol * 100) / 100,
      };
    });

    contratos.sort(
      (a, b) =>
        b.pagoRol - a.pagoRol ||
        b.horas - a.horas ||
        b.marcas - a.marcas ||
        a.noContrato.localeCompare(b.noContrato),
    );

    result.set(key, {
      noCia: employee.noCia,
      noEmple: employee.noEmple,
      contratoCount: contratos.length,
      contratos,
    });
  }

  return result;
}
