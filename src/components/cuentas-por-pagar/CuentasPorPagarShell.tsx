"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils/cn";

type Tab = {
  href: string;
  label: string;
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/cuentas-por-pagar",
    label: "Facturas CXP",
    match: (path) => path === "/cuentas-por-pagar",
  },
  {
    href: "/cuentas-por-pagar/movimientos",
    label: "Movimientos contables",
    match: (path) => path.startsWith("/cuentas-por-pagar/movimientos"),
  },
];

export function CuentasPorPagarShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <>
      <Topbar title="Cuentas por pagar" />
      <nav
        aria-label="Secciones de cuentas por pagar"
        className="sticky top-14 lg:top-16 z-10 border-b border-white/10 bg-[color:var(--app-sidebar)]"
      >
        <div className="flex gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150",
                  active
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-gray-300 hover:bg-white/10 hover:text-white",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
      {children}
    </>
  );
}
