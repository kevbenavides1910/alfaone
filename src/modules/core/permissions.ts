import type { Session } from "next-auth";
import {
  hasPermission,
  isPlatformAdmin,
  sessionRole,
} from "@/lib/permissions/check";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";

function asSession(value: Session | null | undefined): Session | null {
  if (value && typeof value === "object" && "user" in value) return value;
  return null;
}

/** Comprueba permiso granular del rol asignado al usuario (ignora enum legacy UserRole). */
export function checkPermission(
  session: Session | null | undefined,
  key: PermissionKey,
  minLevel: PermissionLevelId = "view",
): boolean {
  return hasPermission(asSession(session), key, minLevel);
}

/** Crear/editar contratos, periodos, puestos, historial de facturación (no gastos). */
export function canModifyContracts(session: Session | null | undefined): boolean {
  return checkPermission(session, "alfa-one.contracts", "edit");
}

export function canModifyContractsSession(session: Session | null): boolean {
  return canModifyContracts(session);
}

/** Alta/edición de gastos, uniformes, hallazgos de auditoría, distribuciones. */
export function canManageExpenses(session: Session | null | undefined): boolean {
  return checkPermission(session, "gastos.expenses", "edit");
}

export function canManageExpensesSession(session: Session | null): boolean {
  return canManageExpenses(session);
}

/** Administración de plataforma (usuarios, roles, catálogos globales). */
export function isAdmin(session: Session | null | undefined): boolean {
  return isPlatformAdmin(asSession(session));
}

export function isAdminSession(session: Session | null): boolean {
  return isAdmin(session);
}

/** Ver contratos de todas las empresas (sin filtrar por user.company). */
export function canViewAllContractCompanies(session: Session | null | undefined): boolean {
  return (
    isPlatformAdmin(asSession(session)) ||
    checkPermission(session, "alfa-one.contracts", "admin")
  );
}

/** Importar nuevos lotes de apercibimientos al módulo disciplinario. */
export function canImportDisciplinary(session: Session | null | undefined): boolean {
  return checkPermission(session, "disciplinario.import", "edit");
}

export function canImportDisciplinarySession(session: Session | null): boolean {
  return canImportDisciplinary(session);
}

export function canViewDisciplinary(session: Session | null | undefined): boolean {
  return checkPermission(session, "disciplinario.historial", "view");
}

export function canViewDisciplinarySession(session: Session | null): boolean {
  return canViewDisciplinary(session);
}

export function canManageDisciplinary(session: Session | null | undefined): boolean {
  return checkPermission(session, "disciplinario.empleados", "edit");
}

export function canManageDisciplinaryHistorial(session: Session | null | undefined): boolean {
  return checkPermission(session, "disciplinario.historial", "edit");
}

export function canManageDisciplinaryConvocatoria(session: Session | null | undefined): boolean {
  return checkPermission(session, "disciplinario.convocatoria", "edit");
}

export function canManageDisciplinarySession(session: Session | null): boolean {
  return canManageDisciplinary(session);
}

export function canImportEmployeesSession(session: Session | null): boolean {
  return checkPermission(session, "empleados.import", "edit");
}

export function canViewEmployeesSession(session: Session | null): boolean {
  return checkPermission(session, "empleados.list", "view");
}

export function canReconcileEmployeeContractsSession(session: Session | null): boolean {
  return checkPermission(session, "empleados.contratos", "edit");
}

export function canManageInventarioSession(session: Session | null | undefined): boolean {
  return checkPermission(session, "inventario.assets", "edit");
}

export function canManageCatalogsSession(session: Session | null | undefined): boolean {
  return checkPermission(session, "plataforma.catalogs", "edit");
}

export function canManageDisciplinarySettingsSession(session: Session | null | undefined): boolean {
  return checkPermission(session, "disciplinario.ajustes", "edit");
}

/** Compat: obtener rol legacy desde sesión (solo referencia; no usar para autorizar). */
export { sessionRole };

