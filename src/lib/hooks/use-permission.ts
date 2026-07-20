"use client";

import { useSession } from "@/lib/auth/client-session";
import { hasPermission, type SessionWithPermissions } from "@/lib/permissions/check";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";

export function usePermission(key: PermissionKey, minLevel: PermissionLevelId = "view"): boolean {
  const { data: session } = useSession();
  return hasPermission(session, key, minLevel);
}

export function useSessionPermissions() {
  const { data: session } = useSession();
  return (session as SessionWithPermissions | null)?.user?.permissions ?? {};
}
