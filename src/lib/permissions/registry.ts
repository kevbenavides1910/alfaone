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
      notifications: {
        label: "Centro de notificaciones",
        uiRoutes: ["/notificaciones"],
        apiPrefixes: ["/api/notifications"],
        actions: {
          view: "Ver bandeja e historial",
          edit: "Gestionar preferencias",
        },
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
      contracts_overview: {
        label: "Contrato — Resumen",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver resumen", edit: "Editar resumen" },
      },
      contracts_locations: {
        label: "Contrato — Ubicaciones",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver ubicaciones", edit: "Gestionar ubicaciones" },
      },
      contracts_assets: {
        label: "Contrato — Activos",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver activos", edit: "Gestionar activos" },
      },
      contracts_billing: {
        label: "Contrato — Registro de venta",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver registro de venta", edit: "Editar registro de venta" },
      },
      contracts_demand_billing: {
        label: "Contrato — Facturación por demanda",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver facturación por demanda", edit: "Gestionar facturación por demanda" },
      },
      contracts_billing_requirements: {
        label: "Contrato — Requisitos de facturación",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver requisitos", edit: "Editar requisitos" },
      },
      contracts_administrations: {
        label: "Contrato — Administraciones",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver administraciones", edit: "Gestionar administraciones" },
      },
      contracts_client_contacts: {
        label: "Contrato — Contacto del cliente",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver contactos", edit: "Editar contactos" },
      },
      contracts_periods: {
        label: "Contrato — Prórrogas",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver prórrogas", edit: "Gestionar prórrogas" },
      },
      contracts_expenses: {
        label: "Contrato — Todos los gastos",
        uiRoutes: ["/contracts"],
        actions: { view: "Ver gastos del contrato", edit: "Gestionar gastos del contrato" },
      },
    },
  },
  ventas: {
    label: "Ventas",
    moduleId: "ventas" as const,
    screens: {
      presupuestos: {
        label: "Presupuestos",
        uiRoutes: ["/ventas/presupuestos"],
        apiPrefixes: ["/api/ventas/presupuestos"],
        actions: {
          view: "Ver presupuestos",
          edit: "Crear y editar presupuestos",
        },
      },
      oportunidades: {
        label: "Oportunidades",
        uiRoutes: ["/ventas/oportunidades"],
        apiPrefixes: ["/api/ventas/oportunidades"],
        actions: {
          view: "Ver oportunidades",
          edit: "Gestionar oportunidades",
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
      dashboard: {
        label: "Dashboard de facturación",
        uiRoutes: ["/facturacion/dashboard"],
        apiPrefixes: ["/api/facturacion/dashboard"],
        actions: { view: "Ver indicadores de facturación" },
      },
      documentos_naf: {
        label: "Documentos NAF",
        uiRoutes: ["/facturacion/documentos-naf"],
        apiPrefixes: ["/api/facturacion/documentos-naf"],
        actions: { view: "Consultar y descargar documentos NAF" },
      },
      informe_ccss_ins: {
        label: "Informe CCSS/INS/MNK",
        uiRoutes: ["/facturacion/informe-ccss-ins"],
        apiPrefixes: ["/api/facturacion/informe-ccss-ins"],
        actions: { view: "Generar informe CCSS/INS/MNK" },
      },
      config: {
        label: "Configuración de cobro",
        uiRoutes: ["/facturacion/configuracion"],
        apiPrefixes: ["/api/admin/facturacion/cobro-settings"],
        actions: { view: "Ver configuración", edit: "Editar plantillas y SMTP de cobro" },
      },
    },
  },
  facturacionElectronica: {
    label: "Facturación electrónica",
    moduleId: "facturacionElectronica" as const,
    screens: {
      facturas: {
        label: "Comprobantes electrónicos",
        uiRoutes: ["/facturacion-electronica"],
        apiPrefixes: ["/api/fe/facturas"],
        actions: {
          view: "Ver comprobantes",
          edit: "Emitir y enviar comprobantes",
        },
      },
      compras: {
        label: "Factura de compra",
        uiRoutes: ["/facturacion-electronica/compra"],
        apiPrefixes: ["/api/fe/facturas-compra"],
        actions: {
          view: "Ver facturas de compra",
          edit: "Registrar y enviar facturas de compra",
        },
      },
      recibos_pago: {
        label: "Recibos de pago",
        uiRoutes: ["/facturacion-electronica/recibo-pago"],
        apiPrefixes: ["/api/fe/recibos-pago"],
        actions: {
          view: "Ver recibos de pago",
          edit: "Emitir recibos de pago",
        },
      },
      recibidos: {
        label: "Comprobantes recibidos",
        uiRoutes: ["/facturacion-electronica/recibidos"],
        apiPrefixes: ["/api/fe/comprobantes-recibidos", "/api/fe/proveedores-confianza"],
        actions: {
          view: "Ver comprobantes recibidos",
          edit: "Gestionar recibidos y proveedores de confianza",
        },
      },
      gastos: {
        label: "Gastos electrónicos",
        uiRoutes: ["/facturacion-electronica/gastos"],
        apiPrefixes: ["/api/fe/gastos"],
        actions: { view: "Ver gastos vinculados a FE" },
      },
      mensajes_receptor: {
        label: "Mensajes receptor",
        uiRoutes: ["/facturacion-electronica/mensajes-receptor"],
        apiPrefixes: ["/api/fe/mensajes-receptor"],
        actions: {
          view: "Ver mensajes receptor",
          edit: "Gestionar mensajes receptor",
        },
      },
      config: {
        label: "Configuración emisor",
        uiRoutes: ["/facturacion-electronica/configuracion"],
        apiPrefixes: ["/api/fe/config"],
        actions: {
          view: "Ver configuración del emisor",
          edit: "Configurar empresa, certificado, IMAP y puntos de venta",
        },
      },
    },
  },
  cuentasPorPagar: {
    label: "Cuentas por pagar",
    moduleId: "cuentasPorPagar" as const,
    screens: {
      facturas: {
        label: "Facturas y movimientos CXP (NAF)",
        uiRoutes: ["/cuentas-por-pagar"],
        apiPrefixes: ["/api/cuentas-por-pagar"],
        actions: {
          view: "Consultar facturas CXP, amarres de pago y movimientos contables NAF",
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
  solicitudesRrhh: {
    label: "Solicitudes RRHH",
    moduleId: "solicitudesRrhh" as const,
    screens: {
      ajustes: {
        label: "Ajustes de constancias",
        uiRoutes: ["/solicitudes-rrhh/ajustes"],
        apiPrefixes: ["/api/solicitudes-rrhh/settings", "/api/solicitudes-rrhh/signature"],
        actions: { view: "Ver ajustes", edit: "Configurar documentos, firma y correo OTP" },
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
        uiRoutes: [
          "/empleados/contratos",
          "/empleados/contratos/photorec",
          "/empleados/contratos/reconstruccion",
          "/empleados/contratos/faltantes-e5",
        ],
        apiPrefixes: ["/api/empleados/contratos"],
        actions: {
          view: "Ver discrepancias y revisar PDFs PhotoRec",
          edit: "Vincular contratos y clasificar PhotoRec",
        },
      },
    },
  },

  nafOperaciones: {
    label: "Operaciones NAF (OP)",
    moduleId: "nafOperaciones" as const,
    screens: {
      roles: {
        label: "Roles y programación",
        uiRoutes: ["/naf-operaciones", "/naf-operaciones/programacion"],
        apiPrefixes: ["/api/naf-operaciones/roles", "/api/naf-operaciones/contratos", "/api/naf-operaciones/filtros"],
        actions: { view: "Ver roles y programación OP" },
      },
      asistencia: {
        label: "Asistencia OP",
        uiRoutes: ["/naf-operaciones/asistencia"],
        apiPrefixes: ["/api/naf-operaciones/asistencias"],
        actions: {
          view: "Ver asistencia y marcas OP",
          edit: "Marcar asistencia OP en Oracle",
        },
      },
      vacantes: {
        label: "Vacantes OP",
        uiRoutes: ["/naf-operaciones/vacantes"],
        apiPrefixes: ["/api/naf-operaciones/filtros"],
        actions: { view: "Ver roles vacantes OP" },
      },
      programacion: {
        label: "Edición programación OP",
        uiRoutes: ["/naf-operaciones/programacion"],
        apiPrefixes: [
          "/api/naf-operaciones/roles/upsert",
          "/api/naf-operaciones/roles/next",
          "/api/naf-operaciones/contratos",
        ],
        actions: {
          view: "Ver formularios de programación OP",
          edit: "Crear, programar y reasignar roles OP en Oracle",
        },
      },
    },
  },


  expedienteDigital: {
    label: "Expediente digital",
    moduleId: "expedienteDigital" as const,
    screens: {
      list: {
        label: "Consulta de expediente",
        uiRoutes: ["/expediente-digital"],
        apiPrefixes: [
          "/api/expediente-digital/search",
          "/api/expediente-digital/tipos",
          "/api/expediente-digital",
        ],
        actions: { view: "Ver expedientes por cédula y descargar documentos" },
      },
      upload: {
        label: "Carga de documentos",
        uiRoutes: ["/expediente-digital"],
        apiPrefixes: ["/api/expediente-digital"],
        actions: { edit: "Agregar documentos al expediente digital (share NAF)" },
      },
    },
  },

  empleadosNaf: {
    label: "Empleados NAF",
    moduleId: "empleadosNaf" as const,
    screens: {
      list: {
        label: "Directorio NAF",
        uiRoutes: ["/empleados-naf"],
        apiPrefixes: ["/api/empleados-naf"],
        actions: { view: "Ver empleados NAF" },
      },
      sync: {
        label: "Sincronización NAF",
        uiRoutes: ["/empleados-naf"],
        apiPrefixes: [
          "/api/empleados-naf/sync",
          "/api/empleados-naf/sync-status",
          "/api/empleados-naf/nomina/sync",
          "/api/empleados-naf/nomina/sync-status",
        ],
        actions: { edit: "Ejecutar sincronización desde Oracle NAF" },
      },
      nomina: {
        label: "Nómina NAF",
        uiRoutes: ["/empleados-naf/nomina"],
        apiPrefixes: ["/api/empleados-naf/nomina"],
        actions: { view: "Ver nómina NAF por quincena" },
      },
      homologacion: {
        label: "Homologación contratos NAF",
        uiRoutes: ["/empleados-naf/nomina/homologacion"],
        apiPrefixes: [
          "/api/empleados-naf/nomina/homologacion",
          "/api/empleados-naf/nomina/homologacion/vincular",
        ],
        actions: {
          view: "Ver contratos NAF sin vínculo en presupuestos",
          edit: "Homologar contratos NAF con contratos del sistema",
        },
      },
      sinAsignar: {
        label: "Asignación manual nómina",
        uiRoutes: ["/empleados-naf/nomina/sin-asignar"],
        apiPrefixes: ["/api/empleados-naf/nomina/sin-asignar"],
        actions: {
          view: "Ver empleados pagados sin asistencia ni contrato asignado",
          edit: "Asignar manualmente salario de nómina a contratos",
        },
      },
      revisionPlanilla: {
        label: "Revisión de planilla NAF",
        uiRoutes: ["/empleados-naf/nomina/revision-planilla"],
        apiPrefixes: ["/api/empleados-naf/nomina/revision-planilla"],
        actions: {
          view: "Ver revisión de planilla por empresa, ingresos, deducciones y formas de pago",
          edit: "Marcar planillas como revisada, generada o pagada",
        },
      },
      cargasSociales: {
        label: "Cargas sociales NAF",
        uiRoutes: ["/empleados-naf/cargas-sociales"],
        apiPrefixes: ["/api/empleados-naf/cargas-sociales"],
        actions: {
          view: "Ver cargas sociales por empresa NAF",
          edit: "Editar cargas sociales por empresa NAF",
        },
      },
      vacacionesPersonal: {
        label: "Vacaciones de personal",
        uiRoutes: ["/empleados-naf/vacaciones-personal", "/naf-operaciones/vacaciones-personal"],
        apiPrefixes: ["/api/empleados-naf/vacaciones-personal", "/api/naf-operaciones/vacaciones-personal"],
        actions: { view: "Consultar vacaciones e incapacidades por cédula" },
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
      auditorias: {
        label: "Auditorías de procedimientos",
        uiRoutes: ["/sig/auditorias", "/audits"],
        apiPrefixes: ["/api/sig/audits", "/api/sig/audit-programs"],
        actions: {
          view: "Ver auditorías trimestrales y programa anual del SIG",
          edit: "Crear y actualizar auditorías, programa anual, hallazgos, planes y seguimientos",
        },
      },
      requisitos: {
        label: "Matriz de requisitos",
        uiRoutes: ["/sig/requisitos"],
        apiPrefixes: ["/api/sig/requirements"],
        actions: {
          view: "Consultar matriz de requisitos ISO",
          edit: "Crear y vincular requisitos",
          admin: "Administrar normas y aplicabilidad",
        },
      },
      evidencias: {
        label: "Evidencias del SIG",
        uiRoutes: ["/sig/evidencias"],
        apiPrefixes: ["/api/sig/evidences"],
        actions: {
          view: "Consultar evidencias trazables",
          edit: "Registrar y vincular evidencias",
        },
      },
      controles: {
        label: "Controles del SIG",
        uiRoutes: ["/sig/controles"],
        apiPrefixes: ["/api/sig/controls"],
        actions: {
          view: "Consultar controles SIG",
          edit: "Crear y vincular controles",
          admin: "Administrar estado de controles",
        },
      },
      riesgos: {
        label: "Riesgos y oportunidades",
        uiRoutes: ["/sig/riesgos"],
        apiPrefixes: ["/api/sig/risks"],
        actions: {
          view: "Consultar matriz de riesgos y oportunidades",
          edit: "Registrar, evaluar y vincular riesgos",
          admin: "Cerrar o administrar riesgos",
        },
      },
      legales: {
        label: "Requisitos legales",
        uiRoutes: ["/sig/legales"],
        apiPrefixes: ["/api/sig/legal"],
        actions: {
          view: "Consultar matriz de requisitos legales",
          edit: "Registrar y evaluar cumplimiento legal",
          admin: "Administrar requisitos legales",
        },
      },
      indicadores: {
        label: "Indicadores del SIG",
        uiRoutes: ["/sig/indicadores"],
        apiPrefixes: ["/api/sig/indicators"],
        actions: {
          view: "Consultar indicadores y mediciones",
          edit: "Registrar indicadores y mediciones",
          admin: "Administrar indicadores",
        },
      },
      incidentes: {
        label: "Incidentes y DDHH",
        uiRoutes: ["/sig/incidentes"],
        apiPrefixes: ["/api/sig/incidents"],
        actions: {
          view: "Consultar incidentes de seguridad y DDHH",
          edit: "Registrar e investigar incidentes",
          admin: "Cerrar o administrar incidentes",
        },
      },
      revisionDireccion: {
        label: "Revisión por la dirección",
        uiRoutes: ["/sig/revision-direccion"],
        apiPrefixes: ["/api/sig/management-reviews"],
        actions: {
          view: "Consultar actas de revisión por la dirección",
          edit: "Registrar actas, entradas y acciones de seguimiento",
          admin: "Cerrar revisiones por la dirección",
        },
      },
      procesos: {
        label: "Procesos y tipos",
        uiRoutes: ["/sig/procesos"],
        apiPrefixes: ["/api/sig/procesos", "/api/sig/tipos-documento"],
        actions: {
          view: "Ver catálogos y expediente de proceso",
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
        uiRoutes: [
          "/recorridos/reportes",
          "/recorridos/hombre-vivo",
          "/recorridos/mapa",
          "/recorridos/marcas-fuera-ruta",
          "/recorridos/auditoria-pendientes",
          "/recorridos/bitacora",
          "/recorridos/rutas-permitidas",
        ],
        apiPrefixes: ["/api/admin/patrol/reports", "/api/cron/patrol-welfare"],
        actions: { view: "Consultar reportes operativos", edit: "Ejecutar jobs operativos" },
      },
    },
  },
  ticketsTi: {
    label: "Tickets TI",
    moduleId: "ticketsTi" as const,
    screens: {
      centro: {
        label: "Centro de operaciones",
        uiRoutes: ["/tickets-ti"],
        apiPrefixes: ["/api/tickets-ti/dashboard", "/api/tickets-ti/reports", "/api/tickets-ti/search"],
        actions: {
          view: "Ver centro de operaciones",
          edit: "Gestionar tickets del centro",
        },
      },
      tickets: {
        label: "Tickets",
        uiRoutes: ["/tickets-ti/mis-tickets", "/tickets-ti/nuevo"],
        apiPrefixes: ["/api/tickets-ti"],
        actions: {
          view: "Ver tickets",
          edit: "Crear y gestionar tickets",
          admin: "Administrar todos los tickets",
        },
      },
      admin: {
        label: "Administración",
        uiRoutes: ["/tickets-ti/admin"],
        apiPrefixes: ["/api/tickets-ti/catalogs"],
        actions: {
          view: "Ver catálogos",
          admin: "Administrar catálogos de tickets",
        },
      },
      attachments: {
        label: "Adjuntos",
        uiRoutes: ["/tickets-ti"],
        apiPrefixes: ["/api/tickets-ti"],
        actions: { view: "Ver adjuntos de tickets" },
      },
    },
  },
  formularios: {
    label: "Formularios",
    moduleId: "formularios" as const,
    screens: {
      editor: {
        label: "Editor de formularios",
        uiRoutes: ["/formularios/nuevo"],
        apiPrefixes: ["/api/formularios"],
        actions: {
          view: "Ver formularios en edición",
          edit: "Crear y editar formularios",
          admin: "Eliminar formularios",
        },
      },
      resultados: {
        label: "Resultados",
        uiRoutes: ["/formularios"],
        apiPrefixes: ["/api/formularios"],
        actions: { view: "Ver respuestas enviadas" },
      },
      catalogo: {
        label: "Catálogo y respuesta",
        uiRoutes: ["/formularios"],
        apiPrefixes: ["/api/formularios"],
        actions: { view: "Ver catálogo y responder formularios" },
      },
    },
  },
  monitoreo: {
    label: "Monitoreo",
    moduleId: "monitoreo" as const,
    screens: {
      consulta: {
        label: "Consulta de códigos",
        uiRoutes: ["/monitoreo"],
        apiPrefixes: ["/api/monitoreo/consulta"],
        actions: { view: "Consultar códigos de alarma" },
      },
      operacion: {
        label: "Operación",
        uiRoutes: [
          "/monitoreo/activaciones",
          "/monitoreo/aperturas-cierres",
          "/monitoreo/eventos",
          "/monitoreo/pilas",
        ],
        apiPrefixes: [
          "/api/monitoreo/activaciones",
          "/api/monitoreo/aperturas-cierres",
          "/api/monitoreo/eventos",
          "/api/monitoreo/pilas-llenado",
          "/api/monitoreo/imagenes",
        ],
        actions: { view: "Ver operaciones", edit: "Registrar operaciones" },
      },
      registros: {
        label: "Registros e informes",
        uiRoutes: ["/monitoreo/registro", "/monitoreo/informe-semanal"],
        apiPrefixes: ["/api/monitoreo/informe-semanal"],
        actions: { view: "Consultar registros e informe semanal" },
      },
      mantenimientos: {
        label: "Mantenimientos",
        uiRoutes: ["/monitoreo/mantenimientos"],
        apiPrefixes: ["/api/monitoreo"],
        actions: {
          view: "Ver catálogos de monitoreo",
          edit: "Editar catálogos",
          admin: "Importar y eliminar registros",
        },
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
  const moduleEntry = PERMISSION_REGISTRY[moduleKey as keyof typeof PERMISSION_REGISTRY];
  if (!moduleEntry) return null;
  const screen = moduleEntry.screens[screenKey as keyof typeof moduleEntry.screens];
  if (!screen) return null;
  return { moduleKey, screenKey, module: moduleEntry, screen };
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
  { tileId: "cuentas_por_pagar", label: "Cuentas por pagar", moduleKeys: ["cuentasPorPagar"] },
  { tileId: "gastos", label: "Gastos", moduleKeys: ["gastos"] },
  { tileId: "disciplinario", label: "Disciplinario", moduleKeys: ["disciplinario"] },
  { tileId: "empleados", label: "Empleados", moduleKeys: ["empleados"] },
  { tileId: "solicitudes_rrhh", label: "Solicitudes RRHH", moduleKeys: ["solicitudesRrhh"] },
  { tileId: "inventario", label: "Inventario", moduleKeys: ["inventario"] },
  { tileId: "sig", label: "SIG", moduleKeys: ["sig"] },
  { tileId: "ventas", label: "Ventas", moduleKeys: ["ventas"] },
  {
    tileId: "facturacion_electronica",
    label: "Facturación electrónica",
    moduleKeys: ["facturacionElectronica"],
  },
  { tileId: "tickets_ti", label: "Tickets TI", moduleKeys: ["ticketsTi"] },
  { tileId: "formularios", label: "Formularios", moduleKeys: ["formularios"] },
  { tileId: "empleados_naf", label: "Empleados NAF", moduleKeys: ["empleadosNaf"] },
  { tileId: "expediente_digital", label: "Expediente digital", moduleKeys: ["expedienteDigital"] },
  { tileId: "naf_operaciones", label: "Operaciones NAF", moduleKeys: ["nafOperaciones"] },
  { tileId: "monitoreo", label: "Monitoreo", moduleKeys: ["monitoreo"] },
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
