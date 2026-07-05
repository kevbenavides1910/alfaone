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
    description: "Licitaciones, clientes y presupuestos",
    href: "/contracts",
    icon: FileText,
    permissionTileId: "contratos",
    requiredPermission: "presupuestos.contracts",
    accent: "bg-red-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "facturacion",
    label: "Facturación y cobro",
    description: "Facturación mensual y cuentas por cobrar",
    href: "/facturacion",
    icon: Receipt,
    permissionTileId: "facturacion_cobro",
    accent: "bg-emerald-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "gastos",
    label: "Gastos",
    description: "Registro y aprobaciones de gastos",
    href: "/expenses",
    icon: DollarSign,
    permissionTileId: "gastos",
    accent: "bg-amber-500",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "disciplinario",
    label: "Disciplinario",
    description: "Apercibimientos y tratamientos",
    href: "/disciplinario",
    icon: AlertTriangle,
    permissionTileId: "disciplinario",
    accent: "bg-red-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "empleados",
    label: "Empleados",
    description: "Directorio RRHH y contratos",
    href: "/empleados",
    icon: UserCircle,
    permissionTileId: "empleados",
    accent: "bg-indigo-500",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Activos y asignación a contratos",
    href: "/inventory",
    icon: Package,
    permissionTileId: "inventario",
    accent: "bg-sky-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "sig",
    label: "SIG",
    description: "Documentos, procesos y aprobaciones",
    href: "/sig",
    icon: FolderKanban,
    permissionTileId: "sig",
    accent: "bg-teal-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "ventas",
    label: "Ventas",
    description: "Oportunidades y presupuestos",
    href: "/ventas",
    icon: TrendingUp,
    permissionTileId: "ventas",
    accent: "bg-blue-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "facturacion_electronica",
    label: "Fact. electrónica",
    description: "Comprobantes FE y configuración ATV",
    href: "/facturacion-electronica",
    icon: FileSpreadsheet,
    permissionTileId: "facturacion_electronica",
    accent: "bg-pink-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "tickets_ti",
    label: "Tickets TI",
    description: "Mesa de ayuda y reportes",
    href: "/tickets-ti",
    icon: Headphones,
    permissionTileId: "tickets_ti",
    accent: "bg-cyan-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "formularios",
    label: "Formularios",
    description: "Encuestas y checklists",
    href: "/formularios",
    icon: ClipboardList,
    permissionTileId: "formularios",
    accent: "bg-violet-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "empleados_naf",
    label: "Empleados NAF",
    description: "Directorio Oracle NAF",
    href: "/empleados-naf",
    icon: UsersRound,
    permissionTileId: "empleados_naf",
    accent: "bg-violet-700",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "bandeco",
    label: "Bandeco",
    description: "Alarmas Del Monte y catálogos",
    href: "/bandeco",
    icon: Bell,
    permissionTileId: "bandeco",
    accent: "bg-orange-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "recorridos",
    label: "Recorridos",
    description: "Rutas, NFC y dispositivos",
    href: "/recorridos",
    icon: MapPinned,
    permissionTileId: "recorridos",
    accent: "bg-rose-600",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    description: "Usuarios, roles y configuración",
    href: "/admin/roles",
    icon: Settings2,
    permissionTileId: "mantenimiento",
    accent: "bg-slate-500",
    tile: "bg-[#1c1c1e] hover:bg-[#242426]",
  },
];
