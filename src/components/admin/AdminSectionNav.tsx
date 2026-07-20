"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryTab } from "@/lib/hooks/use-query-tab";
import { useSession } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils/cn";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";

type Tab = {
  href: string;
  label: string;
  permission?: PermissionKey;
  isActive?: (pathname: string, tabParam: string | null) => boolean;
};

const TABS: Tab[] = [
  { href: "/admin/roles", label: "Roles", permission: "plataforma.roles" },
  { href: "/admin/users", label: "Usuarios", permission: "plataforma.users" },
  {
    href: "/admin/catalogs",
    label: "Catálogos",
    permission: "plataforma.catalogs",
    isActive: (p, tab) =>
      p === "/admin/catalogs" || (p.startsWith("/admin/catalogs") && tab !== "approvals"),
  },
  {
    href: "/admin/catalogs?tab=approvals",
    label: "Aprobaciones",
    permission: "plataforma.approvals_config",
    isActive: (_p, tab) => tab === "approvals",
  },
];

function tabActive(tab: Tab, pathname: string, tabParam: string | null): boolean {
  if (tab.isActive) return tab.isActive(pathname, tabParam);
  const base = tab.href.split("?")[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AdminSectionNav() {
  const pathname = usePathname() ?? "";
  const tabParam = useQueryTab();
  const { data: session, status } = useSession();

  const visibleTabs = TABS.filter((tab) => {
    if (status === "loading") return false;
    if (tab.permission) {
      return hasPermission(session, tab.permission, "view");
    }
    return isPlatformAdmin(session);
  });

  return (
    <div className="border-b border-[#2a2a2a] bg-[#111111] text-white">
      <div className="flex flex-wrap gap-1 px-2 py-2 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
              tabActive(tab, pathname, tabParam)
                ? "bg-red-600 text-white shadow-sm"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
