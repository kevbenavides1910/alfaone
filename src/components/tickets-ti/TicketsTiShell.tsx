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
  hideIfCentro?: boolean;
  isActive?: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    href: "/tickets-ti",
    label: "Centro de Operaciones",
    permission: "ticketsTi.centro",
    isActive: (p) => p === "/tickets-ti",
  },
  {
    href: "/tickets-ti/mis-tickets",
    label: "Mis tickets",
    permission: "ticketsTi.tickets",
    hideIfCentro: true,
    isActive: (p) => {
      if (p === "/tickets-ti/mis-tickets") return true;
      const match = p.match(/^\/tickets-ti\/([^/]+)$/);
      if (!match) return false;
      const staticRoutes = new Set(["nuevo", "admin", "reportes", "mis-tickets"]);
      return !staticRoutes.has(match[1]);
    },
  },
  {
    href: "/tickets-ti/nuevo",
    label: "Nuevo ticket",
    permission: "ticketsTi.tickets",
    isActive: (p) => p === "/tickets-ti/nuevo",
  },
  {
    href: "/tickets-ti/admin",
    label: "Administración",
    permission: "ticketsTi.admin",
    isActive: (p) => p.startsWith("/tickets-ti/admin"),
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function TicketsTiShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) => {
    if (!hasPermission(session, tab.permission, "view")) return false;
    if (tab.hideIfCentro && hasPermission(session, "ticketsTi.centro", "view")) return false;
    return true;
  });

  if (visibleTabs.length <= 1) {
    return <main className="flex-1 min-w-0">{children}</main>;
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <ModuleSubnav
        ariaLabel="Secciones Tickets TI"
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
