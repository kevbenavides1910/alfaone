"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";
import { Topbar } from "@/components/layout/Topbar";
import { ModuleSubnav } from "@/components/layout/ModuleSubnav";

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
  { href: "/bandeco/activaciones", label: "Activaciones", permission: "bandeco.operacion" },
  { href: "/bandeco/registro", label: "Registro", permission: "bandeco.registros" },
  { href: "/bandeco/aperturas-cierres", label: "Aperturas y cierres", permission: "bandeco.operacion" },
  { href: "/bandeco/eventos", label: "Eventos", permission: "bandeco.operacion" },
  { href: "/bandeco/pilas", label: "Pilas", permission: "bandeco.operacion" },
  { href: "/bandeco/informe-semanal", label: "Informe semanal", permission: "bandeco.registros" },
  { href: "/bandeco/mantenimientos", label: "Mantenimientos", permission: "bandeco.mantenimientos" },
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
    <>
      <Topbar title="Monitoreo Bandeco" />
      <ModuleSubnav
        ariaLabel="Secciones Bandeco"
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
