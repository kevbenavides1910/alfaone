import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import {
  getSigRequirementDetail,
  linkRequirementDocument,
  linkRequirementProcess,
  unlinkRequirementDocument,
  unlinkRequirementProcess,
  updateSigRequirement,
} from "@/modules/sig";
import {
  linkRequirementDocumentSchema,
  linkRequirementProcessSchema,
  updateRequirementSchema,
} from "@/modules/sig/validations/requirements.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.requisitos", "view"], errorLabel: "Error consultando requisito SIG" },
  async ({ params }) => {
    const row = await getSigRequirementDetail(paramId(await params));
    if (!row) return notFound("Requisito no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.requisitos", "edit"], errorLabel: "Error actualizando requisito SIG" },
  async ({ req, params }) => {
    const parsed = updateRequirementSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de requisito inválidos", parsed.error.flatten());
    return ok(await updateSigRequirement(paramId(await params), parsed.data));
  }
);

export const POST = apiHandler(
  { permission: ["sig.requisitos", "edit"], errorLabel: "Error vinculando requisito SIG" },
  async ({ req, params }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;

    if (action === "link-process") {
      const parsed = linkRequirementProcessSchema.safeParse(body);
      if (!parsed.success) return badRequest("Proceso inválido", parsed.error.flatten());
      return ok(await linkRequirementProcess(id, parsed.data.processId));
    }
    if (action === "unlink-process") {
      const parsed = linkRequirementProcessSchema.safeParse(body);
      if (!parsed.success) return badRequest("Proceso inválido", parsed.error.flatten());
      await unlinkRequirementProcess(id, parsed.data.processId);
      return ok({ unlinked: true });
    }
    if (action === "link-document") {
      const parsed = linkRequirementDocumentSchema.safeParse(body);
      if (!parsed.success) return badRequest("Documento inválido", parsed.error.flatten());
      return ok(await linkRequirementDocument(id, parsed.data.documentId));
    }
    if (action === "unlink-document") {
      const parsed = linkRequirementDocumentSchema.safeParse(body);
      if (!parsed.success) return badRequest("Documento inválido", parsed.error.flatten());
      await unlinkRequirementDocument(id, parsed.data.documentId);
      return ok({ unlinked: true });
    }
    return badRequest("Acción no reconocida");
  }
);
