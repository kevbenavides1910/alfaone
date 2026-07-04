import type { AppModuleId, AppModuleMeta } from "./types";

/**
 * Mapa canónico módulo → rutas, APIs y carpetas.
 * Usar al planificar cambios, PRs y futura extracción a monorepo.
 */
export const APP_MODULES: Record<AppModuleId, AppModuleMeta> = {
  core: {
    id: "core",
    label: "Núcleo",
    description: "Auth, dashboard, empresas, branding público.",
    uiRoutePrefixes: ["/home", "/dashboard", "/login"],
    apiRoutePrefixes: ["/api/auth", "/api/companies", "/api/branding"],
    codePaths: [
      "src/modules/core",
      "src/app/(auth)",
      "src/app/(app)/home",
      "src/app/(app)/dashboard",
    ],
    prismaModels: ["Company", "User", "Account", "Session", "VerificationToken"],
  },

  presupuestos: {
    id: "presupuestos",
    label: "Contratos",
    description: "Licitaciones, clientes, presupuestos e importaciones de contratos.",
    uiRoutePrefixes: [
      "/contracts",
      "/expenses",
    ],
    apiRoutePrefixes: [
      "/api/contracts",
      "/api/expenses",
      "/api/import",
      "/api/positions",
    ],
    codePaths: [
      "src/app/(app)/contracts",
      "src/app/(app)/(gastos)/expenses",
      "src/components/contracts",
      "src/components/expenses",
      "src/modules/presupuestos",
    ],
    prismaModels: [
      "Contract",
      "BillingHistory",
      "ContractBillingRequirement",
      "ContractDemandBilling",
      "ContractPeriod",
      "UniformExpense",
      "AuditFinding",
      "DeferredExpense",
      "DeferredDistribution",
      "AdminExpense",
      "AdminDistribution",
      "Expense",
      "ExpenseDistribution",
      "ExpenseApproval",
      "ExpenseAttachment",
      "Zone",
      "ContractLocation",
      "Position",
      "PositionShift",
    ],
  },

  facturacion: {
    id: "facturacion",
    label: "Facturación y cobro",
    description: "Generación mensual, cuentas por cobrar y cierre por contrato.",
    uiRoutePrefixes: ["/facturacion"],
    apiRoutePrefixes: ["/api/facturacion", "/api/cuentas-por-cobrar"],
    codePaths: [
      "src/app/(app)/facturacion",
      "src/components/facturacion",
      "src/modules/presupuestos/services/facturacion-cobro.ts",
      "src/modules/presupuestos/services/cuentas-por-cobrar.ts",
      "src/modules/presupuestos/services/facturacion-cobro-settings.ts",
      "src/modules/presupuestos/services/facturacion-cobro-smtp.ts",
      "src/modules/presupuestos/services/facturacion-cobro-email.ts",
      "src/modules/presupuestos/services/facturacion-uploads.ts",
      "src/modules/presupuestos/validations/facturacion.schema.ts",
      "src/modules/presupuestos/validations/cuentas-por-cobrar.schema.ts",
    ],
    prismaModels: ["FacturaMensual", "FacturaRequisito"],
  },

  reportes: {
    id: "reportes",
    label: "Reportes",
    description: "Reporte mensual, anual, semáforo de rentabilidad.",
    uiRoutePrefixes: ["/reports"],
    apiRoutePrefixes: ["/api/reports"],
    codePaths: [
      "src/app/(app)/(gastos)/reports",
      "src/components/reports",
      "src/modules/presupuestos/business/annualProfitability.ts",
    ],
    prismaModels: [],
  },

  inventario: {
    id: "inventario",
    label: "Inventario",
    description: "Activos, tipos, movimientos y asignación a contratos.",
    uiRoutePrefixes: ["/inventory"],
    apiRoutePrefixes: ["/api/assets", "/api/asset-movements"],
    codePaths: [
      "src/app/(app)/inventory",
      "src/app/api/assets",
      "src/app/api/asset-movements",
      "src/app/api/admin/catalogs/asset-types",
      "src/modules/inventario",
    ],
    prismaModels: ["AssetType", "Asset", "AssetMovement"],
  },

  disciplinario: {
    id: "disciplinario",
    label: "Disciplinario",
    description: "Importación de apercibimientos, tratamientos, PDFs, omisiones.",
    uiRoutePrefixes: ["/disciplinario"],
    apiRoutePrefixes: ["/api/disciplinary", "/api/admin/disciplinary"],
    codePaths: [
      "src/app/(app)/disciplinario",
      "src/components/disciplinary",
      "src/modules/disciplinario",
    ],
    prismaModels: [
      "DisciplinaryImportBatch",
      "DisciplinaryApercibimiento",
      "DisciplinaryOmission",
      "DisciplinaryEmployeeMaster",
      "DisciplinaryTreatment",
      "DisciplinaryClosedCycle",
      "AppDisciplinarySettings",
    ],
  },

  empleados: {
    id: "empleados",
    label: "Empleados",
    description: "Maestro RRHH, contratos, ubicaciones y cuentas bancarias.",
    uiRoutePrefixes: ["/empleados"],
    apiRoutePrefixes: ["/api/empleados"],
    codePaths: [
      "src/app/(app)/empleados",
      "src/modules/empleados",
    ],
    prismaModels: [
      "EmployeeImportBatch",
      "Employee",
      "EmployeePlacement",
      "EmployeeContractLink",
    ],
  },

  sig: {
    id: "sig",
    label: "Sistema Integrado de Gestión",
    description: "DMS: procedimientos, formularios, instructivos, manuales y control de versiones.",
    uiRoutePrefixes: ["/sig"],
    apiRoutePrefixes: ["/api/sig"],
    codePaths: [
      "src/app/(app)/sig",
      "src/components/sig",
      "src/modules/sig",
    ],
    prismaModels: [
      "SigDocumentType",
      "SigProcess",
      "SigDocument",
      "SigDocumentVersion",
      "SigDocumentAuditLog",
    ],
  },

  recorridos: {
    id: "recorridos",
    label: "Recorrido de marcas",
    description: "App SYNTRA: dispositivos, rutas NFC, puntos, horarios y asignaciones.",
    uiRoutePrefixes: ["/recorridos"],
    apiRoutePrefixes: ["/api/admin/patrol", "/api/syntra"],
    codePaths: [
      "src/app/(app)/recorridos",
      "src/components/recorridos",
      "src/modules/syntra",
    ],
    prismaModels: [
      "AppSyntraSettings",
      "PatrolDevice",
      "PatrolRoute",
      "PatrolRoutePoint",
      "PatrolAssignment",
    ],
  },

  plataforma: {
    id: "plataforma",
    label: "Plataforma",
    description: "Usuarios, catálogos, branding admin, configuración global.",
    uiRoutePrefixes: ["/admin"],
    apiRoutePrefixes: ["/api/admin", "/api/users"],
    codePaths: [
      "src/app/(app)/(mantenimiento)/admin",
      "src/components/admin",
      "src/modules/plataforma",
    ],
    prismaModels: [
      "ExpenseTypeConfig",
      "ExpenseTypeApprovalStep",
      "ExpenseOrigin",
      "AuditLog",
      "AppBranding",
    ],
  },
};

/** Resuelve el módulo predominante para una ruta UI o API. */
export function resolveModuleFromPath(pathname: string): AppModuleId {
  const path = pathname.split("?")[0];
  const order: AppModuleId[] = [
    "disciplinario",
    "empleados",
    "sig",
    "recorridos",
    "facturacion",
    "plataforma",
    "inventario",
    "reportes",
    "presupuestos",
    "core",
  ];
  for (const id of order) {
    const mod = APP_MODULES[id];
    if (
      mod.uiRoutePrefixes.some((p) => path === p || path.startsWith(`${p}/`)) ||
      mod.apiRoutePrefixes.some((p) => path === p || path.startsWith(`${p}/`))
    ) {
      return id;
    }
  }
  return "core";
}
