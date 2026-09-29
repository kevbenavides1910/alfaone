"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth/client-session";
import { LayoutGrid, LogOut, Menu, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { loginCallbackUrl } from "@/lib/auth/logout";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationCenterBell } from "@/components/notifications/NotificationCenterBell";

interface TopbarProps {
  title?: ReactNode;
  /** @deprecated */
  showCollapseToggle?: boolean;
  /** @deprecated */
  sidebarCollapsed?: boolean;
}

function openCommandPalette() {
  window.dispatchEvent(new Event("alfa-open-command-palette"));
}

function openSyntraAssistant() {
  window.dispatchEvent(new Event("alfa-open-syntra"));
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
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={`fixed left-0 top-0 z-50 h-[100dvh] w-[17rem] max-w-[85vw] lg:hidden transition-transform duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
          "sticky top-0 z-30 flex h-[3.25rem] items-center gap-2 border-b border-border/70 px-2.5 sm:gap-3 sm:px-4",
          "bg-card/90 shadow-[0_1px_0_rgb(0_0_0/0.02)] backdrop-blur-xl",
          onHome && "bg-[hsl(214_20%_97%)]/90 dark:bg-background/90"
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted active:bg-muted/70 hover:text-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          {!onHome && (
            <nav className="flex min-w-0 items-center gap-1.5" aria-label="Breadcrumb">
              <Link
                href="/home"
                className="hidden shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Inicio</span>
              </Link>
              {title && (
                <>
                  <span className="hidden text-sm text-muted-foreground/50 sm:inline">/</span>
                  <span className="truncate text-sm font-medium text-foreground">{title}</span>
                </>
              )}
            </nav>
          )}

          {onHome && title && (
            <span className="hidden text-base font-semibold text-foreground sm:inline">{title}</span>
          )}
        </div>

        <div className="mx-auto flex min-w-0 max-w-xl flex-1 justify-center px-1">
          <button
            type="button"
            onClick={openCommandPalette}
            className={cn(
              "flex h-10 w-full max-w-md items-center gap-2 rounded-2xl border border-border/70 bg-muted/50 px-3 text-left text-[15px] sm:text-sm text-muted-foreground",
              "transition-all hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.99]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)]",
              "dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
            )}
            aria-label="Buscar módulos"
          >
            <Search className="h-4 w-4 shrink-0 opacity-70" />
            <span className="min-w-0 flex-1 truncate">Buscar…</span>
            <kbd className="hidden shrink-0 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <button
            type="button"
            onClick={openSyntraAssistant}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm transition-all hover:opacity-90 active:scale-95 sm:h-9 sm:w-auto sm:px-3.5 sm:text-xs sm:font-semibold sm:gap-1.5 sm:inline-flex",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background"
            )}
            style={{ backgroundColor: "var(--app-primary)" }}
            aria-label="Abrir asistente Syntra IA"
          >
            <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
            <span className="hidden sm:inline">Syntra IA</span>
          </button>

          <ThemeToggle />
          <NotificationCenterBell />

          <span className="hidden max-w-[120px] truncate px-1 text-xs text-muted-foreground lg:block">
            {session?.user?.name}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: loginCallbackUrl() })}
            className="h-10 w-10 p-0 sm:h-8 sm:w-auto sm:px-2.5 gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-red-500 [&_span]:hidden sm:[&_span]:inline"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-xs font-medium">Salir</span>
          </Button>
        </div>
      </header>
    </>
  );
}
