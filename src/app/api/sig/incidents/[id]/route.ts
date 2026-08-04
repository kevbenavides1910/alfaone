import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import {
  getSigIncidentDetail,
  linkSigIncident,
  unlinkSigIncident,
  updateSigIncident,
} from "@/modules/sig";
import { linkIncidentSchema, updateIncidentSchema } from "@/modules/sig/validations/incidents.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.incidentes", "view"], errorLabel: "Error consultando incidente SIG" },
  async ({ params }) => {
    const row = await getSigIncidentDetail(paramId(await params));
    if (!row) return notFound("Incidente no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.incidentes", "edit"], errorLabel: "Error actualizando incidente SIG" },
  async ({ req, params }) => {
    const parsed = updateIncidentSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de incidente inválidos", parsed.error.flatten());
    try {
      return ok(await updateSigIncident(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);

export const POST = apiHandler(
  { permission: ["sig.incidentes", "edit"], errorLabel: "Error vinculando incidente SIG" },
  async ({ req, params }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;
    const parsed = linkIncidentSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());
    try {
      if (action === "unlink") return ok(await unlinkSigIncident(id, parsed.data));
      return ok(await linkSigIncident(id, parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
