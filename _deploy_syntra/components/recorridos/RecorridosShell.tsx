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
    href: "/recorridos",
    label: "Resumen",
    permission: "recorridos.dashboard",
    isActive: (p) => p === "/recorridos",
  },
  {
    href: "/recorridos/mapa",
    label: "Mapa en vivo",
    permission: "recorridos.dashboard",
    isActive: (p) => p.startsWith("/recorridos/mapa"),
  },
  {
    href: "/recorridos/configuracion",
    label: "Configuración",
    permission: "recorridos.configuracion",
  },
  {
    href: "/recorridos/rutas",
    label: "Rutas y puntos",
    permission: "recorridos.rutas",
    isActive: (p) => p.startsWith("/recorridos/rutas"),
  },
  {
    href: "/recorridos/reportes",
    label: "Reportes",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/reportes"),
  },
  {
    href: "/recorridos/bitacora",
    label: "Bitácora digital",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/bitacora"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function RecorridosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Recorrido de marcas" />
      {visibleTabs.length > 0 && (
        <div className="border-b border-rose-200/80 bg-rose-800 text-white">
          <div className="flex flex-wrap gap-1 px-2 py-2 overflow-x-auto">
            {visibleTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  tabActive(tab, pathname)
                    ? "bg-card text-rose-900 shadow-sm"
                    : "text-rose-100 hover:bg-card/10 hover:text-white",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
