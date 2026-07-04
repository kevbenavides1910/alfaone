/**
 * Registro canónico de permisos (módulo → pantalla → rutas/APIs).
 * Al añadir una pantalla nueva: registrar aquí y seguir docs/PERMISSIONS.md.
 */
import type { AppModuleId } from "@/lib/modules/types";

export type PermissionLevelId = "none" | "view" | "edit" | "admin";

export type PermissionScreenDef = {
  label: string;
  uiRoutes: string[];
  apiPrefixes?: string[];
  actions: Partial<Record<Exclude<PermissionLevelId, "none">, string>>;
};

export type PermissionModuleDef = {
  label: string;
  moduleId: AppModuleId;
  screens: Record<string, PermissionScreenDef>;
};

export const PERMISSION_REGISTRY = {
  core: {
    label: "Núcleo",
    moduleId: "core" as const,
    screens: {
      home: {
        label: "Inicio",
        uiRoutes: ["/home"],
        actions: { view: "Acceder al menú principal" },
      },
      dashboard_ejecutivo: {
        label: "Dashboard ejecutivo",
        uiRoutes: ["/dashboard"],
        apiPrefixes: ["/api/reports/traffic-light"],
        actions: { view: "Ver KPIs y semáforo" },
      },
    },
  },
  presupuestos: {
    label: "Contratos",
    moduleId: "presupuestos" as const,
    screens: {
      contracts: {
        label: "Contratos",
        uiRoutes: ["/contracts"],
        apiPrefixes: ["/api/contracts", "/api/import/contracts", "/api/positions"],
        actions: {
          view: "Ver listado y detalle",
          edit: "Crear y editar contratos",
          admin: "Eliminar e importar masivo",
        },
      },
    },
  },
  facturacion: {
    label: "Facturación y cobro",
    moduleId: "facturacion" as const,
    screens: {
      cobro: {
        label: "Facturación mensual",
        uiRoutes: ["/facturacion"],
        apiPrefixes: ["/api/facturacion"],
        actions: {
          view: "Ver facturación mensual",
          edit: "Subir entregables y cerrar facturación",
        },
      },
      cxc: {
        label: "Cuentas por cobrar",
        uiRoutes: ["/facturacion/cuentas-por-cobrar", "/facturacion/configuracion"],
        apiPrefixes: ["/api/cuentas-por-cobrar", "/api/admin/facturacion/cobro-settings"],
        actions: {
          view: "Ver cuentas por cobrar",
          edit: "Confirmar pagos, enviar correos y configurar plantilla",
        },
      },
    },
  },
  gastos: {
    label: "Gastos y reportes",
    moduleId: "presupuestos" as const,
    screens: {
      expenses: {
        label: "Gastos",
        uiRoutes: ["/expenses"],
        apiPrefixes: ["/api/expenses", "/api/import/expenses"],
        actions: {
          view: "Ver gastos",
          edit: "Registrar y distribuir gastos",
          admin: "Eliminar gastos",
        },
      },
      expenses_deferred: {
        label: "Gastos diferidos",
        uiRoutes: ["/expenses/deferred"],
        apiPrefixes: ["/api/expenses/deferred"],
        actions: { view: "Ver", edit: "Gestionar diferidos" },
      },
      expenses_admin: {
        label: "Gastos administrativos",
        uiRoutes: ["/expenses/admin"],
        apiPrefixes: ["/api/expenses/admin"],
        actions: { view: "Ver", edit: "Gestionar gastos admin" },
      },
      expenses_approvals: {
        label: "Aprobaciones de gastos",
        uiRoutes: ["/expenses/pending-approvals"],
        apiPrefixes: ["/api/expenses"],
        actions: { view: "Ver pendientes", edit: "Aprobar o rechazar" },
      },
      expenses_bitacora: {
        label: "Bitácora de aprobaciones",
        uiRoutes: ["/expenses/approval-bitacora"],
        actions: { view: "Consultar bitácora" },
      },
      reports_monthly: {
        label: "Reporte mensual",
        uiRoutes: ["/reports"],
        apiPrefixes: ["/api/reports"],
        actions: { view: "Ver reporte mensual" },
      },
      reports_annual: {
        label: "Reporte anual",
        uiRoutes: ["/reports/annual"],
        apiPrefixes: ["/api/reports"],
        actions: { view: "Ver reporte anual" },
      },
    },
  },
  disciplinario: {
    label: "Disciplinario",
    moduleId: "disciplinario" as const,
    screens: {
      import: {
        label: "Importación",
        uiRoutes: ["/disciplinario/importar"],
        apiPrefixes: ["/api/disciplinary/import"],
        actions: { view: "Ver", edit: "Importar lotes", admin: "Eliminar lotes" },
      },
      historial: {
        label: "Historial",
        uiRoutes: ["/disciplinario"],
        apiPrefixes: ["/api/disciplinary/apercibimientos"],
        actions: { view: "Ver historial", edit: "Cambiar estados" },
      },
      empleados: {
        label: "Tratamiento",
        uiRoutes: ["/disciplinario/empleados"],
        apiPrefixes: ["/api/disciplinary/empleados", "/api/disciplinary/employees-master"],
        actions: { view: "Ver", edit: "Registrar tratamientos y ciclos" },
      },
      convocatoria: {
        label: "Solicitud de convocatoria",
        uiRoutes: ["/disciplinario/convocatoria"],
        apiPrefixes: ["/api/disciplinary/convocatorias"],
        actions: { view: "Ver cronograma", edit: "Editar fecha/hora y enviar correo" },
      },
      dashboard: {
        label: "Dashboard disciplinario",
        uiRoutes: ["/disciplinario/dashboard"],
        apiPrefixes: ["/api/disciplinary/dashboard"],
        actions: { view: "Ver indicadores" },
      },
      omisiones: {
        label: "Reporte de omisiones",
        uiRoutes: ["/disciplinario/reportes/omisiones"],
        actions: { view: "Ver reporte" },
      },
      ajustes: {
        label: "Ajustes",
        uiRoutes: ["/disciplinario/ajustes"],
        apiPrefixes: ["/api/admin/disciplinary"],
        actions: { view: "Ver", edit: "Configurar", admin: "SMTP y firma" },
      },
    },
  },
  inventario: {
    label: "Inventario",
    moduleId: "inventario" as const,
    screens: {
      assets: {
        label: "Activos",
        uiRoutes: ["/inventory"],
        apiPrefixes: ["/api/assets", "/api/asset-movements"],
        actions: {
          view: "Ver inventario",
          edit: "Movimientos y asignaciones",
          admin: "Eliminar activos",
        },
      },
    },
  },
  empleados: {
    label: "Empleados",
    moduleId: "empleados" as const,
    screens: {
      list: {
        label: "Directorio",
        uiRoutes: ["/empleados"],
        apiPrefixes: ["/api/empleados"],
        actions: { view: "Ver empleados y asignaciones" },
      },
      import: {
        label: "Importación",
        uiRoutes: ["/empleados/importar"],
        apiPrefixes: ["/api/empleados/import"],
        actions: { view: "Ver historial", edit: "Cargar CSV masivo" },
      },
      contratos: {
        label: "Conciliación contratos",
        uiRoutes: ["/empleados/contratos"],
        apiPrefixes: ["/api/empleados/contratos"],
        actions: {
          view: "Ver discrepancias",
          edit: "Vincular y unificar contratos",
        },
      },
    },
  },
  sig: {
    label: "Sistema Integrado de Gestión",
    moduleId: "sig" as const,
    screens: {
      biblioteca: {
        label: "Biblioteca documental",
        uiRoutes: ["/sig"],
        apiPrefixes: ["/api/sig/documents", "/api/sig/revision-reminders"],
        actions: {
          view: "Consultar documentos y descargar",
          edit: "Editar metadatos del documento",
        },
      },
      documentos: {
        label: "Carga de documentos",
        uiRoutes: ["/sig/documentos/nuevo"],
        apiPrefixes: ["/api/sig/documents", "/api/sig/aprobadores"],
        actions: {
          view: "Ver formularios de carga",
          edit: "Subir documentos y nuevas versiones",
          admin: "Actualizar vigencia sin cambiar versión",
        },
      },
      aprobaciones: {
        label: "Aprobaciones",
        uiRoutes: ["/sig/aprobaciones"],
        apiPrefixes: ["/api/sig/documents"],
        actions: {
          view: "Ver pendientes de aprobación",
          edit: "Aprobar o rechazar documentos",
        },
      },
      bitacora: {
        label: "Bitácora",
        uiRoutes: ["/sig/bitacora"],
        apiPrefixes: ["/api/sig/bitacora"],
        actions: { view: "Consultar historial de cambios y aprobaciones" },
      },
      procesos: {
        label: "Procesos y tipos",
        uiRoutes: ["/sig/procesos"],
        apiPrefixes: ["/api/sig/procesos", "/api/sig/tipos-documento"],
        actions: {
          view: "Ver catálogos",
          edit: "Crear y editar procesos",
          admin: "Administrar tipos documentales",
        },
      },
    },
  },
  recorridos: {
    label: "Recorrido de marcas",
    moduleId: "recorridos" as const,
    screens: {
      dashboard: {
        label: "Resumen",
        uiRoutes: ["/recorridos"],
        apiPrefixes: ["/api/admin/patrol/reports"],
        actions: { view: "Ver indicadores operativos" },
      },
      configuracion: {
        label: "Configuración app",
        uiRoutes: ["/recorridos/configuracion"],
        apiPrefixes: ["/api/admin/patrol/settings"],
        actions: { view: "Ver parámetros", edit: "Editar parámetros remotos" },
      },
      dispositivos: {
        label: "Dispositivos",
        uiRoutes: ["/recorridos/dispositivos"],
        apiPrefixes: ["/api/admin/patrol/devices"],
        actions: {
          view: "Ver dispositivos",
          edit: "Registrar y editar",
          admin: "Eliminar dispositivos",
        },
      },
      rutas: {
        label: "Rutas y puntos",
        uiRoutes: ["/recorridos/rutas"],
        apiPrefixes: ["/api/admin/patrol/routes"],
        actions: {
          view: "Ver rutas",
          edit: "Gestionar rutas y puntos NFC",
          admin: "Eliminar rutas",
        },
      },
      asignaciones: {
        label: "Asignaciones",
        uiRoutes: ["/recorridos/asignaciones"],
        apiPrefixes: ["/api/admin/patrol/assignments"],
        actions: { view: "Ver asignaciones", edit: "Asignar rutas a dispositivos" },
      },
      reportes: {
        label: "Reportes",
        uiRoutes: ["/recorridos/reportes"],
        apiPrefixes: ["/api/admin/patrol/reports"],
        actions: { view: "Consultar reportes operativos" },
      },
    },
  },
  plataforma: {
    label: "Mantenimiento",
    moduleId: "plataforma" as const,
    screens: {
      users: {
        label: "Usuarios",
        uiRoutes: ["/admin/users"],
        apiPrefixes: ["/api/users"],
        actions: {
          view: "Ver usuarios",
          edit: "Crear y editar",
          admin: "Desactivar y restablecer contraseña",
        },
      },
      roles: {
        label: "Roles y permisos",
        uiRoutes: ["/admin/roles"],
        apiPrefixes: ["/api/admin/roles"],
        actions: { view: "Ver roles", edit: "Gestionar roles", admin: "Eliminar roles" },
      },
      catalogs: {
        label: "Catálogos",
        uiRoutes: ["/admin/catalogs"],
        apiPrefixes: [
          "/api/admin/catalogs",
          "/api/admin/branding",
          "/api/companies",
        ],
        actions: { view: "Ver catálogos", edit: "Editar catálogos", admin: "Eliminar registros" },
      },
      approvals_config: {
        label: "Aprobaciones (configuración)",
        uiRoutes: ["/admin/catalogs"],
        apiPrefixes: ["/api/admin/catalogs/expense-type-approval-steps"],
        actions: { view: "Ver cadenas", edit: "Configurar pasos de aprobación" },
      },
    },
  },
} as const satisfies Record<string, PermissionModuleDef>;

export type PermissionKey = {
  [M in keyof typeof PERMISSION_REGISTRY]: {
    [S in keyof (typeof PERMISSION_REGISTRY)[M]["screens"]]: `${M}.${S & string}`;
  }[keyof (typeof PERMISSION_REGISTRY)[M]["screens"]];
}[keyof typeof PERMISSION_REGISTRY];

const LEVEL_ORDER: Record<PermissionLevelId, number> = {
  none: 0,
  view: 1,
  edit: 2,
  admin: 3,
};

export function levelMeets(
  actual: PermissionLevelId,
  required: PermissionLevelId
): boolean {
  return LEVEL_ORDER[actual] >= LEVEL_ORDER[required];
}

/** Todas las claves `modulo.pantalla` del registro. */
export function allPermissionKeys(): PermissionKey[] {
  const keys: string[] = [];
  for (const [modKey, mod] of Object.entries(PERMISSION_REGISTRY)) {
    for (const screenKey of Object.keys(mod.screens)) {
      keys.push(`${modKey}.${screenKey}`);
    }
  }
  return keys as PermissionKey[];
}

export function isValidPermissionKey(key: string): key is PermissionKey {
  return allPermissionKeys().includes(key as PermissionKey);
}

export function getPermissionDef(key: PermissionKey): {
  moduleKey: string;
  screenKey: string;
  module: PermissionModuleDef;
  screen: PermissionScreenDef;
} | null {
  const dot = key.indexOf(".");
  if (dot < 0) return null;
  const moduleKey = key.slice(0, dot);
  const screenKey = key.slice(dot + 1);
  const module = PERMISSION_REGISTRY[moduleKey as keyof typeof PERMISSION_REGISTRY];
  if (!module) return null;
  const screen = module.screens[screenKey as keyof typeof module.screens];
  if (!screen) return null;
  return { moduleKey, screenKey, module, screen };
}

/** Resuelve la clave de permiso desde una ruta UI (pathname sin query). */
export function permissionKeyFromPath(pathname: string): PermissionKey | null {
  const path = pathname.split("?")[0];
  let best: { key: PermissionKey; len: number } | null = null;

  for (const key of allPermissionKeys()) {
    const def = getPermissionDef(key);
    if (!def) continue;
    for (const route of def.screen.uiRoutes) {
      if (path === route || path.startsWith(`${route}/`)) {
        if (!best || route.length > best.len) {
          best = { key, len: route.length };
        }
      }
    }
  }
  return best?.key ?? null;
}

/** Módulos de negocio para tiles de inicio (agrupa pantallas del registro). */
export const HOME_MODULE_PERMISSION_GROUPS: {
  tileId: string;
  label: string;
  moduleKeys: (keyof typeof PERMISSION_REGISTRY)[];
}[] = [
  { tileId: "contratos", label: "Contratos", moduleKeys: ["presupuestos"] },
  { tileId: "facturacion_cobro", label: "Facturación y cobro", moduleKeys: ["facturacion"] },
  { tileId: "gastos", label: "Gastos", moduleKeys: ["gastos"] },
  { tileId: "disciplinario", label: "Disciplinario", moduleKeys: ["disciplinario"] },
  { tileId: "empleados", label: "Empleados", moduleKeys: ["empleados"] },
  { tileId: "inventario", label: "Inventario", moduleKeys: ["inventario"] },
  { tileId: "sig", label: "SIG", moduleKeys: ["sig"] },
  { tileId: "recorridos", label: "Recorrido de marcas", moduleKeys: ["recorridos"] },
  { tileId: "mantenimiento", label: "Mantenimiento", moduleKeys: ["plataforma"] },
];

export function permissionKeysForModuleGroup(
  moduleKeys: (keyof typeof PERMISSION_REGISTRY)[]
): PermissionKey[] {
  return allPermissionKeys().filter((k) =>
    moduleKeys.some((m) => k.startsWith(`${m}.`))
  );
}

export function moduleIdFromPermissionKey(key: PermissionKey): AppModuleId {
  const def = getPermissionDef(key);
  return def?.module.moduleId ?? "core";
}
