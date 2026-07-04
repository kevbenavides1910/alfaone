import type { Session } from "next-auth";
import type { AppModuleId } from "./types";
import { canAccessModuleFromSession } from "@/lib/permissions/check";
import type { UserRole } from "@prisma/client";

/**
 * ¿El usuario puede ver el módulo en navegación y pantallas generales?
 */
export function canAccessModule(
  roleOrSession: UserRole | Session | null,
  moduleId: AppModuleId
): boolean {
  if (roleOrSession && typeof roleOrSession === "object" && "user" in roleOrSession) {
    return canAccessModuleFromSession(roleOrSession, moduleId);
  }
  return canAccessModuleFromSession(null, moduleId);
}

export function canAccessModuleSession(
  session: Session | null,
  moduleId: AppModuleId
): boolean {
  return canAccessModuleFromSession(session, moduleId);
}
