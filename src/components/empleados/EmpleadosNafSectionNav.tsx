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
    href: "/empleados-naf",
    label: "Directorio NAF",
    permission: "empleadosNaf.list",
    isActive: (p) =>
      p === "/empleados-naf" ||
      (p.startsWith("/empleados-naf/") &&
        !p.startsWith("/empleados-naf/nomina") &&
        !p.startsWith("/empleados-naf/cargas-sociales") &&
        !p.startsWith("/empleados-naf/vacaciones-personal")),
  },
  {
    href: "/empleados-naf/nomina",
    label: "Nómina NAF",
    permission: "empleadosNaf.nomina",
    isActive: (p) =>
      p === "/empleados-naf/nomina" ||
      (p.startsWith("/empleados-naf/nomina") &&
        !p.startsWith("/empleados-naf/nomina/homologacion") &&
        !p.startsWith("/empleados-naf/nomina/sin-asignar") &&
        !p.startsWith("/empleados-naf/nomina/revision-planilla")),
  },
  {
    href: "/empleados-naf/nomina/revision-planilla",
    label: "Revisión de planilla",
    permission: "empleadosNaf.revisionPlanilla",
    isActive: (p) => p.startsWith("/empleados-naf/nomina/revision-planilla"),
  },
  {
    href: "/empleados-naf/nomina/sin-asignar",
    label: "Sin asignar",
    permission: "empleadosNaf.sinAsignar",
    isActive: (p) => p.startsWith("/empleados-naf/nomina/sin-asignar"),
  },
  {
    href: "/empleados-naf/nomina/homologacion",
    label: "Homologación",
    permission: "empleadosNaf.homologacion",
    isActive: (p) => p.startsWith("/empleados-naf/nomina/homologacion"),
  },
  {
    href: "/empleados-naf/cargas-sociales",
    label: "Cargas sociales",
    permission: "empleadosNaf.cargasSociales",
    isActive: (p) => p.startsWith("/empleados-naf/cargas-sociales"),
  },
  {
    href: "/empleados-naf/vacaciones-personal",
    label: "Vacaciones",
    permission: "empleadosNaf.vacacionesPersonal",
    isActive: (p) => p.startsWith("/empleados-naf/vacaciones-personal"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function EmpleadosNafSectionNav() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();

  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  if (visibleTabs.length === 0) return null;

  return (
    <div className="border-b border-white/10 bg-[color:var(--app-sidebar)] text-white">
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
