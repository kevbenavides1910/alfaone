"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  APP_BRANDING_QUERY_KEY,
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_PRIMARY_HEX,
  DEFAULT_SIDEBAR_HEX,
} from "@/modules/plataforma/branding-constants";
import { SIDEBAR_NAV_ITEMS } from "@/lib/modules/navigation";
import { canAccessModule } from "@/lib/modules/access";
import { hasPermission } from "@/lib/permissions/check";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const { data: brand } = useQuery({
    queryKey: APP_BRANDING_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/branding");
      const j = (await r.json()) as {
        data?: { primaryHex: string; sidebarHex: string; hasLogo: boolean; updatedAt: string };
      };
      if (!r.ok || !j.data) {
        return {
          primaryHex: DEFAULT_PRIMARY_HEX,
          sidebarHex: DEFAULT_SIDEBAR_HEX,
          hasLogo: false,
          updatedAt: "",
        };
      }
      return j.data;
    },
    staleTime: 30_000,
  });

  const primary = brand?.primaryHex ?? DEFAULT_PRIMARY_HEX;
  const sidebarBg = brand?.sidebarHex ?? DEFAULT_SIDEBAR_HEX;
  const logoSrc = brand?.hasLogo && brand.updatedAt ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}` : null;

  return (
    <aside className="w-64 text-white flex flex-col min-h-screen" style={{ backgroundColor: sidebarBg }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="rounded-lg p-2 shrink-0 overflow-hidden flex items-center justify-center w-10 h-10" style={{ backgroundColor: primary }}>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" className="max-h-8 max-w-8 object-contain" />
          ) : (
            <Shield className="h-5 w-5 text-white" />
          )}
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">{APP_NAME}</div>
          <div className="text-xs text-slate-400">{APP_TAGLINE}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {SIDEBAR_NAV_ITEMS.filter((item) => {
          if (!session) return false;
          if (item.adminOnly && session.user?.role !== "ADMIN" && session.user?.roleCode !== "ADMIN") {
            return false;
          }
          if (item.href === "/facturacion") {
            return canAccessModule(session, "facturacion");
          }
          if (item.href === "/contracts") {
            return hasPermission(session, "presupuestos.contracts", "view");
          }
          return canAccessModule(session, item.moduleId);
        }).map((item) => {
          const active = item.isActive
            ? item.isActive(pathname, item.href)
            : pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/home" &&
                pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "text-slate-400 hover:bg-card/5 hover:text-white"
              )}
              style={active ? { backgroundColor: primary } : undefined}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: primary }}
          >
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium truncate">{session?.user?.name}</div>
            <div className="text-xs text-slate-400 truncate">{role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
