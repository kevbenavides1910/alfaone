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
    href: "/sig/documentos/importar",
    label: "Carga masiva",
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
    href: "/sig/requisitos",
    label: "Requisitos",
    permission: "sig.requisitos",
    isActive: (p) => p.startsWith("/sig/requisitos"),
  },
  {
    href: "/sig/evidencias",
    label: "Evidencias",
    permission: "sig.evidencias",
    isActive: (p) => p.startsWith("/sig/evidencias"),
  },
  {
    href: "/sig/auditorias",
    label: "Auditorías",
    permission: "sig.auditorias",
    isActive: (p) => p.startsWith("/sig/auditorias") || p.startsWith("/audits/"),
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
