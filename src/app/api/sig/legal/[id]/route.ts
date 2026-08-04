import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import {
  getSigLegalRequirementDetail,
  linkSigLegalRequirement,
  unlinkSigLegalRequirement,
  updateSigLegalRequirement,
} from "@/modules/sig";
import {
  linkLegalRequirementSchema,
  updateLegalRequirementSchema,
} from "@/modules/sig/validations/legal.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.legales", "view"], errorLabel: "Error consultando requisito legal SIG" },
  async ({ params }) => {
    const row = await getSigLegalRequirementDetail(paramId(await params));
    if (!row) return notFound("Requisito legal no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.legales", "edit"], errorLabel: "Error actualizando requisito legal SIG" },
  async ({ req, params }) => {
    const parsed = updateLegalRequirementSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos legales inválidos", parsed.error.flatten());
    try {
      return ok(await updateSigLegalRequirement(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);

export const POST = apiHandler(
  { permission: ["sig.legales", "edit"], errorLabel: "Error vinculando requisito legal SIG" },
  async ({ req, params }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;
    const parsed = linkLegalRequirementSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());
    try {
      if (action === "unlink") return ok(await unlinkSigLegalRequirement(id, parsed.data));
      return ok(await linkSigLegalRequirement(id, parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
