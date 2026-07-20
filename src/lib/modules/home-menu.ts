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
  ClipboardCheck,
  FolderOpen,
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
    accent: "bg-white",
    tile: "",
  },
  {
    id: "facturacion",
    label: "Facturación y cobro",
    description: "Facturación mensual y cuentas por cobrar",
    href: "/facturacion",
    icon: Receipt,
    permissionTileId: "facturacion_cobro",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "gastos",
    label: "Gastos",
    description: "Registro y aprobaciones de gastos",
    href: "/expenses",
    icon: DollarSign,
    permissionTileId: "gastos",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "disciplinario",
    label: "Disciplinario",
    description: "Apercibimientos y tratamientos",
    href: "/disciplinario",
    icon: AlertTriangle,
    permissionTileId: "disciplinario",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "empleados",
    label: "Empleados",
    description: "Directorio RRHH y contratos",
    href: "/empleados",
    icon: UserCircle,
    permissionTileId: "empleados",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "inventario",
    label: "Inventario",
    description: "Activos y asignación a contratos",
    href: "/inventory",
    icon: Package,
    permissionTileId: "inventario",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "naf_operaciones",
    label: "Operaciones NAF",
    description: "Roles, programación y asistencia OP",
    href: "/naf-operaciones",
    icon: ClipboardCheck,
    permissionTileId: "naf_operaciones",
    moduleId: "nafOperaciones",
    accent: "bg-white",
    tile: "",
  },

  {
    id: "sig",
    label: "SIG",
    description: "Documentos, procesos y aprobaciones",
    href: "/sig",
    icon: FolderKanban,
    permissionTileId: "sig",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "ventas",
    label: "Ventas",
    description: "Oportunidades y presupuestos",
    href: "/ventas",
    icon: TrendingUp,
    permissionTileId: "ventas",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "facturacion_electronica",
    label: "Fact. electrónica",
    description: "Comprobantes FE y configuración ATV",
    href: "/facturacion-electronica",
    icon: FileSpreadsheet,
    permissionTileId: "facturacion_electronica",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "tickets_ti",
    label: "Tickets TI",
    description: "Mesa de ayuda y reportes",
    href: "/tickets-ti",
    icon: Headphones,
    permissionTileId: "tickets_ti",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "formularios",
    label: "Formularios",
    description: "Encuestas y checklists",
    href: "/formularios",
    icon: ClipboardList,
    permissionTileId: "formularios",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "expediente_digital",
    label: "Expediente digital",
    description: "Documentos por cédula (NAF)",
    href: "/expediente-digital",
    icon: FolderOpen,
    permissionTileId: "expediente_digital",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "empleados_naf",
    label: "Empleados NAF",
    description: "Directorio Oracle NAF",
    href: "/empleados-naf",
    icon: UsersRound,
    permissionTileId: "empleados_naf",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "monitoreo",
    label: "Monitoreo",
    description: "Alarmas, pilas e informes diarios",
    href: "/monitoreo",
    icon: Bell,
    permissionTileId: "monitoreo",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "recorridos",
    label: "Recorridos",
    description: "Rutas, NFC y dispositivos",
    href: "/recorridos",
    icon: MapPinned,
    permissionTileId: "recorridos",
    accent: "bg-white",
    tile: "",
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    description: "Usuarios, roles y configuración",
    href: "/admin/roles",
    icon: Settings2,
    permissionTileId: "mantenimiento",
    accent: "bg-white",
    tile: "",
  },
];
