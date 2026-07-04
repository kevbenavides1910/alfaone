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
    href: "/sig",
    label: "Biblioteca",
    permission: "sig.biblioteca",
    isActive: (p) =>
      p === "/sig" ||
      (p.startsWith("/sig/documentos/") && !p.startsWith("/sig/documentos/nuevo")),
  },
  {
    href: "/sig/documentos/nuevo",
    label: "Nuevo documento",
    permission: "sig.documentos",
  },
  {
    href: "/sig/aprobaciones",
    label: "Aprobaciones",
    permission: "sig.aprobaciones",
  },
  {
    href: "/sig/bitacora",
    label: "Bitácora",
    permission: "sig.bitacora",
  },
  {
    href: "/sig/procesos",
    label: "Procesos y tipos",
    permission: "sig.procesos",
  },
];

function tabActive(tab: Tab, pathname: string): boolean {
  if (tab.isActive) return tab.isActive(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function SigSectionNav() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();

  const visibleTabs = TABS.filter((tab) => hasPermission(session, tab.permission, "view"));

  if (visibleTabs.length === 0) return null;

  return (
    <div className="border-b border-teal-200/80 bg-teal-800 text-white">
      <div className="flex flex-wrap gap-1 px-2 py-2 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              tabActive(tab, pathname)
                ? "bg-card text-teal-900 shadow-sm"
                : "text-teal-100 hover:bg-card/10 hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
