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
          "sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4",
          "bg-card/95 shadow-sm backdrop-blur-md",
          onHome && "bg-[hsl(214_20%_97%)]/90 dark:bg-background/90"
        )}
      >
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
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
              "flex h-9 w-full max-w-md items-center gap-2 rounded-xl border border-border/80 bg-muted/50 px-3 text-left text-sm text-muted-foreground",
              "transition-colors hover:border-border hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)]",
              "dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
            )}
            aria-label="Buscar módulos"
          >
            <Search className="h-4 w-4 shrink-0 opacity-70" />
            <span className="min-w-0 flex-1 truncate">Buscar módulos o datos…</span>
            <kbd className="hidden shrink-0 rounded-md border border-border/80 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={openSyntraAssistant}
            className={cn(
              "hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:inline-flex",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background"
            )}
            style={{ backgroundColor: "var(--app-primary)" }}
            aria-label="Abrir asistente Syntra IA"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Syntra IA
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
            className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden text-xs font-medium sm:inline">Salir</span>
          </Button>
        </div>
      </header>
    </>
  );
}
