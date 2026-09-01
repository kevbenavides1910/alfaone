import type { Session } from "next-auth";
import { hasPermission } from "@/lib/permissions/check";
import { cxpTools } from "../tools/cxp.tools";
import { disciplinarioTools } from "../tools/disciplinario.tools";
import { empleadosNafTools } from "../tools/empleados-naf.tools";
import { empleadosTools } from "../tools/empleados.tools";
import { expedienteTools } from "../tools/expediente.tools";
import { facturacionElectronicaTools } from "../tools/facturacion-electronica.tools";
import { facturacionTools } from "../tools/facturacion.tools";
import { fingerTools } from "../tools/finger.tools";
import { formulariosTools } from "../tools/formularios.tools";
import { inventarioTools } from "../tools/inventario.tools";
import { monitoreoTools } from "../tools/monitoreo.tools";
import { nafOperacionesTools } from "../tools/naf-operaciones.tools";
import { notificationsTools } from "../tools/notifications.tools";
import { pagosTools } from "../tools/pagos.tools";
import { presupuestosTools } from "../tools/presupuestos.tools";
import { recorridosTools } from "../tools/recorridos.tools";
import { sigTools } from "../tools/sig.tools";
import { ticketsTools } from "../tools/tickets.tools";
import { ventasTools } from "../tools/ventas.tools";
import type { SyntraTool, ToolDefinition } from "../tools/types";

const ALL_TOOL_REGISTRARS: Array<() => SyntraTool[]> = [
  empleadosNafTools,
  presupuestosTools,
  facturacionTools,
  cxpTools,
  ticketsTools,
  pagosTools,
  inventarioTools,
  expedienteTools,
  fingerTools,
  empleadosTools,
  disciplinarioTools,
  sigTools,
  ventasTools,
  nafOperacionesTools,
  recorridosTools,
  facturacionElectronicaTools,
  monitoreoTools,
  formulariosTools,
  notificationsTools,
];

function visibleTools(session: Session): SyntraTool[] {
  return ALL_TOOL_REGISTRARS.flatMap((register) =>
    register().filter((tool) => hasPermission(session, tool.permission.key, tool.permission.level)),
  );
}

export function getSyntraToolDefinitions(session: Session): ToolDefinition[] {
  return visibleTools(session).map((t) => t.definition);
}

export async function executeSyntraTool(
  session: Session,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = visibleTools(session).find((t) => t.definition.function.name === name);
  if (!tool) return { error: `Herramienta desconocida o sin permiso: ${name}` };
  try {
    return await tool.handler(session, args);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al ejecutar herramienta" };
  }
}

function describeToolCall(toolName: string, args?: Record<string, unknown>): string {
  for (const register of ALL_TOOL_REGISTRARS) {
    const tool = register().find((t) => t.definition.function.name === toolName);
    if (tool?.describeCall) return tool.describeCall(args);
  }
  return `Consultando ${toolName.replace(/_/g, " ")}…`;
}

export function describeAgentProgress(
  kind: "start" | "llm" | "tool" | "compose" | "model",
  detail?: { round?: number; toolName?: string; args?: Record<string, unknown> },
): string {
  switch (kind) {
    case "start":
      return "Recibiendo su pregunta…";
    case "llm":
      return detail?.round === 0 ? "Analizando su pregunta…" : "Interpretando los datos obtenidos…";
    case "tool":
      return describeToolCall(detail?.toolName || "", detail?.args);
    case "compose":
      return "Redactando respuesta…";
    case "model":
      return "Generando respuesta con el modelo…";
    default:
      return "Procesando…";
  }
}

export const AGENT_TOOLS_PROMPT = `## Consulta de datos reales en Alfa One
Tienes herramientas para consultar datos reales según los permisos del usuario en casi todos los módulos. **Usa siempre la herramienta del módulo correcto**; no inventes cifras.

### Nómina / planilla (NAF)
- Totales: list_payroll_periods → query_payroll_totals.
- CK/DAV/BN (cheque, Davivienda, BN): query_revision_planilla_formas_pago. CK NO es empresa ni contrato.

### Contratos, gastos, rentabilidad
- search_contracts, query_contract_profitability, query_traffic_light_summary, list_expenses, query_expenses_totals.

### Facturación, CxC, CxP, FE
- query_facturacion_dashboard, search_cxc, search_cxp_facturas, list_fe_facturas.

### Personas y expediente
- search_employees (directorio), search_naf_employees (NAF), search_expediente_person.

### Operaciones
- list_op_roles, list_op_asistencia, list_op_vacantes, query_patrol_compliance, query_finger_dashboard.

### Ventas, SIG, disciplinario
- list_presupuestos, list_oportunidades, list_sig_documents, list_sig_incidents, query_sig_audit_quarter, list_sig_risks.
- search_disciplinary_warnings, query_disciplinary_dashboard, search_disciplinary_employees.

### Tickets, pagos, inventario, monitoreo, formularios
- search_tickets, query_tickets_dashboard, query_payment_calendar, search_assets.
- list_monitoreo_activaciones, lookup_monitoreo_alarm, list_forms, list_form_submissions.
- list_inbox_notifications.

### Reglas
- Prioriza la herramienta del módulo donde está el usuario (contexto de pantalla).
- Montos en colones (₡). Cite periodos exactos.
- Si falta permiso, explíquelo. No uses search_contracts para cosas que no son contratos.`;

export type { ToolDefinition } from "../tools/types";
