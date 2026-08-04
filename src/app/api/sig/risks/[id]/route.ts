import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import { getSigRiskDetail, linkSigRisk, unlinkSigRisk, updateSigRisk } from "@/modules/sig";
import { linkRiskSchema, updateRiskSchema } from "@/modules/sig/validations/risks.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.riesgos", "view"], errorLabel: "Error consultando riesgo SIG" },
  async ({ params }) => {
    const row = await getSigRiskDetail(paramId(await params));
    if (!row) return notFound("Riesgo no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.riesgos", "edit"], errorLabel: "Error actualizando riesgo SIG" },
  async ({ req, params }) => {
    const parsed = updateRiskSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de riesgo inválidos", parsed.error.flatten());
    try {
      return ok(await updateSigRisk(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);

export const POST = apiHandler(
  { permission: ["sig.riesgos", "edit"], errorLabel: "Error vinculando riesgo SIG" },
  async ({ req, params }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;
    const parsed = linkRiskSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());
    try {
      if (action === "unlink") return ok(await unlinkSigRisk(id, parsed.data));
      return ok(await linkSigRisk(id, parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
