"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
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
    <div className="border-b border-slate-200 bg-white">
      <div className="flex items-center overflow-x-auto scrollbar-none">
        {mainItems.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium",
                "border-b-2 transition-colors",
                active
                  ? "border-amber-500 text-amber-700 bg-amber-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {ajustesItems.length > 0 && (
          <>
            <div className="mx-2 h-5 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-0.5 text-xs text-slate-400 px-2">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-wider">Ajustes</span>
            </div>
            {ajustesItems.map((item) => {
              const active = isActive(item, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-sm font-medium",
                    "border-b-2 transition-colors",
                    active
                      ? "border-amber-500 text-amber-700 bg-amber-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
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
