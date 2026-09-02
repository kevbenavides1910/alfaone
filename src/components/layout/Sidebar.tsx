"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Shield, X, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  APP_BRANDING_QUERY_KEY,
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_PRIMARY_HEX,
  DEFAULT_SIDEBAR_HEX,
} from "@/modules/plataforma/branding-constants";
import { SIDEBAR_NAV_ITEMS, type SidebarNavItem } from "@/lib/modules/navigation";
import { canAccessModule } from "@/lib/modules/access";
import { hasPermission, isPlatformAdmin } from "@/lib/permissions/check";

/* ── Grupos de navegación ── */
type GroupDef = { id: string; label: string; hrefs: string[] };

const NAV_GROUPS: GroupDef[] = [
  {
    id: "gestion",
    label: "Gestión",
    hrefs: ["/contracts", "/facturacion", "/expenses", "/expenses/pending-approvals", "/expenses/approval-bitacora"],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    hrefs: ["/inventory", "/disciplinario/importar", "/empleados", "/finger-system", "/solicitudes-rrhh/ajustes", "/sig", "/ventas"],
  },
  {
    id: "digital",
    label: "Digital",
    hrefs: ["/facturacion-electronica", "/tickets-ti", "/formularios", "/empleados-naf", "/naf-operaciones", "/monitoreo", "/recorridos"],
  },
  {
    id: "reportes",
    label: "Reportes",
    hrefs: ["/reports/annual", "/reports"],
  },
  {
    id: "admin",
    label: "Admin",
    hrefs: ["/admin/users", "/admin/catalogs"],
  },
];

const TOP_HREFS = new Set(["/home", "/dashboard"]);
const STORAGE_KEY = "alfa-one:sidebar-groups";

/* ── Helpers ── */
function itemIsActive(item: SidebarNavItem, pathname: string): boolean {
  if (item.isActive) return item.isActive(pathname, item.href);
  return pathname === item.href ||
    (item.href !== "/dashboard" && item.href !== "/home" && pathname.startsWith(item.href));
}

function groupContainsActive(group: GroupDef, items: SidebarNavItem[], pathname: string): boolean {
  return items.some(i => group.hrefs.includes(i.href) && itemIsActive(i, pathname));
}

interface Props {
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ collapsed, onToggle, onClose, isMobile }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();

  /* ── Branding ── */
  const { data: brand } = useQuery({
    queryKey: APP_BRANDING_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/branding");
      const j = (await r.json()) as {
        data?: { primaryHex: string; sidebarHex: string; hasLogo: boolean; updatedAt: string };
      };
      if (!r.ok || !j.data)
        return { primaryHex: DEFAULT_PRIMARY_HEX, sidebarHex: DEFAULT_SIDEBAR_HEX, hasLogo: false, updatedAt: "" };
      return j.data;
    },
    staleTime: 30_000,
  });

  const primary = brand?.primaryHex ?? DEFAULT_PRIMARY_HEX;
  const sidebarBg = brand?.sidebarHex ?? DEFAULT_SIDEBAR_HEX;
  const logoSrc =
    brand?.hasLogo && brand.updatedAt
      ? `/api/branding/logo?${encodeURIComponent(brand.updatedAt)}`
      : null;

  /* ── Items filtrados por permisos ── */
  const allItems = SIDEBAR_NAV_ITEMS.filter((item) => {
    if (!session) return false;
    if (item.adminOnly && !isPlatformAdmin(session)) return false;
    if (item.href === "/facturacion") return canAccessModule(session, "facturacion");
    if (item.href === "/contracts") return hasPermission(session, "presupuestos.contracts", "view");
    return canAccessModule(session, item.moduleId);
  });

  const topItems = allItems.filter(i => TOP_HREFS.has(i.href));

  /* ── Estado de grupos (acordeón) ── */
  const getInitialOpen = (): Record<string, boolean> => {
    const defaults: Record<string, boolean> = {};
    NAV_GROUPS.forEach(g => { defaults[g.id] = false; });
    return defaults;
  };

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpen);

  // Cargar desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOpenGroups(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Auto-abrir el grupo que contiene el ítem activo
  useEffect(() => {
    NAV_GROUPS.forEach(group => {
      if (groupContainsActive(group, allItems, pathname)) {
        setOpenGroups(prev => {
          if (prev[group.id]) return prev; // ya está abierto
          const next = { ...prev, [group.id]: true };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleNav = () => { if (isMobile && onClose) onClose(); };

  /* ── NavLink ── */
  const NavLink = ({ item, indent = false }: { item: SidebarNavItem; indent?: boolean }) => {
    const active = itemIsActive(item, pathname);
    return (
      <Link
        href={item.href}
        onClick={handleNav}
        className={cn(
          "flex items-center rounded-lg text-sm font-medium transition-all duration-150",
          collapsed && !isMobile
            ? "justify-center px-0 py-2.5 w-full"
            : cn("gap-2.5 px-2.5 py-2", indent && "ml-2 pl-2.5 border-l border-white/8"),
          active
            ? "text-white shadow-sm"
            : "text-white/55 hover:bg-white/[0.07] hover:text-white/95"
        )}
        style={active ? { backgroundColor: primary } : undefined}
        title={collapsed && !isMobile ? item.label : undefined}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {(!collapsed || isMobile) && (
          <span className="truncate leading-none">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full text-white transition-all duration-300 ease-in-out overflow-hidden",
        !isMobile && (collapsed ? "w-14" : "w-60")
      )}
      style={{ backgroundColor: sidebarBg }}
    >
      {/* ── Header: logo + colapsar ── */}
      <div
        className={cn(
          "flex items-center border-b border-white/8 h-14 shrink-0 gap-1.5",
          collapsed && !isMobile ? "justify-center px-2" : "px-2.5"
        )}
      >
        <Link
          href="/home"
          onClick={handleNav}
          className={cn(
            "flex items-center gap-2.5 flex-1 min-w-0 rounded-lg py-1.5 px-1 transition-colors hover:bg-white/8",
            collapsed && !isMobile && "justify-center"
          )}
          title={APP_NAME}
        >
          <div
            className="rounded-lg p-1.5 shrink-0 flex items-center justify-center w-8 h-8"
            style={{ backgroundColor: primary }}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={APP_NAME} className="max-h-6 max-w-6 object-contain" />
            ) : (
              <Shield className="h-4 w-4 text-white" />
            )}
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="font-bold text-sm leading-tight truncate">{APP_NAME}</div>
              <div className="text-[10px] text-white/35 truncate leading-tight">{APP_TAGLINE}</div>
            </div>
          )}
        </Link>

        {/* Colapsar — desktop */}
        {!isMobile && onToggle && (
          <button
            onClick={onToggle}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-colors"
            title={collapsed ? "Expandir" : "Colapsar"}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />
            }
          </button>
        )}

        {/* Cerrar — mobile */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ── Navegación ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-2 px-2 space-y-0.5">

        {/* Ítems superiores sin grupo (Inicio, Dashboard) */}
        {topItems.map(item => <NavLink key={item.href} item={item} />)}

        {/* Separador */}
        {topItems.length > 0 && (
          <div className="my-1.5 border-t border-white/6" />
        )}

        {/* Grupos acordeón */}
        {NAV_GROUPS.map(group => {
          const groupItems = allItems.filter(i => group.hrefs.includes(i.href));
          if (groupItems.length === 0) return null;

          const isOpen = openGroups[group.id] ?? false;
          const hasActive = groupContainsActive(group, groupItems, pathname);

          // En modo colapsado (solo íconos): mostrar items directamente sin cabecera
          if (collapsed && !isMobile) {
            return (
              <div key={group.id} className="space-y-0.5 py-1 border-t border-white/6">
                {groupItems.map(item => <NavLink key={item.href} item={item} />)}
              </div>
            );
          }

          return (
            <div key={group.id} className="mt-0.5">
              {/* Cabecera del grupo */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors",
                  hasActive
                    ? "text-white/80"
                    : "text-white/25 hover:text-white/50",
                  "hover:bg-white/5"
                )}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 opacity-60",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {/* Items del grupo */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200 ease-in-out",
                  isOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="pt-0.5 pb-1 space-y-0.5">
                  {groupItems.map(item => (
                    <NavLink key={item.href} item={item} indent />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Usuario ── */}
      <div
        className={cn(
          "shrink-0 border-t border-white/8 px-2.5 py-2.5",
          collapsed && !isMobile ? "flex justify-center" : ""
        )}
      >
        <div className={cn("flex items-center gap-2.5", collapsed && !isMobile && "justify-center")}>
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: primary }}
          >
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          {(!collapsed || isMobile) && (
            <div className="overflow-hidden min-w-0">
              <div className="text-xs font-medium truncate leading-tight text-white/80">
                {session?.user?.name}
              </div>
              <div className="text-[10px] text-white/35 truncate leading-tight">
                {session?.user?.roleCode ?? session?.user?.role}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
