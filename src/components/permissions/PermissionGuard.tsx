"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import { permissionKeyFromPath } from "@/lib/permissions/registry";

type Props = {
  children: React.ReactNode;
};

export function PermissionGuard({ children }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { data: session, status } = useSession();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (status === "loading") {
      setAuthorized(false);
      return;
    }
    if (status !== "authenticated") {
      setAuthorized(false);
      return;
    }
    if (pathname === "/home" || pathname === "/login") {
      setAuthorized(true);
      return;
    }

    const key = permissionKeyFromPath(pathname);
    if (key && !hasPermission(session, key, "view")) {
      setAuthorized(false);
      router.replace("/home");
      return;
    }
    setAuthorized(true);
  }, [pathname, session, status, router]);

  if (status === "loading" || !authorized) return null;

  return <>{children}</>;
}
