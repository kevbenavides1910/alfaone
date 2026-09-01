import { listAuditQuarterDashboard } from "@/modules/sig/services/audits";
import { listSigDocuments } from "@/modules/sig/services/documents-list";
import { listSigIncidents } from "@/modules/sig/services/incidents";
import { listSigRisks } from "@/modules/sig/services/risks";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function sigTools(): SyntraTool[] {
  return [
    {
      permission: { key: "sig.biblioteca", level: "view" },
      definition: toolDef(
        "list_sig_documents",
        "Busca documentos del SIG por código, título o texto.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            status: { type: "string", enum: ["DRAFT", "IN_REVIEW", "APPROVED", "OBSOLETE"] },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Buscando documentos SIG…",
      handler: async (_session, args) => {
        const result = await listSigDocuments({
          q: strArg(args, "q") || undefined,
          status: (strArg(args, "status") || undefined) as "DRAFT" | "IN_REVIEW" | "APPROVED" | "OBSOLETE" | undefined,
          pageSize: intArg(args, "limit", 15, 25),
        });
        return {
          documentos: result.rows.map((d) => ({
            code: d.code,
            title: d.title,
            status: d.status,
            version: d.currentVersion?.versionNumber ?? null,
            process: d.process?.name ?? null,
          })),
          total: result.total,
          fuente: "Biblioteca SIG",
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
