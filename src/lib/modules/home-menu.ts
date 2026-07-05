import type { LucideIcon } from "lucide-react";
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Package,
  Settings2,
  UserCircle,
  FolderKanban,
  MapPinned,
  Receipt,
  Bell,
  TrendingUp,
  FileSpreadsheet,
  Headphones,
  ClipboardList,
  UsersRound,
} from "lucide-react";
import type { AppModuleId } from "./types";
import type { PermissionKey } from "@/lib/permissions/registry";

export type HomeModuleTile = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Grupo de permisos en registry (tileId en HOME_MODULE_PERMISSION_GROUPS). */
  permissionTileId: string;
  /** Si se define, exige este permiso concreto (view) en lugar del grupo. */
  requiredPermission?: PermissionKey;
  /** Acceso por módulo (cualquier pantalla del módulo con view). */
  moduleId?: AppModuleId;
  accent: string;
  tile: string;
};

export const HOME_MODULE_TILES: HomeModuleTile[] = [
  {
    id: "contratos",
    label: "Contratos",
    description: "Licitaciones, clientes y presupuestos por contrato",
    href: "/contracts",
    icon: FileText,
    permissionTileId: "contratos",
    requiredPermission: "presupuestos.contracts",
    accent: "bg-violet-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-violet-500 hover:shadow-lg hover:border-t-violet-600",
  },
  {
    id: "facturacion",
    label: "Facturación y cobro",
    description: "Facturación mensual, cuentas por cobrar y cierre por contrato",
    href: "/facturacion",
    icon: Receipt,
    permissionTileId: "facturacion_cobro",
    accent: "bg-fuchsia-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-fuchsia-500 hover:shadow-lg hover:border-t-fuchsia-600",
  },
  {
    id: "gastos",
    label: "Gastos",
    description: "Registro, aprobaciones y distribución de gastos",
    href: "/expenses",
    icon: DollarSign,
    permissionTileId: "gastos",
    accent: "bg-emerald-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-emerald-500 hover:shadow-lg hover:border-t-emerald-600",
  },
  {
    id: "disciplinario",
    label: "Disciplinario",
    description: "Apercibimientos, tratamientos y reportes",
    href: "/disciplinario",
    icon: AlertTriangle,
    permissionTileId: "disciplinario",
    accent: "bg-amber-500",
    tile: "bg-white border border-slate-200 border-t-4 border-t-amber-500 hover:shadow-lg hover:border-t-amber-600",
  },
  {
    id: "empleados",
    label: "Empleados",
    description: "Directorio RRHH, contratos, ubicaciones y cuentas",
    href: "/empleados",
    icon: UserCircle,
    permissionTileId: "empleados",
    accent: "bg-indigo-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-indigo-500 hover:shadow-lg hover:border-t-indigo-600",
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Activos, movimientos y asignación a contratos",
    href: "/inventory",
    icon: Package,
    permissionTileId: "inventario",
    accent: "bg-sky-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-sky-500 hover:shadow-lg hover:border-t-sky-600",
  },
  {
    id: "sig",
    label: "SIG",
    description: "Documentos, procesos, versiones y aprobaciones",
    href: "/sig",
    icon: FolderKanban,
    permissionTileId: "sig",
    accent: "bg-teal-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-teal-500 hover:shadow-lg hover:border-t-teal-600",
  },
  {
    id: "ventas",
    label: "Ventas",
    description: "Oportunidades comerciales y presupuestos de licitación",
    href: "/ventas",
    icon: TrendingUp,
    permissionTileId: "ventas",
    accent: "bg-blue-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-blue-500 hover:shadow-lg hover:border-t-blue-600",
  },
  {
    id: "facturacion_electronica",
    label: "Facturación electrónica",
    description: "Comprobantes FE, recibidos, compras y configuración ATV",
    href: "/facturacion-electronica",
    icon: FileSpreadsheet,
    permissionTileId: "facturacion_electronica",
    accent: "bg-pink-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-pink-500 hover:shadow-lg hover:border-t-pink-600",
  },
  {
    id: "tickets_ti",
    label: "Tickets TI",
    description: "Centro de servicio, mesa de ayuda y reportes",
    href: "/tickets-ti",
    icon: Headphones,
    permissionTileId: "tickets_ti",
    accent: "bg-cyan-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-cyan-500 hover:shadow-lg hover:border-t-cyan-600",
  },
  {
    id: "formularios",
    label: "Formularios",
    description: "Encuestas, checklists y resultados de respuestas",
    href: "/formularios",
    icon: ClipboardList,
    permissionTileId: "formularios",
    accent: "bg-lime-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-lime-500 hover:shadow-lg hover:border-t-lime-600",
  },
  {
    id: "empleados_naf",
    label: "Empleados NAF",
    description: "Directorio Oracle NAF y sincronización",
    href: "/empleados-naf",
    icon: UsersRound,
    permissionTileId: "empleados_naf",
    accent: "bg-violet-700",
    tile: "bg-white border border-slate-200 border-t-4 border-t-violet-700 hover:shadow-lg hover:border-t-violet-800",
  },
  {
    id: "bandeco",
    label: "Monitoreo Bandeco",
    description: "Alarmas Del Monte: consulta, activaciones, aperturas y catálogos",
    href: "/bandeco",
    icon: Bell,
    permissionTileId: "bandeco",
    accent: "bg-orange-500",
    tile: "bg-white border border-slate-200 border-t-4 border-t-orange-500 hover:shadow-lg hover:border-t-orange-600",
  },
  {
    id: "recorridos",
    label: "Recorrido de marcas",
    description: "App Alfa One: rutas, puntos NFC, horarios y dispositivos",
    href: "/recorridos",
    icon: MapPinned,
    permissionTileId: "recorridos",
    accent: "bg-rose-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-rose-500 hover:shadow-lg hover:border-t-rose-600",
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    description: "Usuarios, roles, catálogos y configuración",
    href: "/admin/roles",
    icon: Settings2,
    permissionTileId: "mantenimiento",
    accent: "bg-slate-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-500 hover:shadow-lg hover:border-t-slate-600",
  },
];
