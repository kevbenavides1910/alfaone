import { normalizeSapCode } from "@/modules/empleados/business/company-sap";

/**
 * Contratos cuya nómina NAF (bruto + cargas) se imputa al rubro ADMINISTRATIVO
 * en lugar de Mano de obra. Caso típico: personal administrativo interno.
 */
const NAF_LABOR_AS_ADMIN_CONTRACT_IDS = new Set([
  "cmpehly020098oo6d5h5fcwch", // DA-00001-01 ADMINISTRATIVO (GRUPO)
]);

const NAF_LABOR_AS_ADMIN_LICITACIONES = new Set([
  "DA-00001-01 ADMINISTRATIVO",
  "DA-00001-01",
]);

/**
 * Empresas NAF (noCia / código SAP RRHH) cuyo personal no se imputa a rubros.
 * En UI suelen mostrarse como «Planilla 08» / «Planilla 09» (Desarrollos, Alfatronic).
 */
const NAF_NO_CIA_EXCLUDED_FROM_RUBROS = new Set(["08", "09"]);

/** Tipos de planilla (codPla) adicionalmente excluidos del presupuesto. */
const NAF_COD_PLA_EXCLUDED_FROM_RUBROS = new Set(["08", "09"]);

export function normalizeNafPlanillaCode(codPla: string): string {
  const trimmed = codPla.trim();
  if (/^\d+$/.test(trimmed)) return trimmed.padStart(2, "0");
  return trimmed;
}

export function isNafNoCiaExcludedFromRubros(noCia: string): boolean {
  const sap = normalizeSapCode(noCia);
  return sap != null && NAF_NO_CIA_EXCLUDED_FROM_RUBROS.has(sap);
}

export function isNafPlanillaTypeExcludedFromRubros(codPla: string): boolean {
  return NAF_COD_PLA_EXCLUDED_FROM_RUBROS.has(normalizeNafPlanillaCode(codPla));
}

/** @deprecated Use isNafEmployeeExcludedFromRubros */
export function isNafPlanillaExcludedFromRubros(codPla: string): boolean {
  return isNafPlanillaTypeExcludedFromRubros(codPla);
}

/** Personal NAF que no debe sumar a MO, insumos, administrativo ni utilidad. */
export function isNafEmployeeExcludedFromRubros(noCia: string, codPla?: string): boolean {
  if (isNafNoCiaExcludedFromRubros(noCia)) return true;
  if (codPla != null && isNafPlanillaTypeExcludedFromRubros(codPla)) return true;
  return false;
}

export function isNafLaborCountedAsAdmin(contract: {
  id: string;
  licitacionNo?: string | null;
}): boolean {
  if (NAF_LABOR_AS_ADMIN_CONTRACT_IDS.has(contract.id)) return true;
  const lic = (contract.licitacionNo ?? "").trim().toUpperCase();
  return NAF_LABOR_AS_ADMIN_LICITACIONES.has(lic);
}

/**
 * Aplica el monto NAF al rubro correcto.
 * - Contrato administrativo: NAF suma a ADMIN; LABOR queda solo con gasto manual.
 * - Resto: NAF reemplaza LABOR (comportamiento actual).
 */
export function applyNafLaborToRubros(
  contract: { id: string; licitacionNo?: string | null },
  nafAmount: number | undefined,
  manualLaborSpend: number,
  adminSpendBase: number,
): { laborSpend: number; adminSpend: number } {
  if (nafAmount === undefined) {
    return { laborSpend: manualLaborSpend, adminSpend: adminSpendBase };
  }
  if (isNafLaborCountedAsAdmin(contract)) {
    return {
      laborSpend: manualLaborSpend,
      adminSpend: adminSpendBase + nafAmount,
    };
  }
  return { laborSpend: nafAmount, adminSpend: adminSpendBase };
}
