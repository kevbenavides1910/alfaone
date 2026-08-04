import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import {
  getSigControlDetail,
  linkSigControl,
  unlinkSigControl,
  updateSigControl,
} from "@/modules/sig";
import { linkControlSchema, updateControlSchema } from "@/modules/sig/validations/controls.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.controles", "view"], errorLabel: "Error consultando control SIG" },
  async ({ params }) => {
    const row = await getSigControlDetail(paramId(await params));
    if (!row) return notFound("Control no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.controles", "edit"], errorLabel: "Error actualizando control SIG" },
  async ({ req, params }) => {
    const parsed = updateControlSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de control inválidos", parsed.error.flatten());
    return ok(await updateSigControl(paramId(await params), parsed.data));
  }
);

export const POST = apiHandler(
  { permission: ["sig.controles", "edit"], errorLabel: "Error vinculando control SIG" },
  async ({ req, params }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;
    const parsed = linkControlSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());

    if (action === "unlink") {
      return ok(await unlinkSigControl(id, parsed.data));
    }
    return ok(await linkSigControl(id, parsed.data));
  }
);
