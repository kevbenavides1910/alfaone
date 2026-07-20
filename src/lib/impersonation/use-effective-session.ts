"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useImpersonation } from "@/lib/impersonation/context";
import { mergeImpersonationIntoSession } from "@/lib/impersonation/merge-session";
import type { PermissionMap } from "@/lib/permissions/resolve";

type PreviewCache = {
  roleId: string;
  roleCode: string;
  permissions: PermissionMap;
};

let previewCache: PreviewCache | null = null;

export function cacheImpersonationPreview(preview: PreviewCache) {
  previewCache = preview;
}

export function clearImpersonationPreviewCache() {
  previewCache = null;
}

/**
 * Sesión efectiva para comprobaciones de permiso en UI.
 * En vista previa por pestaña combina la sesión real del admin con el rol impersonado.
 */
export function useEffectiveSession(): {
  data: Session | null;
  status: ReturnType<typeof useSession>["status"];
  update: ReturnType<typeof useSession>["update"];
} {
  const sessionState = useSession();
  const { isImpersonating, roleId, roleCode } = useImpersonation();
  const [cacheTick, setCacheTick] = useState(0);

  useEffect(() => {
    if (previewCache && isImpersonating) {
      setCacheTick((n) => n + 1);
    }
  }, [isImpersonating, roleId]);

  const effective = useMemo(() => {
    void cacheTick;
    const session = sessionState.data;
    if (!session) return null;

    if (!isImpersonating || !roleId || !roleCode) {
      return session;
    }

    const permissions =
      previewCache?.roleId === roleId
        ? previewCache.permissions
        : ({} as PermissionMap);

    return mergeImpersonationIntoSession(
      session,
      { id: roleId, code: roleCode },
      permissions
    );
  }, [sessionState.data, isImpersonating, roleId, roleCode, cacheTick]);

  // Durante vista previa, nunca exponer la sesión real de admin.
  // Si impersonamos sin datos cargados, devolvemos una sesión mergeada con permisos vacíos
  // (nunca la sesión admin original).
  const data = isImpersonating ? effective : sessionState.data;

  return {
    data,
    status: sessionState.status,
    update: sessionState.update,
  };
}
