"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";
import { Topbar } from "@/components/layout/Topbar";

type Tab = {
  href: string;
  label: string;
  permission: PermissionKey;
  isActive?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/bandeco",
    label: "Consulta",
    permission: "bandeco.consulta",
    isActive: (p) => p === "/bandeco",
  },
  {
    href: "/bandeco/activaciones",
    label: "Activaciones",
    permission: "bandeco.operacion",
  },
  {
    href: "/bandeco/registro",
    label: "Registro",
    permission: "bandeco.registros",
  },
  {
    href: "/bandeco/aperturas-cierres",
    label: "Aperturas y cierres",
    permission: "bandeco.operacion",
  },
  {
    href: "/bandeco/eventos",
    label: "Eventos",
    permission: "bandeco.operacion",
  },
  {
    href: "/bandeco/pilas",
    label: "Pilas",
    permission: "bandeco.operacion",
  },
  {
    href: "/bandeco/informe-semanal",
    label: "Informe semanal",
    permission: "bandeco.registros",
  },
  {
    href: "/bandeco/mantenimientos",
    label: "Mantenimientos",
    permission: "bandeco.mantenimientos",
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function BandecoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Topbar title="Monitoreo Bandeco" />
      {visibleTabs.length > 0 && (
        <nav
          className="sticky top-16 z-10 border-b border-border bg-card/90 backdrop-blur-md shadow-sm"
          aria-label="Secciones Bandeco"
        >
          <div className="px-4 md:px-6 flex flex-wrap gap-1 py-2 overflow-x-auto">
            {visibleTabs.map((tab) => {
              const active = tabActive(tab, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-slate-600 hover:bg-muted hover:text-slate-900",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
