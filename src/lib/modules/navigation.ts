import type { LucideIcon } from "lucide-react";
import {
  LayoutGrid,
  LayoutDashboard,
  FileText,
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Users,
  BookOpen,
  ClipboardCheck,
  Package,
  AlertTriangle,
  History,
  UserCircle,
  FolderKanban,
  Bell,
} from "lucide-react";
import type { AppModuleId } from "./types";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleId: AppModuleId;
  /** Solo ADMIN (ítems de plataforma sensibles). */
  adminOnly?: boolean;
  isActive?: (pathname: string, href: string) => boolean;
};

/** Fuente única del menú lateral; filtrar con canAccessModule + adminOnly. */
export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/home", label: "Inicio", icon: LayoutGrid, moduleId: "core" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleId: "core" },
  { href: "/contracts", label: "Contratos", icon: FileText, moduleId: "alfa-one" },
  {
    href: "/facturacion",
    label: "Facturación y cobro",
    icon: Receipt,
    moduleId: "facturacion",
    isActive: (p) => p.startsWith("/facturacion") || p.startsWith("/cuentas-por-cobrar"),
  },
  { href: "/expenses", label: "Gastos", icon: DollarSign, moduleId: "alfa-one" },
  {
    href: "/expenses/pending-approvals",
    label: "Aprobaciones",
    icon: ClipboardCheck,
    moduleId: "alfa-one",
  },
  {
    href: "/expenses/approval-bitacora",
    label: "Bitácora aprobaciones",
    icon: History,
    moduleId: "alfa-one",
  },
  { href: "/inventory", label: "Inventario", icon: Package, moduleId: "inventario" },
  {
    href: "/disciplinario/importar",
    label: "Disciplinario",
    icon: AlertTriangle,
    moduleId: "disciplinario",
    isActive: (p) => p.startsWith("/disciplinario"),
  },
  {
    href: "/empleados",
    label: "Empleados",
    icon: UserCircle,
    moduleId: "empleados",
    isActive: (p) => p.startsWith("/empleados"),
  },
  {
    href: "/sig",
    label: "SIG",
    icon: FolderKanban,
    moduleId: "sig",
    isActive: (p) => p.startsWith("/sig"),
  },
  {
    href: "/bandeco",
    label: "Monitoreo Bandeco",
    icon: Bell,
    moduleId: "bandeco",
    isActive: (p) => p.startsWith("/bandeco"),
  },
  { href: "/reports/annual", label: "Reporte Anual", icon: TrendingUp, moduleId: "reportes" },
  { href: "/reports", label: "Reporte mensual", icon: BarChart3, moduleId: "reportes" },
  { href: "/admin/users", label: "Usuarios", icon: Users, moduleId: "plataforma", adminOnly: true },
  {
    href: "/admin/catalogs",
    label: "Mantenimientos",
    icon: BookOpen,
    moduleId: "plataforma",
    adminOnly: true,
  },
];

