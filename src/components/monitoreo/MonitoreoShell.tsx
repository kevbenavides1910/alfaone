"use client";

import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
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
    href: "/monitoreo",
    label: "Consulta",
    permission: "monitoreo.consulta",
    isActive: (p) => p === "/monitoreo",
  },
  { href: "/monitoreo/activaciones", label: "Activaciones", permission: "monitoreo.operacion" },
  { href: "/monitoreo/registro", label: "Registro", permission: "monitoreo.registros" },
  { href: "/monitoreo/aperturas-cierres", label: "Aperturas y cierres", permission: "monitoreo.operacion" },
  { href: "/monitoreo/eventos", label: "Eventos", permission: "monitoreo.operacion" },
  { href: "/monitoreo/pilas", label: "Pilas", permission: "monitoreo.operacion" },
  { href: "/monitoreo/informe-semanal", label: "Informe semanal", permission: "monitoreo.registros" },
  { href: "/monitoreo/mantenimientos", label: "Mantenimientos", permission: "monitoreo.mantenimientos" },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function MonitoreoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  return (
    <>
      <Topbar title="Monitoreo" />
      <ModuleSubnav
        ariaLabel="Secciones de monitoreo"
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
