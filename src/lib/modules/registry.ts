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

  cuentasPorPagar: {
    id: "cuentasPorPagar",
    label: "Cuentas por pagar",
    description: "Consulta de facturas CXP Codisa (NAF5.ARCP*) por proveedor y estado de amarre.",
    uiRoutePrefixes: ["/cuentas-por-pagar"],
    apiRoutePrefixes: ["/api/cuentas-por-pagar"],
    codePaths: [
      "src/modules/cuentas-por-pagar",
      "src/app/(app)/cuentas-por-pagar",
      "src/app/api/cuentas-por-pagar",
      "src/components/cuentas-por-pagar",
    ],
    prismaModels: [],
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


  nafOperaciones: {
    id: "nafOperaciones",
    label: "Operaciones NAF",
    description: "Roles, programación y asistencia Forms OP (AROP*).",
    uiRoutePrefixes: ["/naf-operaciones"],
    apiRoutePrefixes: ["/api/naf-operaciones"],
    codePaths: [
      "src/app/(app)/naf-operaciones",
      "src/modules/naf-operaciones",
    ],
    prismaModels: [],
  },

  empleadosNaf: {
    id: "empleadosNaf",
    label: "Empleados NAF",
    description: "Directorio NAF y sincronización desde Oracle.",
    uiRoutePrefixes: ["/empleados-naf"],
    apiRoutePrefixes: ["/api/empleados-naf"],
    codePaths: [
      "src/app/(app)/empleados-naf",
      "src/modules/empleados-naf",
    ],
    prismaModels: ["EmpleadoNaf"],
  },


  expedienteDigital: {
    id: "expedienteDigital",
    label: "Expediente digital",
    description: "Documentos de empleados NAF agrupados por cédula.",
    uiRoutePrefixes: ["/expediente-digital"],
    apiRoutePrefixes: ["/api/expediente-digital"],
    codePaths: [
      "src/app/(app)/expediente-digital",
      "src/modules/expediente-digital",
      "src/components/expediente-digital",
    ],
    prismaModels: [],
  },

  ventas: {
    id: "ventas",
    label: "Ventas",
    description: "Presupuestos comerciales y oportunidades.",
    uiRoutePrefixes: ["/ventas"],
    apiRoutePrefixes: ["/api/ventas"],
    codePaths: [
      "src/app/(app)/ventas",
      "src/components/ventas",
    ],
    prismaModels: [],
  },

  facturacionElectronica: {
    id: "facturacionElectronica",
    label: "Facturación electrónica",
    description: "Emisión FE, compras, recibidos y configuración Hacienda.",
    uiRoutePrefixes: ["/facturacion-electronica"],
    apiRoutePrefixes: ["/api/fe"],
    codePaths: [
      "src/app/(app)/facturacion-electronica",
      "src/components/facturacion-electronica",
    ],
    prismaModels: [],
  },

  ticketsTi: {
    id: "ticketsTi",
    label: "Tickets TI",
    description: "Mesa de ayuda, centro de operaciones y catálogos.",
    uiRoutePrefixes: ["/tickets-ti"],
    apiRoutePrefixes: ["/api/tickets-ti"],
    codePaths: [
      "src/app/(app)/tickets-ti",
      "src/components/tickets-ti",
      "src/modules/tickets-ti",
    ],
    prismaModels: [],
  },

  formularios: {
    id: "formularios",
    label: "Formularios",
    description: "Encuestas dinámicas, respuestas y resultados.",
    uiRoutePrefixes: ["/formularios"],
    apiRoutePrefixes: ["/api/formularios"],
    codePaths: [
      "src/app/(app)/formularios",
      "src/components/formularios",
    ],
    prismaModels: [],
  },

  monitoreo: {
    id: "monitoreo",
    label: "Monitoreo",
    description: "Monitoreo de alarmas, operaciones y catálogos.",
    uiRoutePrefixes: ["/monitoreo"],
    apiRoutePrefixes: ["/api/monitoreo"],
    codePaths: [
      "src/app/(app)/monitoreo",
      "src/components/monitoreo",
      "src/modules/monitoreo",
    ],
    prismaModels: [
      "BandecoAlarmCode",
      "BandecoPantalla",
      "BandecoPuesto",
      "BandecoCamara",
      "BandecoAperturaCuenta",
      "BandecoPilaFinca",
      "BandecoPilaLlenado",
      "BandecoActivacion",
      "BandecoAperturaCierre",
      "BandecoEvento",
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
      "SigStandard",
      "SigRequirement",
      "SigRequirementProcess",
      "SigRequirementDocument",
      "SigEvidence",
      "SigEvidenceRequirement",
      "SigEvidenceAudit",
      "SigEvidenceChecklistItem",
      "SigEvidenceFinding",
      "SigEvidenceActionPlan",
      "SigFindingRequirement",
      "SigControl",
      "SigControlRequirement",
      "SigControlProcess",
      "SigControlDocument",
      "SigControlEvidence",
      "SigRisk",
      "SigRiskProcess",
      "SigRiskControl",
      "SigRiskRequirement",
      "SigRiskEvidence",
      "Audit",
      "AuditChecklistItem",
      "AuditSample",
      "AuditSampleItem",
      "AuditProgram",
      "AuditProgramItem",
      "Finding",
      "ActionPlan",
      "FollowUp",
    ],
  },

  recorridos: {
    id: "recorridos",
    label: "Recorrido de marcas",
    description: "App móvil: dispositivos, rutas NFC, puntos, horarios y asignaciones.",
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

  solicitudesRrhh: {
    id: "solicitudesRrhh",
    label: "Solicitudes RRHH",
    description: "Constancias públicas (FCL, carta de servicio) con OTP por correo.",
    uiRoutePrefixes: ["/solicitudes-rrhh"],
    apiRoutePrefixes: ["/api/solicitudes-rrhh"],
    codePaths: [
      "src/app/(auth)/solicitudes-rrhh",
      "src/app/(app)/solicitudes-rrhh",
      "src/app/api/solicitudes-rrhh",
      "src/modules/solicitudes-rrhh",
      "src/components/solicitudes-rrhh",
    ],
    prismaModels: ["HrDocumentRequestSettings", "HrDocumentRequestSession"],
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
    "nafOperaciones",
    "empleadosNaf",
    "expedienteDigital",
    "solicitudesRrhh",
    "sig",
    "recorridos",
    "ticketsTi",
    "formularios",
    "monitoreo",
    "facturacionElectronica",
    "cuentasPorPagar",
    "ventas",
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
