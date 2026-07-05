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
    accent: "bg-red-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-red-600 hover:shadow-lg hover:border-t-red-700",
  },
  {
    id: "facturacion",
    label: "Facturación y cobro",
    description: "Facturación mensual, cuentas por cobrar y cierre por contrato",
    href: "/facturacion",
    icon: Receipt,
    permissionTileId: "facturacion_cobro",
    accent: "bg-slate-700",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-700 hover:shadow-lg hover:border-t-slate-800",
  },
  {
    id: "gastos",
    label: "Gastos",
    description: "Registro, aprobaciones y distribución de gastos",
    href: "/expenses",
    icon: DollarSign,
    permissionTileId: "gastos",
    accent: "bg-slate-700",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-700 hover:shadow-lg hover:border-t-slate-800",
  },
  {
    id: "disciplinario",
    label: "Disciplinario",
    description: "Apercibimientos, tratamientos y reportes",
    href: "/disciplinario",
    icon: AlertTriangle,
    permissionTileId: "disciplinario",
    accent: "bg-red-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-red-600 hover:shadow-lg hover:border-t-red-700",
  },
  {
    id: "empleados",
    label: "Empleados",
    description: "Directorio RRHH, contratos, ubicaciones y cuentas",
    href: "/empleados",
    icon: UserCircle,
    permissionTileId: "empleados",
    accent: "bg-slate-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-600 hover:shadow-lg hover:border-t-slate-700",
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Activos, movimientos y asignación a contratos",
    href: "/inventory",
    icon: Package,
    permissionTileId: "inventario",
    accent: "bg-slate-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-600 hover:shadow-lg hover:border-t-slate-700",
  },
  {
    id: "sig",
    label: "SIG",
    description: "Documentos, procesos, versiones y aprobaciones",
    href: "/sig",
    icon: FolderKanban,
    permissionTileId: "sig",
    accent: "bg-slate-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-600 hover:shadow-lg hover:border-t-slate-700",
  },
  {
    id: "ventas",
    label: "Ventas",
    description: "Oportunidades comerciales y presupuestos de licitación",
    href: "/ventas",
    icon: TrendingUp,
    permissionTileId: "ventas",
    accent: "bg-slate-700",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-700 hover:shadow-lg hover:border-t-slate-800",
  },
  {
    id: "facturacion_electronica",
    label: "Facturación electrónica",
    description: "Comprobantes FE, recibidos, compras y configuración ATV",
    href: "/facturacion-electronica",
    icon: FileSpreadsheet,
    permissionTileId: "facturacion_electronica",
    accent: "bg-slate-700",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-700 hover:shadow-lg hover:border-t-slate-800",
  },
  {
    id: "tickets_ti",
    label: "Tickets TI",
    description: "Centro de servicio, mesa de ayuda y reportes",
    href: "/tickets-ti",
    icon: Headphones,
    permissionTileId: "tickets_ti",
    accent: "bg-red-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-red-600 hover:shadow-lg hover:border-t-red-700",
  },
  {
    id: "formularios",
    label: "Formularios",
    description: "Encuestas, checklists y resultados de respuestas",
    href: "/formularios",
    icon: ClipboardList,
    permissionTileId: "formularios",
    accent: "bg-slate-500",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-500 hover:shadow-lg hover:border-t-slate-600",
  },
  {
    id: "empleados_naf",
    label: "Empleados NAF",
    description: "Directorio Oracle NAF y sincronización",
    href: "/empleados-naf",
    icon: UsersRound,
    permissionTileId: "empleados_naf",
    accent: "bg-slate-600",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-600 hover:shadow-lg hover:border-t-slate-700",
  },
  {
    id: "bandeco",
    label: "Monitoreo Bandeco",
    description: "Alarmas Del Monte: consulta, activaciones, aperturas y catálogos",
    href: "/bandeco",
    icon: Bell,
    permissionTileId: "bandeco",
    accent: "bg-slate-500",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-500 hover:shadow-lg hover:border-t-slate-600",
  },
  {
    id: "recorridos",
    label: "Recorrido de marcas",
    description: "App Alfa One: rutas, puntos NFC, horarios y dispositivos",
    href: "/recorridos",
    icon: MapPinned,
    permissionTileId: "recorridos",
    accent: "bg-slate-500",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-500 hover:shadow-lg hover:border-t-slate-600",
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    description: "Usuarios, roles, catálogos y configuración",
    href: "/admin/roles",
    icon: Settings2,
    permissionTileId: "mantenimiento",
    accent: "bg-slate-400",
    tile: "bg-white border border-slate-200 border-t-4 border-t-slate-400 hover:shadow-lg hover:border-t-slate-500",
  },
];
