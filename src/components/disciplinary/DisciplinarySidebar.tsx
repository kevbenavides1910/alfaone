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
  Settings2,
  Database,
  FileType,
  Cog,
  ChevronRight,
  ChevronLeft,
  X,
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
  {
    href: "/disciplinario/convocatoria",
    label: "Solicitud de convocatoria",
    icon: FileText,
    permission: "disciplinario.convocatoria",
  },
  {
    href: "/disciplinario/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "disciplinario.dashboard",
  },
  {
    href: "/disciplinario/reportes/omisiones",
    label: "Reporte de omisiones",
    icon: AlertTriangle,
    permission: "disciplinario.omisiones",
  },
];

const AJUSTES_NAV: NavItem[] = [
  {
    href: "/disciplinario/ajustes/bases",
    label: "Bases de datos",
    icon: Database,
    permission: "disciplinario.ajustes",
  },
  {
    href: "/disciplinario/ajustes/documento",
    label: "Documento",
    icon: FileType,
    permission: "disciplinario.ajustes",
  },
  {
    href: "/disciplinario/ajustes/configuracion",
    label: "Configuración",
    icon: Cog,
    permission: "disciplinario.ajustes",
  },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.isActive) return item.isActive(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname, collapsed, onClick }: { item: NavItem; pathname: string; collapsed?: boolean; onClick?: () => void }) {
  const active = isActive(item, pathname);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2" : "",
        active
          ? "bg-red-600/20 text-white shadow-sm"
          : "text-white/70 hover:bg-white/8 hover:text-white"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {active && !collapsed && <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 opacity-60" />}
    </Link>
  );
}

export function DisciplinarySidebar({ open, onClose, collapsed, onToggleCollapse }: { open?: boolean; onClose?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const pathname = usePathname() ?? "";
  const { data: session } = useSession();

  const mainItems = MAIN_NAV.filter((item) =>
    hasPermission(session, item.permission, "view")
  );
  const ajustesItems = AJUSTES_NAV.filter((item) =>
    hasPermission(session, item.permission, "view")
  );
  const inAjustes = pathname.startsWith("/disciplinario/ajustes");
  const showAjustesGroup = ajustesItems.length > 0;

  if (mainItems.length === 0 && !showAjustesGroup) return null;

  const sidebarContent = (
    <>
      <div className={cn("flex items-center justify-between px-4 py-4 border-b border-white/10", collapsed && "px-2 justify-center")}>
        {collapsed ? (
          <h2 className="font-semibold text-xs tracking-tight text-center">D</h2>
        ) : (
          <div>
            <h2 className="font-semibold text-sm tracking-tight">Disciplinario</h2>
            <p className="text-[11px] text-amber-100/70 mt-1 leading-snug">
              Apercibimientos por omisiones de marca
            </p>
          </div>
        )}
        <button onClick={onClose} className="md:hidden text-white/70 hover:text-white p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto p-3 space-y-1", collapsed && "p-2")}>
        {mainItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onClick={onClose} />
        ))}

        {showAjustesGroup && (
          <div className="pt-3 mt-2 border-t border-white/10">
            {collapsed ? null : (
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider",
                  inAjustes ? "text-red-400" : "text-white/40"
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Ajustes
              </div>
            )}
            <div className="mt-1 space-y-0.5 pl-1">
              {ajustesItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} onClick={onClose} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-lg text-xs text-amber-100/70 hover:text-white hover:bg-white/5 transition-colors"
          title={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile sidebar — overlay */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-[#111111] text-white flex flex-col",
          "transform transition-transform duration-200 ease-in-out md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar — static in flow */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 self-stretch transition-all duration-200",
          "bg-[#111111] text-white flex-col border-r border-white/5",
          collapsed ? "w-16" : "w-56 lg:w-60"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
