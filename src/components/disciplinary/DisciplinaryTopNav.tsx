"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import {
  Upload,
  History,
  Users,
  FileText,
  LayoutDashboard,
  AlertTriangle,
  Database,
  FileType,
  Cog,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { hasPermission } from "@/lib/permissions/check";
import type { PermissionKey } from "@/lib/permissions/registry";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
  isActive?: (pathname: string) => boolean;
};

const MAIN_NAV: NavItem[] = [
  { href: "/disciplinario/importar", label: "Importación", icon: Upload, permission: "disciplinario.import" },
  {
    href: "/disciplinario",
    label: "Historial",
    icon: History,
    permission: "disciplinario.historial",
    isActive: (p) => p === "/disciplinario",
  },
  { href: "/disciplinario/empleados", label: "Tratamiento", icon: Users, permission: "disciplinario.empleados" },
  { href: "/disciplinario/convocatoria", label: "Convocatoria", icon: FileText, permission: "disciplinario.convocatoria" },
  { href: "/disciplinario/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "disciplinario.dashboard" },
  { href: "/disciplinario/reportes/omisiones", label: "Omisiones", icon: AlertTriangle, permission: "disciplinario.omisiones" },
];

const AJUSTES_NAV: NavItem[] = [
  { href: "/disciplinario/ajustes/bases", label: "Bases", icon: Database, permission: "disciplinario.ajustes" },
  { href: "/disciplinario/ajustes/documento", label: "Documento", icon: FileType, permission: "disciplinario.ajustes" },
  { href: "/disciplinario/ajustes/configuracion", label: "Config.", icon: Cog, permission: "disciplinario.ajustes" },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.isActive) return item.isActive(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DisciplinaryTopNav() {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();

  const mainItems = MAIN_NAV.filter((item) =>
    hasPermission(session, item.permission, "view")
  );
  const ajustesItems = AJUSTES_NAV.filter((item) =>
    hasPermission(session, item.permission, "view")
  );

  if (mainItems.length === 0 && ajustesItems.length === 0) return null;

  const inAjustes = pathname.startsWith("/disciplinario/ajustes");

  return (
    <div className="sticky top-14 lg:top-16 z-10 border-b border-[#2a2a2a] bg-[#111111]">
      <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
        {mainItems.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150",
                active
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {ajustesItems.length > 0 && (
          <>
            <div className="mx-1.5 h-4 w-px bg-white/15 shrink-0" />
            <div className="flex items-center gap-1 text-white/30 px-1.5 shrink-0">
              <Settings2 className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wider">Ajustes</span>
            </div>
            {ajustesItems.map((item) => {
              const active = isActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150",
                    active
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
