import { listForms } from "@/modules/formularios/services/forms";
import { listSubmissions } from "@/modules/formularios/services/submissions";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function formulariosTools(): SyntraTool[] {
  return [
    {
      permission: { key: "formularios.catalogo", level: "view" },
      definition: toolDef(
        "list_forms",
        "Catálogo de formularios/cuestionarios disponibles.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            activeOnly: { type: "boolean" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Listando formularios…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 15, 25);
        const result = await listForms({
          q: strArg(args, "q") || undefined,
          activeOnly: args.activeOnly === true,
          pageSize: limit,
        });
        return {
          formularios: result.rows.map((f) => ({
            id: f.id,
            code: f.code,
            title: f.title,
            isActive: f.isActive,
            submissions: f._count.submissions,
          })),
          total: result.total,
          fuente: "Formularios Alfa One",
        };
      },
    },
    {
      permission: { key: "formularios.resultados", level: "view" },
      definition: toolDef(
        "list_form_submissions",
        "Respuestas enviadas a un formulario (requiere formId del catálogo).",
        {
          type: "object",
          properties: {
            formId: { type: "string" },
            limit: { type: "integer" },
          },
          required: ["formId"],
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando respuestas de formulario…",
      handler: async (_session, args) => {
        const formId = strArg(args, "formId");
        if (!formId) return { error: "Indique formId." };
        const limit = intArg(args, "limit", 15, 25);
        const result = await listSubmissions(formId, 1, limit);
        return {
          respuestas: result.rows.map((s) => ({
            id: s.id,
            user: s.user?.name ?? null,
            score: s.scorePercent,
            passed: s.passed,
            submittedAt: s.submittedAt?.toISOString() ?? null,
          })),
          total: result.total,
          fuente: "Formularios — resultados",
        };
      },
    },
  ];
}
