"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import { permissionKeyFromPath } from "@/lib/permissions/registry";

type Props = {
  children: React.ReactNode;
};

export function PermissionGuard({ children }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") return;
    if (pathname === "/home" || pathname === "/login") return;

    if (pathname.startsWith("/admin") && isPlatformAdmin(session)) return;

    const key = permissionKeyFromPath(pathname);
    if (key && !hasPermission(session, key, "view")) {
      router.replace("/home");
    }
  }, [pathname, session, status, router]);

  return <>{children}</>;
}
