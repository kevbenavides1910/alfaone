import { listAuditQuarterDashboard } from "@/modules/sig/services/audits";
import { getCapaEfficacyDashboard } from "@/modules/sig/services/capa-dashboard";
import { listSigDocuments } from "@/modules/sig/services/documents-list";
import { listSigIncidents } from "@/modules/sig/services/incidents";
import { listSigRisks } from "@/modules/sig/services/risks";
import { getSigProcedureByCodeOrId } from "@/modules/sig/services/procedure-content";
import { listSigRevisionReminders } from "@/modules/sig/services/revision-reminders";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function sigTools(): SyntraTool[] {
  return [
    {
      permission: { key: "sig.biblioteca", level: "view" },
      definition: toolDef(
        "list_sig_documents",
        "Busca documentos del SIG por código, título o texto indexado (OCR). Devuelve snippet del hallazgo.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            status: {
              type: "string",
              enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SUPERSEDED", "OBSOLETE"],
            },
            process_id: { type: "string" },
            document_type_id: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Buscando documentos SIG…",
      handler: async (_session, args) => {
        const result = await listSigDocuments({
          q: strArg(args, "q") || undefined,
          status: (strArg(args, "status") || undefined) as
            | "DRAFT"
            | "PENDING_APPROVAL"
            | "APPROVED"
            | "REJECTED"
            | "SUPERSEDED"
            | "OBSOLETE"
            | undefined,
          processId: strArg(args, "process_id") || undefined,
          documentTypeId: strArg(args, "document_type_id") || undefined,
          pageSize: intArg(args, "limit", 15, 25),
        });
        return {
          documentos: result.rows.map((d) => ({
            id: d.id,
            code: d.code,
            title: d.title,
            status: d.status,
            version: d.currentVersion?.versionLabel ?? null,
            process: d.process?.name ?? null,
            snippet: d.searchMatch?.snippet ?? null,
            matchedIn: d.searchMatch?.matchedIn ?? null,
          })),
          total: result.total,
          fuente: "Biblioteca SIG",
        };
      },
    },
    {
      permission: { key: "sig.biblioteca", level: "view" },
      definition: toolDef(
        "list_sig_vigencias",
        "Lista procedimientos/documentos SIG por renovar o con vigencia vencida (días hasta revisión).",
        {
          type: "object",
          properties: {
            within_days: {
              type: "integer",
              description: "Ventana en días (default 30).",
            },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando vigencias SIG…",
      handler: async (_session, args) => {
        const withinDays = intArg(args, "within_days", 30, 365);
        const limit = intArg(args, "limit", 25, 50);
        const rows = await listSigRevisionReminders(withinDays);
        return {
          withinDays,
          total: rows.length,
          overdue: rows.filter((r) => r.isOverdue).length,
          documentos: rows.slice(0, limit).map((r) => ({
            id: r.documentId,
            code: r.code,
            title: r.title,
            daysUntilDue: r.daysUntilDue,
            isOverdue: r.isOverdue,
            nextRevisionDue: r.nextRevisionDue,
            lastRevisionDate: r.lastRevisionDate,
          })),
          fuente: "Vigencias SIG",
        };
      },
    },
    {
      permission: { key: "sig.auditorias", level: "view" },
      definition: toolDef(
        "query_sig_capa",
        "Tablero CAPA: hallazgos abiertos, acciones vencidas, % cierre y eficacia. Filtra por año y proceso.",
        {
          type: "object",
          properties: {
            year: { type: "integer" },
            process_id: { type: "string" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando tablero CAPA SIG…",
      handler: async (_session, args) => {
        const data = await getCapaEfficacyDashboard({
          year: typeof args.year === "number" ? args.year : undefined,
          processId: strArg(args, "process_id") || undefined,
        });
        return {
          year: data.year,
          findings: {
            open: data.findings.open,
            closed: data.findings.closed,
            closurePct: data.findings.closurePct,
            bySeverity: data.findings.bySeverity,
          },
          actions: {
            open: data.actions.open,
            overdue: data.actions.overdue,
            completionPct: data.actions.completionPct,
            overdueTitles: data.actions.overdueRows.slice(0, 10).map((a) => ({
              title: a.title,
              dueDate: a.dueDate,
              procedure: a.finding.audit.procedure.code,
              responsible: a.responsibleUser?.name ?? null,
            })),
          },
          efficacy: data.efficacy,
          fuente: "Tablero CAPA SIG",
        };
      },
    },
    {
      permission: { key: "sig.biblioteca", level: "view" },
      definition: toolDef(
        "get_sig_procedure",
        "Obtiene el procedimiento SIG en prosa: objetivo, alcance, responsabilidades, definiciones y etapas numeradas. Buscar por código (ej. P-FI-04) o id del documento. Útil para resúmenes.",
        {
          type: "object",
          properties: {
            code_or_id: {
              type: "string",
              description: "Código del documento SIG o id interno.",
            },
          },
          required: ["code_or_id"],
          additionalProperties: false,
        },
      ),
      describeCall: (args) =>
        `Leyendo procedimiento SIG (${strArg(args, "code_or_id") || "…"})…`,
      handler: async (_session, args) => {
        const codeOrId = strArg(args, "code_or_id");
        if (!codeOrId) return { error: "Indique code_or_id (código o id del documento)." };
        const proc = await getSigProcedureByCodeOrId(codeOrId);
        if (!proc) return { error: "Documento o procedimiento no encontrado." };
        return {
          code: proc.code,
          title: proc.title,
          version: proc.versionLabel,
          status: proc.versionStatus,
          hasStructuredContent: proc.hasStructuredContent,
          objetivo: proc.body?.objective ?? null,
          alcance: proc.body?.scope ?? null,
          responsabilidades: proc.body?.responsibilities ?? null,
          definiciones: proc.body?.definitions ?? null,
          etapas: proc.activities.map((a) => ({
            codigo: a.code,
            nombre: a.name,
            descripcion: a.description.slice(0, 500),
            documentos: a.documents,
            responsable: a.responsible,
          })),
          secciones: proc.sections.map((s) => ({
            clave: s.sectionKey,
            titulo: s.number ? `${s.number}. ${s.title}` : s.title,
            tipo: s.kind,
            cuerpo: s.kind === "prose" ? s.body.slice(0, 600) : null,
          })),
          diagramaFlujo: Boolean(proc.flowchartUrl),
          extractoArchivo: null,
          fuente: "Procedimiento SIG (prosa)",
        };
      },
    },
    {
      permission: { key: "sig.incidentes", level: "view" },
      definition: toolDef(
        "list_sig_incidents",
        "Lista incidentes del SIG (seguridad, DDHH) por texto, tipo o estado.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            status: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando incidentes SIG…",
      handler: async (_session, args) => {
        const rows = await listSigIncidents({
          q: strArg(args, "q") || undefined,
          status: (strArg(args, "status") || undefined) as
            | "OPEN"
            | "IN_PROGRESS"
            | "CLOSED"
            | "DISMISSED"
            | undefined,
        });
        const limit = intArg(args, "limit", 20, 25);
        return {
          incidentes: rows.slice(0, limit).map((i) => ({
            code: i.code,
            title: i.title,
            type: i.type,
            status: i.status,
            trafficLight: i.trafficLight,
            open: i.open,
          })),
          total: rows.length,
          fuente: "Incidentes SIG",
        };
      },
    },
    {
      permission: { key: "sig.auditorias", level: "view" },
      definition: toolDef(
        "query_sig_audit_quarter",
        "Dashboard trimestral de auditorías SIG: cobertura de procedimientos vs asignadas.",
        {
          type: "object",
          properties: {
            year: { type: "integer" },
            quarter: { type: "integer", description: "1-4" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando auditorías SIG del trimestre…",
      handler: async (_session, args) => {
        const data = await listAuditQuarterDashboard({
          year: typeof args.year === "number" ? args.year : undefined,
          quarter: typeof args.quarter === "number" ? args.quarter : undefined,
        });
        return { ...data, fuente: "Auditorías SIG" };
      },
    },
    {
      permission: { key: "sig.riesgos", level: "view" },
      definition: toolDef(
        "list_sig_risks",
        "Matriz de riesgos y oportunidades del SIG.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            status: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando riesgos SIG…",
      handler: async (_session, args) => {
        const rows = await listSigRisks({
          q: strArg(args, "q") || undefined,
          status: (strArg(args, "status") || undefined) as "OPEN" | "MITIGATED" | "CLOSED" | undefined,
        });
        const limit = intArg(args, "limit", 20, 25);
        return {
          riesgos: rows.slice(0, limit).map((r) => ({
            code: r.code,
            title: r.title,
            kind: r.kind,
            status: r.status,
            inherentLevel: r.inherentLevel,
            residualLevel: r.residualLevel,
          })),
          total: rows.length,
          fuente: "Riesgos SIG",
        };
      },
    },
  ];
}
