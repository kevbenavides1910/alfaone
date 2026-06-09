"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("alfa-one:sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("alfa-one:sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} onClose={() => {}} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={"fixed left-0 top-0 z-50 h-full md:hidden transition-transform duration-300 " +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")}
      >
        <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} isMobile />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile hamburger */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-white sticky top-0 z-30 min-h-[48px]">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {children}
      </div>

      <CommandPalette />
    </div>
  );
}
