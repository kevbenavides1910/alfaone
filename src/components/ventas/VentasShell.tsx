"use client";

import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";
import { Topbar } from "@/components/layout/Topbar";
import { ModuleSubnav } from "@/components/layout/ModuleSubnav";

type Tab = {
  href: string;
  label: string;
  permission: PermissionKey;
  minLevel?: PermissionLevelId;
  isActive?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/ventas/oportunidades",
    label: "Oportunidades",
    permission: "ventas.oportunidades",
    isActive: (p) => p === "/ventas/oportunidades" || p.startsWith("/ventas/oportunidades/"),
  },
  {
    href: "/ventas/presupuestos",
    label: "Presupuestos",
    permission: "ventas.presupuestos",
    isActive: (p) =>
      p === "/ventas/presupuestos" ||
      (p.startsWith("/ventas/presupuestos/") && !p.startsWith("/ventas/presupuestos/parametros")),
  },
  {
    href: "/ventas/presupuestos/parametros",
    label: "Parametrización",
    permission: "ventas.presupuestos",
    minLevel: "edit",
    isActive: (p) => p.startsWith("/ventas/presupuestos/parametros"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function VentasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) =>
    hasPermission(session, tab.permission, tab.minLevel ?? "view")
  );

  return (
    <>
      <Topbar title="Ventas" />
      <ModuleSubnav
        ariaLabel="Secciones Ventas"
        tabs={visibleTabs.map((tab) => ({
          href: tab.href,
          label: tab.label,
          active: tabActive(tab, pathname),
        }))}
      />
      <main className="min-w-0">{children}</main>
    </>
  );
}
