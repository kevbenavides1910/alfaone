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
    tile: "from-violet-200/80 to-violet-100/90 border-violet-300/60 hover:border-violet-400",
  },
  {
    id: "facturacion",
    label: "Facturación y cobro",
    description: "Facturación mensual, cuentas por cobrar y cierre por contrato",
    href: "/facturacion",
    icon: Receipt,
    permissionTileId: "facturacion_cobro",
    accent: "bg-fuchsia-600",
    tile: "from-fuchsia-200/80 to-fuchsia-100/90 border-fuchsia-300/60 hover:border-fuchsia-400",
  },
  {
    id: "gastos",
    label: "Gastos",
    description: "Registro, aprobaciones y distribución de gastos",
    href: "/expenses",
    icon: DollarSign,
    permissionTileId: "gastos",
    accent: "bg-emerald-600",
    tile: "from-emerald-200/75 to-emerald-100/90 border-emerald-300/60 hover:border-emerald-400",
  },
  {
    id: "disciplinario",
    label: "Disciplinario",
    description: "Apercibimientos, tratamientos y reportes",
    href: "/disciplinario",
    icon: AlertTriangle,
    permissionTileId: "disciplinario",
    accent: "bg-amber-600",
    tile: "from-amber-200/80 to-amber-100/90 border-amber-300/60 hover:border-amber-400",
  },
  {
    id: "empleados",
    label: "Empleados",
    description: "Directorio RRHH, contratos, ubicaciones y cuentas",
    href: "/empleados",
    icon: UserCircle,
    permissionTileId: "empleados",
    accent: "bg-indigo-600",
    tile: "from-indigo-200/80 to-indigo-100/90 border-indigo-300/60 hover:border-indigo-400",
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Activos, movimientos y asignación a contratos",
    href: "/inventory",
    icon: Package,
    permissionTileId: "inventario",
    accent: "bg-sky-600",
    tile: "from-sky-200/80 to-sky-100/90 border-sky-300/60 hover:border-sky-400",
  },
  {
    id: "sig",
    label: "SIG",
    description: "Documentos, procesos, versiones y aprobaciones",
    href: "/sig",
    icon: FolderKanban,
    permissionTileId: "sig",
    accent: "bg-teal-600",
    tile: "from-teal-200/75 to-teal-100/90 border-teal-300/60 hover:border-teal-400",
  },
  {
    id: "recorridos",
    label: "Recorrido de marcas",
    description: "App SYNTRA: rutas, puntos NFC, horarios y dispositivos",
    href: "/recorridos",
    icon: MapPinned,
    permissionTileId: "recorridos",
    accent: "bg-rose-600",
    tile: "from-rose-200/80 to-rose-100/90 border-rose-300/60 hover:border-rose-400",
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    description: "Usuarios, roles, catálogos y configuración",
    href: "/admin/roles",
    icon: Settings2,
    permissionTileId: "mantenimiento",
    accent: "bg-slate-600",
    tile: "from-slate-200/90 to-slate-100/95 border-slate-300/70 hover:border-slate-400",
  },
];
