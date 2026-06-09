"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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
    href: "/empleados",
    label: "Directorio",
    permission: "empleados.list",
    isActive: (p) =>
      p === "/empleados" ||
      (p.startsWith("/empleados/") &&
        !p.startsWith("/empleados/importar") &&
        !p.startsWith("/empleados/contratos")),
  },
  {
    href: "/empleados/importar",
    label: "Importar",
    permission: "empleados.import",
  },
  {
    href: "/empleados/contratos",
    label: "Conciliación contratos",
    permission: "empleados.contratos",
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function EmpleadosSectionNav() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();

  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  if (visibleTabs.length === 0) return null;

  return (
    <div className="border-b border-indigo-200/80 bg-indigo-800 text-white">
      <div className="flex flex-wrap gap-1 px-2 py-2 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              tabActive(tab, pathname)
                ? "bg-card text-indigo-900 shadow-sm"
                : "text-indigo-100 hover:bg-card/10 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
