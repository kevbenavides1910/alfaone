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
  MapPinned,
  FileSpreadsheet,
  Headphones,
  ClipboardList,
  UsersRound,
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
  { href: "/contracts", label: "Contratos", icon: FileText, moduleId: "presupuestos" },
  {
    href: "/facturacion",
    label: "Facturación y cobro",
    icon: Receipt,
    moduleId: "facturacion",
    isActive: (p) =>
      (p.startsWith("/facturacion") && !p.startsWith("/facturacion-electronica")) ||
      p.startsWith("/cuentas-por-cobrar"),
  },
  { href: "/expenses", label: "Gastos", icon: DollarSign, moduleId: "presupuestos" },
  {
    href: "/expenses/pending-approvals",
    label: "Aprobaciones",
    icon: ClipboardCheck,
    moduleId: "presupuestos",
  },
  {
    href: "/expenses/approval-bitacora",
    label: "Bitácora aprobaciones",
    icon: History,
    moduleId: "presupuestos",
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
    isActive: (p) => p.startsWith("/empleados") && !p.startsWith("/empleados-naf"),
  },
  {
    href: "/sig",
    label: "SIG",
    icon: FolderKanban,
    moduleId: "sig",
    isActive: (p) => p.startsWith("/sig"),
  },
  {
    href: "/ventas",
    label: "Ventas",
    icon: TrendingUp,
    moduleId: "ventas",
    isActive: (p) => p.startsWith("/ventas"),
  },
  {
    href: "/facturacion-electronica",
    label: "Facturación electrónica",
    icon: FileSpreadsheet,
    moduleId: "facturacionElectronica",
    isActive: (p) => p.startsWith("/facturacion-electronica"),
  },
  {
    href: "/tickets-ti",
    label: "Tickets TI",
    icon: Headphones,
    moduleId: "ticketsTi",
    isActive: (p) => p.startsWith("/tickets-ti"),
  },
  {
    href: "/formularios",
    label: "Formularios",
    icon: ClipboardList,
    moduleId: "formularios",
    isActive: (p) => p.startsWith("/formularios"),
  },
  {
    href: "/empleados-naf",
    label: "Empleados NAF",
    icon: UsersRound,
    moduleId: "empleadosNaf",
    isActive: (p) => p.startsWith("/empleados-naf"),
  },
  {
    href: "/bandeco",
    label: "Monitoreo Bandeco",
    icon: Bell,
    moduleId: "bandeco",
    isActive: (p) => p.startsWith("/bandeco"),
  },
  {
    href: "/recorridos",
    label: "Recorrido de marcas",
    icon: MapPinned,
    moduleId: "recorridos",
    isActive: (p) => p.startsWith("/recorridos"),
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
