"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useImpersonation } from "@/lib/impersonation/context";
import {
  cacheImpersonationPreview,
  clearImpersonationPreviewCache,
} from "@/lib/impersonation/use-effective-session";
import type { PermissionMap } from "@/lib/permissions/resolve";

/**
 * Precarga permisos del rol impersonado (sessionStorage, por pestaña) sin tocar el JWT global.
 */
export function ImpersonationGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const { isImpersonating, roleId, roleCode, token } = useImpersonation();
  const [ready, setReady] = useState(!isImpersonating);

  useEffect(() => {
    if (!isImpersonating) {
      clearImpersonationPreviewCache();
      setReady(true);
      return;
    }

    if (!token || !roleId || !roleCode) {
      // Estado de impersonación incompleto: no renderizar la app con sesión admin real.
      setReady(false);
      return;
    }

    let cancelled = false;
    setReady(false);

    void (async () => {
      try {
        const r = await fetch("/api/admin/roles/impersonation-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "same-origin",
        });
        const json = (await r.json()) as {
          data?: { roleId: string; roleCode: string; permissions: PermissionMap };
        };
        if (r.ok && json.data) {
          cacheImpersonationPreview(json.data);
        }
      } catch {
        // useEffectiveSession aplicará rol con permisos vacíos hasta recargar
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isImpersonating, token, roleId, roleCode]);

  if (status === "loading" || (isImpersonating && !ready)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Aplicando vista previa del rol…
      </div>
    );
  }

  return <>{children}</>;
}
