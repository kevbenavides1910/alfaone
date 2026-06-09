"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
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

    if (status === "unauthenticated") {
      const callback = pathname && pathname !== "/login" ? pathname : "/home";
      router.replace(`/login?callbackUrl=${encodeURIComponent(callback)}`);
      return;
    }

    if (pathname === "/home" || pathname === "/login") return;

    if (pathname.startsWith("/admin") && isPlatformAdmin(session)) return;

    const key = permissionKeyFromPath(pathname);
    if (key && !hasPermission(session, key, "view")) {
      router.replace("/home");
    }
  }, [pathname, session, status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return <>{children}</>;
}
