"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth/client-session";
import { LayoutGrid, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { loginCallbackUrl } from "@/lib/auth/logout";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationCenterBell } from "@/components/notifications/NotificationCenterBell";

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
          "border-border bg-card/95 backdrop-blur-md shadow-sm",
          onHome && "bg-white dark:bg-[#0f0f0f]"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-md transition-colors shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>

          {!onHome && (
            <nav className="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
              <Link
                href="/home"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Inicio</span>
              </Link>
              {title && (
                <>
                  <span className="hidden sm:inline text-muted-foreground/50 text-sm">/</span>
                  <span className="font-medium text-foreground truncate text-sm">
                    {title}
                  </span>
                </>
              )}
            </nav>
          )}

          {onHome && title && (
            <span className="font-semibold text-base text-foreground">{title}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden md:block text-xs truncate max-w-[160px] px-1 text-muted-foreground">
            {session?.user?.name}
          </span>
          {!onHome && <ThemeToggle />}
          <NotificationCenterBell />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: loginCallbackUrl() })}
            className="gap-1.5 h-8 px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">Salir</span>
          </Button>
        </div>
      </header>
    </>
  );
}
