import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";
import {
  hasPermission,
  isPlatformAdmin,
  sessionRole,
} from "@/lib/permissions/check";

function roleFromSession(session: Session | null | undefined): UserRole {
  return sessionRole(session ?? null);
}

/** Crear/editar contratos, periodos, puestos, historial de facturación (no gastos). */
export function canModifyContracts(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return hasPermission(roleOrSession, "presupuestos.contracts", "edit");
  }
  const role = roleOrSession as UserRole;
  return role === "ADMIN" || role === "SUPERVISOR" || role === "COMMERCIAL";
}

export function canModifyContractsSession(session: Session | null): boolean {
  return hasPermission(session, "presupuestos.contracts", "edit");
}

/** Alta/edición de gastos, uniformes, hallazgos de auditoría, distribuciones. */
export function canManageExpenses(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return hasPermission(roleOrSession, "gastos.expenses", "edit");
  }
  const role = roleOrSession as UserRole;
  return role === "ADMIN" || role === "SUPERVISOR" || role === "COMPRAS";
}

export function canManageExpensesSession(session: Session | null): boolean {
  return hasPermission(session, "gastos.expenses", "edit");
}

export function isAdmin(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return isPlatformAdmin(roleOrSession);
  }
  return roleOrSession === "ADMIN";
}

export function isAdminSession(session: Session | null): boolean {
  return isPlatformAdmin(session);
}

/** Importar nuevos lotes de apercibimientos al módulo disciplinario. */
export function canImportDisciplinary(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return hasPermission(roleOrSession, "disciplinario.import", "edit");
  }
  return roleOrSession === "ADMIN";
}

export function canImportDisciplinarySession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.import", "edit");
}

export function canViewDisciplinary(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return hasPermission(roleOrSession, "disciplinario.historial", "view");
  }
  return false;
}

export function canViewDisciplinarySession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.historial", "view");
}

/** Editar historial: estados, alta manual, firma, reasignación, etc. */
export function canEditDisciplinaryHistorial(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return hasPermission(roleOrSession, "disciplinario.historial", "edit");
  }
  const role = roleOrSession as UserRole;
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canEditDisciplinaryHistorialSession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.historial", "edit");
}

/** Tratamiento: ciclos, convocatorias por empleado, cerrar/reabrir. */
export function canManageDisciplinary(roleOrSession: UserRole | Session | null): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return hasPermission(roleOrSession, "disciplinario.empleados", "edit");
  }
  const role = roleOrSession as UserRole;
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canManageDisciplinarySession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.empleados", "edit");
}

/** Convocatoria: editar agenda y enviar correos. */
export function canEditDisciplinaryConvocatoriaSession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.convocatoria", "edit");
}

/** Ajustes disciplinario: documento, plantillas, etc. */
export function canEditDisciplinaryAjustesSession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.ajustes", "edit");
}

/** Ajustes disciplinario: SMTP, firma digital. */
export function canAdminDisciplinaryAjustesSession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.ajustes", "admin");
}

/** Importación: eliminar lotes y operaciones destructivas. */
export function canAdminDisciplinaryImportSession(session: Session | null): boolean {
  return hasPermission(session, "disciplinario.import", "admin");
}

export function canImportEmployeesSession(session: Session | null): boolean {
  return hasPermission(session, "empleados.import", "edit");
}

export function canViewEmployeesSession(session: Session | null): boolean {
  return hasPermission(session, "empleados.list", "view");
}

export function canReconcileEmployeeContractsSession(session: Session | null): boolean {
  return hasPermission(session, "empleados.contratos", "edit");
}

/** Compat: obtener rol desde sesión. */
export { sessionRole };
