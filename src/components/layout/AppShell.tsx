"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SidebarContext } from "./SidebarContext";

const SIDEBAR_COLLAPSED_KEY = "alfa-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedReady, setCollapsedReady] = useState(false);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const pathname = usePathname();

  const isHome = pathname === "/home";
  const isContracts = pathname.startsWith("/contracts");
  const useContentCanvas = !isHome && !isContracts;

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
    setCollapsedReady(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    function onToggleMobile() {
      toggleMobile();
    }
    function onToggleCollapsed() {
      toggleCollapsed();
    }
    window.addEventListener("alfa-toggle-sidebar", onToggleMobile);
    window.addEventListener("alfa-toggle-sidebar-collapse", onToggleCollapsed);
    return () => {
      window.removeEventListener("alfa-toggle-sidebar", onToggleMobile);
      window.removeEventListener("alfa-toggle-sidebar-collapse", onToggleCollapsed);
    };
  }, [toggleMobile, toggleCollapsed]);

  const sidebarContext = useMemo(
    () => ({
      mobileOpen,
      toggleMobile,
      closeMobile,
      collapsed,
      toggleCollapsed,
    }),
    [mobileOpen, toggleMobile, closeMobile, collapsed, toggleCollapsed],
  );

  return (
    <SidebarContext.Provider value={sidebarContext}>
      <div className="flex min-h-screen bg-background">
        {!isHome && (
          <div
            className={cn(
              "hidden lg:flex lg:sticky lg:top-0 lg:h-screen shrink-0 transition-[width] duration-200 ease-out",
              collapsedReady && collapsed ? "w-[4.25rem]" : "w-64",
            )}
          >
            <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
          </div>
        )}

        {!isHome && mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={closeMobile}
            />
            <div
              className="fixed left-0 top-0 z-50 lg:hidden h-screen w-64"
              style={{ animation: "slideIn 0.2s ease-out" }}
            >
              <Sidebar
                collapsed={false}
                onToggle={closeMobile}
                onClose={closeMobile}
                isMobile
              />
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Topbar showCollapseToggle={!isHome} sidebarCollapsed={collapsed} />
          <main
            className={cn(
              "flex-1 flex flex-col min-h-0 min-w-0",
              useContentCanvas && "app-content-canvas",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
