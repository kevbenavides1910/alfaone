"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";

type Tab = {
  href: string;
  label: string;
  permission: PermissionKey;
  isActive?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/naf-operaciones",
    label: "Roles",
    permission: "nafOperaciones.roles",
    isActive: (p) =>
      p === "/naf-operaciones" ||
      (p.startsWith("/naf-operaciones/") &&
        !p.startsWith("/naf-operaciones/programacion") &&
        !p.startsWith("/naf-operaciones/asistencia") &&
        !p.startsWith("/naf-operaciones/vacantes")),
  },
  {
    href: "/naf-operaciones/programacion",
    label: "Programación",
    permission: "nafOperaciones.programacion",
    isActive: (p) => p.startsWith("/naf-operaciones/programacion"),
  },
  {
    href: "/naf-operaciones/asistencia",
    label: "Asistencia",
    permission: "nafOperaciones.asistencia",
    isActive: (p) => p.startsWith("/naf-operaciones/asistencia"),
  },
  {
    href: "/naf-operaciones/vacantes",
    label: "Vacantes",
    permission: "nafOperaciones.vacantes",
    isActive: (p) => p.startsWith("/naf-operaciones/vacantes"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function NafOperacionesSectionNav() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();

  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  if (visibleTabs.length === 0) return null;

  return (
    <div className="border-b border-[#2a2a2a] bg-[#111111] text-white">
      <div className="flex flex-wrap gap-1 px-2 py-2 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              tabActive(tab, pathname)
                ? "bg-red-600 text-white shadow-sm"
                : "text-gray-300 hover:bg-white/10 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
