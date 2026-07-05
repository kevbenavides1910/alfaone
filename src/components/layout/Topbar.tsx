"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, LayoutGrid, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { loginCallbackUrl } from "@/lib/auth/logout";
import { Sidebar } from "@/components/layout/Sidebar";

interface TopbarProps {
  title?: string;
  /** @deprecated */
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

  return (
    <>
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
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
          "h-14 border-b flex items-center justify-between px-4 sticky top-0 z-20",
          onHome
            ? "bg-[#0f0f0f] border-white/8 text-white"
            : "border-border bg-card/95 backdrop-blur-md shadow-sm"
        )}
      >
        {/* Izquierda: botón mobile + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburguer — solo mobile */}
          <button
            type="button"
            className={cn(
              "md:hidden flex items-center justify-center h-8 w-8 rounded-md transition-colors shrink-0",
              onHome
                ? "text-white/70 hover:bg-white/10 hover:text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            )}
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          {!onHome && (
            <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
              <Link
                href="/home"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Inicio</span>
              </Link>
              {title && (
                <>
                  <span className="hidden sm:inline text-slate-300 text-sm">/</span>
                  <span className="font-medium text-slate-700 truncate text-sm">
                    {title}
                  </span>
                </>
              )}
            </nav>
          )}

          {/* En /home solo muestra el título */}
          {onHome && title && (
            <span className="font-semibold text-base text-white/80">{title}</span>
          )}
        </div>

        {/* Derecha: nombre usuario + notificaciones + salir */}
        <div className="flex items-center gap-0.5 shrink-0">
          <span
            className={cn(
              "hidden md:block text-xs truncate max-w-[160px] px-2",
              onHome ? "text-white/60" : "text-slate-500"
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
                ? "text-white/50 hover:text-white hover:bg-white/10"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
              "gap-1.5 h-8 px-2.5 focus-visible:ring-2 focus-visible:ring-red-500",
              onHome
                ? "text-white/60 hover:bg-white/10 hover:text-white"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
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
