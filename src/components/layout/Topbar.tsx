"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Bell, LayoutGrid, LogOut, Shield, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { loginCallbackUrl } from "@/lib/auth/logout";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  APP_BRANDING_QUERY_KEY,
  APP_NAME,
  DEFAULT_PRIMARY_HEX,
} from "@/modules/plataforma/branding-constants";

interface TopbarProps {
  title?: string;
  /** @deprecated El colapso del sidebar vive en SidebarPane */
  showCollapseToggle?: boolean;
  /** @deprecated */
  sidebarCollapsed?: boolean;
}

export function Topbar({
  title,
  showCollapseToggle: _showCollapseToggle,
  sidebarCollapsed: _sidebarCollapsed,
}: TopbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const onHome = pathname === "/home";
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: brand } = useQuery({
    queryKey: APP_BRANDING_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/branding");
      const j = (await r.json()) as {
        data?: { primaryHex: string; sidebarHex: string; hasLogo: boolean; updatedAt: string };
      };
      if (!r.ok || !j.data) {
        return { primaryHex: DEFAULT_PRIMARY_HEX, sidebarHex: "", hasLogo: false, updatedAt: "" };
      }
      return j.data;
    },
    staleTime: 30_000,
  });

  const primary = brand?.primaryHex ?? DEFAULT_PRIMARY_HEX;
  const logoSrc =
    brand?.hasLogo && brand.updatedAt
      ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}`
      : null;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-64 md:hidden transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          collapsed={false}
          onToggle={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)}
          isMobile
        />
      </div>

      <header
        className={cn(
          "h-16 border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-20",
          onHome
            ? "bg-[#0f0f0f] border-white/8 text-white"
            : "border-border bg-card/90 backdrop-blur-md shadow-sm"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 transition-colors shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" style={{ color: onHome ? "#fff" : "#475569" }} />
          </button>

          <Link
            href="/home"
            className={cn(
              "flex items-center gap-2.5 shrink-0 rounded-lg pr-2 py-1 transition-colors",
              onHome ? "hover:bg-white/10" : "hover:bg-muted"
            )}
            title="Volver al inicio"
          >
            <div
              className="rounded-lg p-1.5 flex items-center justify-center w-9 h-9"
              style={{ backgroundColor: primary }}
            >
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="" className="max-h-6 max-w-6 object-contain" />
              ) : (
                <Shield className="h-4 w-4 text-white" />
              )}
            </div>
            <span
              className={cn(
                "hidden sm:block font-semibold text-sm",
                onHome ? "text-white" : "text-slate-800"
              )}
            >
              {APP_NAME}
            </span>
          </Link>

          {!onHome && (
            <>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <Link
                href="/home"
                className="hidden sm:inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors shrink-0"
              >
                <LayoutGrid className="h-4 w-4" />
                Inicio
              </Link>
              {title && (
                <>
                  <span className="text-slate-300 hidden md:inline">/</span>
                  <span className="font-semibold text-slate-800 truncate text-sm md:text-base">
                    {title}
                  </span>
                </>
              )}
            </>
          )}

          {onHome && (
            <span className="font-semibold text-lg text-white">{title ?? "Inicio"}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "hidden md:block text-xs truncate max-w-[140px] px-1",
              onHome ? "text-white/80" : "text-slate-500"
            )}
          >
            {session?.user?.name}
          </span>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-md transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
              onHome
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            )}
            aria-label="Notificaciones"
          >
            <Bell className="h-4 w-4" />
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: loginCallbackUrl() })}
            className={cn(
              "gap-2 h-8 px-2.5 focus-visible:ring-2 focus-visible:ring-red-500",
              onHome
                ? "text-white/80 hover:bg-white/10 hover:text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Salir</span>
          </Button>
        </div>
      </header>
    </>
  );
}
