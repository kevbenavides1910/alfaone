"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";
import { ModuleSubnav } from "@/components/layout/ModuleSubnav";

type Tab = {
  href: string;
  label: string;
  permission: PermissionKey;
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
    isActive: (p) => p === "/ventas/presupuestos" || p.startsWith("/ventas/presupuestos/"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function VentasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <ModuleSubnav
        ariaLabel="Secciones Ventas"
        tabs={visibleTabs.map((tab) => ({
          href: tab.href,
          label: tab.label,
          active: tabActive(tab, pathname),
        }))}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
