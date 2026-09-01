/** Etiquetas de pantalla para contexto del asistente (cliente + servidor). */
const PATH_LABELS: Array<{ prefix: string; label: string; toolHint?: string }> = [
  { prefix: "/empleados-naf/nomina/revision-planilla", label: "Empleados NAF / Revisión de planilla", toolHint: "query_revision_planilla_formas_pago" },
  { prefix: "/empleados-naf/nomina", label: "Empleados NAF / Nómina", toolHint: "query_payroll_totals, query_revision_planilla_formas_pago" },
  { prefix: "/empleados-naf", label: "Empleados NAF", toolHint: "search_naf_employees" },
  { prefix: "/contracts", label: "Contratos", toolHint: "search_contracts, query_contract_profitability" },
  { prefix: "/expenses", label: "Gastos", toolHint: "list_expenses, query_expenses_totals" },
  { prefix: "/dashboard", label: "Dashboard ejecutivo", toolHint: "query_traffic_light_summary" },
  { prefix: "/facturacion/cuentas-por-cobrar", label: "Cuentas por cobrar", toolHint: "search_cxc" },
  { prefix: "/facturacion/dashboard", label: "Dashboard facturación", toolHint: "query_facturacion_dashboard" },
  { prefix: "/facturacion", label: "Facturación y cobro", toolHint: "query_facturacion_dashboard, search_cxc" },
  { prefix: "/cuentas-por-pagar", label: "Cuentas por pagar", toolHint: "search_cxp_facturas" },
  { prefix: "/facturacion-electronica", label: "Facturación electrónica", toolHint: "list_fe_facturas" },
  { prefix: "/pagos", label: "Pagos", toolHint: "query_payment_calendar" },
  { prefix: "/tickets-ti", label: "Tickets TI", toolHint: "search_tickets, query_tickets_dashboard" },
  { prefix: "/inventory", label: "Inventario", toolHint: "search_assets" },
  { prefix: "/finger-system", label: "Finger System", toolHint: "query_finger_dashboard" },
  { prefix: "/expediente-digital", label: "Expediente digital", toolHint: "search_expediente_person" },
  { prefix: "/empleados", label: "Empleados", toolHint: "search_employees" },
  { prefix: "/disciplinario", label: "Disciplinario", toolHint: "search_disciplinary_warnings, query_disciplinary_dashboard" },
  { prefix: "/sig", label: "SIG", toolHint: "list_sig_documents, list_sig_incidents, list_sig_risks" },
  { prefix: "/ventas", label: "Ventas", toolHint: "list_presupuestos, list_oportunidades" },
  { prefix: "/naf-operaciones", label: "NAF Operaciones", toolHint: "list_op_roles, list_op_asistencia, list_op_vacantes" },
  { prefix: "/recorridos", label: "Recorridos", toolHint: "query_patrol_compliance" },
  { prefix: "/monitoreo", label: "Monitoreo", toolHint: "list_monitoreo_activaciones, lookup_monitoreo_alarm" },
  { prefix: "/formularios", label: "Formularios", toolHint: "list_forms, list_form_submissions" },
  { prefix: "/notificaciones", label: "Notificaciones", toolHint: "list_inbox_notifications" },
  { prefix: "/admin", label: "Mantenimiento / Admin" },
  { prefix: "/home", label: "Inicio" },
];

export type SyntraAiPageContext = {
  path: string;
  pageTitle?: string | null;
  moduleLabel?: string | null;
};

export function resolvePageModuleLabel(pathname: string): string | null {
  const path = (pathname || "/").split("?")[0];
  for (const { prefix, label } of PATH_LABELS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return label;
  }
  return null;
}

function resolvePathHint(pathname: string): string | null {
  const path = (pathname || "/").split("?")[0];
  for (const { prefix, toolHint } of PATH_LABELS) {
    if (toolHint && (path === prefix || path.startsWith(`${prefix}/`))) return toolHint;
  }
  return null;
}

export function formatPageContextLabel(ctx: SyntraAiPageContext | null | undefined): string {
  if (!ctx?.path) return "";
  const parts = [resolvePageModuleLabel(ctx.path) || null, ctx.pageTitle?.trim() || null, ctx.path].filter(
    Boolean,
  ) as string[];
  return [...new Set(parts)].join(" · ");
}

export function buildPageContextPrompt(ctx: SyntraAiPageContext | null | undefined): string {
  const label = formatPageContextLabel(ctx);
  if (!label) return "";

  const toolHint = resolvePathHint(ctx?.path || "");
  const lines = [
    `El usuario está en la pantalla: ${label}.`,
    "Prioriza las herramientas de consulta de datos reales de este módulo antes de responder sin datos.",
  ];
  if (toolHint) lines.push(`Herramientas sugeridas: ${toolHint}.`);
  if ((ctx?.path || "").includes("/revision-planilla")) {
    lines.push("CK=cheque, DAV=Davivienda, BN=Banco Nacional (canales de pago, no empresas).");
  }
  return lines.join(" ");
}
