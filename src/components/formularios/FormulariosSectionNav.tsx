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
    href: "/formularios",
    label: "Catálogo",
    permission: "formularios.catalogo",
    isActive: (p) => p === "/formularios",
  },
  { href: "/formularios/nuevo", label: "Nuevo formulario", permission: "formularios.editor" },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function FormulariosSectionNav() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();
  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  return (
    <ModuleSubnav
      ariaLabel="Secciones Formularios"
      tabs={visibleTabs.map((tab) => ({
        href: tab.href,
        label: tab.label,
        active: tabActive(tab, pathname),
      }))}
    />
  );
}
