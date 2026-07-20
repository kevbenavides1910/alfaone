import type { Session } from "next-auth";
import {
  getSessionPermissions,
  hasPermission,
} from "@/lib/permissions/check";
import {
  levelMeets,
  type PermissionKey,
  type PermissionLevelId,
} from "@/lib/permissions/registry";

/** Pestañas del detalle de contrato (`/contracts/[id]`). */
export const CONTRACT_TAB_IDS = [
  "overview",
  "locations",
  "assets",
  "billing",
  "demand_billing",
  "billing_requirements",
  "administrations",
  "client_contacts",
  "periods",
  "expenses",
] as const;

export type ContractTabId = (typeof CONTRACT_TAB_IDS)[number];

export type ContractTabDef = {
  id: ContractTabId;
  /** Valor del TabsTrigger en la UI. */
  uiValue: string;
  label: string;
  permissionKey: PermissionKey;
};

export const CONTRACT_TABS: ContractTabDef[] = [
  {
    id: "overview",
    uiValue: "overview",
    label: "Resumen",
    permissionKey: "presupuestos.contracts_overview",
  },
  {
    id: "locations",
    uiValue: "locations",
    label: "Ubicaciones",
    permissionKey: "presupuestos.contracts_locations",
  },
  {
    id: "assets",
    uiValue: "assets",
    label: "Activos",
    permissionKey: "presupuestos.contracts_assets",
  },
  {
    id: "billing",
    uiValue: "billing",
    label: "Registro de venta",
    permissionKey: "presupuestos.contracts_billing",
  },
  {
    id: "demand_billing",
    uiValue: "demand-billing",
    label: "Facturación por demanda",
    permissionKey: "presupuestos.contracts_demand_billing",
  },
  {
    id: "billing_requirements",
    uiValue: "billing-requirements",
    label: "Requisitos de facturación",
    permissionKey: "presupuestos.contracts_billing_requirements",
  },
  {
    id: "administrations",
    uiValue: "administrations",
    label: "Administraciones",
    permissionKey: "presupuestos.contracts_administrations",
  },
  {
    id: "client_contacts",
    uiValue: "client-contacts",
    label: "Contacto del cliente",
    permissionKey: "presupuestos.contracts_client_contacts",
  },
  {
    id: "periods",
    uiValue: "periods",
    label: "Prórrogas",
    permissionKey: "presupuestos.contracts_periods",
  },
  {
    id: "expenses",
    uiValue: "expenses",
    label: "Todos los gastos",
    permissionKey: "presupuestos.contracts_expenses",
  },
];

export const CONTRACT_TAB_BY_ID = Object.fromEntries(
  CONTRACT_TABS.map((tab) => [tab.id, tab])
) as Record<ContractTabId, ContractTabDef>;

export const CONTRACT_TAB_PERMISSION_KEYS = CONTRACT_TABS.map(
  (tab) => tab.permissionKey
);

function effectiveTabLevel(
  session: Session | null,
  tab: ContractTabId
): PermissionLevelId {
  const tabKey = CONTRACT_TAB_BY_ID[tab].permissionKey;
  const perms = getSessionPermissions(session);
  return perms[tabKey] ?? "none";
}

/** Ver pestaña: requiere permiso explícito de la pestaña (sin herencia de presupuestos.contracts). */
export function canViewContractTab(
  session: Session | null | undefined,
  tab: ContractTabId
): boolean {
  const s = session ?? null;
  if (levelMeets(effectiveTabLevel(s, tab), "view")) return true;
  if (tab === "expenses") return hasPermission(s, "gastos.expenses", "view");
  return false;
}

/** Editar contenido de la pestaña (no incluye crear/eliminar el contrato). */
export function canEditContractTab(
  session: Session | null | undefined,
  tab: ContractTabId
): boolean {
  const s = session ?? null;
  if (levelMeets(effectiveTabLevel(s, tab), "edit")) return true;
  if (tab === "expenses") return hasPermission(s, "gastos.expenses", "edit");
  if (tab === "assets") return hasPermission(s, "inventario.assets", "edit");
  return false;
}

/** Acceso al listado de puestos (usado también desde gastos). */
export function canViewContractPositions(
  session: Session | null | undefined
): boolean {
  const s = session ?? null;
  return (
    canViewContractTab(s, "locations") ||
    hasPermission(s, "gastos.expenses", "view")
  );
}

/** Admin en pestaña (p. ej. eliminar registros sensibles de la sección). */
export function canAdminContractTab(
  session: Session | null | undefined,
  tab: ContractTabId
): boolean {
  return levelMeets(effectiveTabLevel(session ?? null, tab), "admin");
}
