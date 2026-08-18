"use client";

import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";

/** Permisos Finger System según roles de Alfa One (view / edit / admin). */
export function useFingerPermissions() {
  const { data: session, status } = useSession();

  return {
    loading: status === "loading",
    session,
    canViewDashboard: hasPermission(session, "fingerSystem.dashboard", "view"),
    canViewDevices: hasPermission(session, "fingerSystem.dispositivos", "view"),
    canEditDevices: hasPermission(session, "fingerSystem.dispositivos", "edit"),
    canViewConfig: hasPermission(session, "fingerSystem.configuracion", "view"),
    canAdminConfig: hasPermission(session, "fingerSystem.configuracion", "admin"),
    canViewEmployees: hasPermission(session, "fingerSystem.empleados", "view"),
    canEditEmployees: hasPermission(session, "fingerSystem.empleados", "edit"),
    canEditBiometrics: hasPermission(session, "fingerSystem.biometria", "edit"),
    /** Vista operativa: consulta y conexión a relojes, sin configurar ruta ATT2016. */
    isOperativeUser:
      hasPermission(session, "fingerSystem.dispositivos", "view") &&
      !hasPermission(session, "fingerSystem.configuracion", "admin"),
    /** Administrador biométrico: puede editar ruta ATT2016 y ajustes del módulo. */
    isBiometricAdmin: hasPermission(session, "fingerSystem.configuracion", "admin"),
  };
}
