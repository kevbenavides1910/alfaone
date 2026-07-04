"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Bell, LayoutGrid, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  APP_BRANDING_QUERY_KEY,
  APP_NAME,
  DEFAULT_PRIMARY_HEX,
  DEFAULT_SIDEBAR_HEX,
} from "@/modules/plataforma/branding-constants";

interface TopbarProps {
  title?: string;
  showCollapseToggle?: boolean;
  sidebarCollapsed?: boolean;
}

export function Topbar({ title, showCollapseToggle: _showCollapseToggle, sidebarCollapsed: _sidebarCollapsed }: TopbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const onHome = pathname === "/home";

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
  const logoSrc =
    brand?.hasLogo && brand.updatedAt
      ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}`
      : null;

  return (
    <header
      className={cn(
        "h-16 border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-20",
        onHome
          ? "bg-[#161616] border-[#393939] text-white shadow-md"
          : "border-border bg-card/90 backdrop-blur-md shadow-sm"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/home"
          className={cn(
            "flex items-center gap-2.5 shrink-0 rounded-lg pr-2 py-1 transition-colors",
            onHome ? "hover:bg-white/10" : !onHome && "hover:bg-muted"
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

      <div className="flex items-center gap-2 shrink-0">
        {!onHome && (
          <Button variant="outline" size="sm" className="sm:hidden gap-1.5" asChild>
            <Link href="/home">
              <LayoutGrid className="h-4 w-4" />
              Inicio
            </Link>
          </Button>
        )}
        <span
          className={cn(
            "hidden md:block text-xs truncate max-w-[140px]",
            onHome ? "text-white/70" : "text-slate-500"
          )}
        >
          {session?.user?.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label="Notificaciones"
          className={onHome ? "text-white hover:bg-white/10 hover:text-white" : undefined}
        >
          <Bell className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "gap-2",
            onHome ? "text-white hover:bg-white/10 hover:text-white" : "text-slate-600"
          )}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Salir</span>
        </Button>
      </div>
    </header>
  );
}
