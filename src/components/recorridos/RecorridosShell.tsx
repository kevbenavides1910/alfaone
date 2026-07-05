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
    href: "/recorridos/rutas",
    label: "Rutas",
    permission: "recorridos.rutas",
    isActive: (p) =>
      p.startsWith("/recorridos/rutas") && !p.startsWith("/recorridos/rutas-permitidas"),
  },
  {
    href: "/recorridos/rutas-permitidas",
    label: "Asignaciones",
    permission: "recorridos.rutas",
    isActive: (p) => p.startsWith("/recorridos/rutas-permitidas"),
  },
  {
    href: "/recorridos/reportes",
    label: "Reportes",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/reportes"),
  },
  {
    href: "/recorridos/marcas-fuera-ruta",
    label: "Fuera de ruta",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/marcas-fuera-ruta"),
  },
  {
    href: "/recorridos/auditoria-pendientes",
    label: "Auditoría",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/auditoria-pendientes"),
  },
  {
    href: "/recorridos/bitacora",
    label: "Bitácora",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/bitacora"),
  },
  {
    href: "/recorridos/hombre-vivo",
    label: "Hombre vivo",
    permission: "recorridos.reportes",
    isActive: (p) => p.startsWith("/recorridos/hombre-vivo"),
  },
  {
    href: "/recorridos/configuracion",
    label: "Configuración",
    permission: "recorridos.configuracion",
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
    <div className="flex flex-col min-h-screen bg-background">
      <Topbar title="Recorrido de marcas" />
      {visibleTabs.length > 0 && (
        <nav
          className="sticky top-14 lg:top-16 z-10 border-b border-[#2a2a2a] bg-[#111111]"
          aria-label="Secciones de recorrido de marcas"
        >
          <div className="px-3 md:px-5 flex flex-wrap gap-1 py-2 overflow-x-auto scrollbar-none">
            {visibleTabs.map((tab) => {
              const active = tabActive(tab, pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-150",
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
      )}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
