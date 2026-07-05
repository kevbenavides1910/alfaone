"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Shield, X } from "lucide-react";
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
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";

interface Props {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ collapsed, onToggle, onClose, isMobile }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();

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
  const logoSrc =
    brand?.hasLogo && brand.updatedAt
      ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}`
      : null;

  const filteredItems = SIDEBAR_NAV_ITEMS.filter((item) => {
    if (!session) return false;
    if (item.adminOnly && !isPlatformAdmin(session)) return false;
    if (item.href === "/facturacion") return canAccessModule(session, "facturacion");
    if (item.href === "/contracts") return hasPermission(session, "presupuestos.contracts", "view");
    return canAccessModule(session, item.moduleId);
  });

  const handleNav = () => {
    if (isMobile && onClose) onClose();
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full text-white transition-all duration-300 ease-in-out overflow-hidden",
        !isMobile && (collapsed ? "w-16" : "w-64")
      )}
      style={{ backgroundColor: sidebarBg }}
    >
      <div
        className={cn(
          "flex items-center border-b border-white/10 h-16 shrink-0",
          collapsed && !isMobile ? "justify-center px-0" : "gap-3 px-4 md:px-6"
        )}
      >
        <div
          className="rounded-lg p-2 shrink-0 flex items-center justify-center w-10 h-10"
          style={{ backgroundColor: primary }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" className="max-h-8 max-w-8 object-contain" />
          ) : (
            <Shield className="h-5 w-5 text-white" />
          )}
        </div>
        {!collapsed && (
          <div className="overflow-hidden flex-1 min-w-0">
            <div className="font-bold text-sm leading-tight truncate">{APP_NAME}</div>
            <div className="text-xs text-slate-400 truncate">{APP_TAGLINE}</div>
          </div>
        )}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {filteredItems.map((item) => {
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
              onClick={handleNav}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed && !isMobile ? "justify-center px-0 py-2.5 w-full" : "gap-3 px-3 py-2",
                active ? "text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
              )}
              style={active ? { backgroundColor: primary } : undefined}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {!isMobile && onToggle && (
        <button
          onClick={onToggle}
          className="flex items-center justify-center h-10 border-t border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          title={collapsed ? "Expandir" : "Colapsar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2 text-xs">Colapsar</span>
            </>
          )}
        </button>
      )}

      <div
        className={cn(
          "shrink-0 border-t border-white/10 px-4 py-3",
          collapsed && !isMobile ? "flex justify-center" : ""
        )}
      >
        <div className={cn("flex items-center gap-3", collapsed && !isMobile ? "justify-center" : "")}>
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: primary }}
          >
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {(!collapsed || isMobile) && (
            <div className="overflow-hidden min-w-0">
              <div className="text-sm font-medium truncate">{session?.user?.name}</div>
              <div className="text-xs text-slate-400 truncate">
                {session?.user?.roleCode ?? session?.user?.role}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
