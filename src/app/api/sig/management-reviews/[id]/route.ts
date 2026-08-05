import { apiHandler } from "@/lib/api/handler";
import { badRequest, notFound, ok } from "@/lib/api/response";
import {
  createSigManagementReviewAction,
  deleteSigManagementReviewAction,
  getSigManagementReviewDetail,
  linkSigManagementReview,
  unlinkSigManagementReview,
  updateSigManagementReview,
  updateSigManagementReviewAction,
  updateSigManagementReviewInput,
} from "@/modules/sig";
import {
  createManagementReviewActionSchema,
  linkManagementReviewSchema,
  updateManagementReviewActionSchema,
  updateManagementReviewInputSchema,
  updateManagementReviewSchema,
} from "@/modules/sig/validations/management-reviews.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const GET = apiHandler(
  { permission: ["sig.revisionDireccion", "view"], errorLabel: "Error consultando revisión por la dirección" },
  async ({ params }) => {
    const row = await getSigManagementReviewDetail(paramId(await params));
    if (!row) return notFound("Revisión no encontrada");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.revisionDireccion", "edit"], errorLabel: "Error actualizando revisión por la dirección" },
  async ({ req, params }) => {
    const parsed = updateManagementReviewSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de revisión inválidos", parsed.error.flatten());
    try {
      return ok(await updateSigManagementReview(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);

export const POST = apiHandler(
  {
    permission: ["sig.revisionDireccion", "edit"],
    errorLabel: "Error actualizando vínculos/acciones de revisión",
  },
  async ({ req, params }) => {
    const id = paramId(await params);
    const body = await req.json();
    const action = body?.action as string | undefined;

    try {
      if (action === "update-input") {
        const parsed = updateManagementReviewInputSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos de entrada inválidos", parsed.error.flatten());
        return ok(await updateSigManagementReviewInput(id, parsed.data));
      }
      if (action === "create-action") {
        const parsed = createManagementReviewActionSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos de acción inválidos", parsed.error.flatten());
        return ok(await createSigManagementReviewAction(id, parsed.data));
      }
      if (action === "update-action") {
        const actionId = body?.actionId as string | undefined;
        if (!actionId) return badRequest("actionId requerido");
        const parsed = updateManagementReviewActionSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos de acción inválidos", parsed.error.flatten());
        return ok(await updateSigManagementReviewAction(id, actionId, parsed.data));
      }
      if (action === "delete-action") {
        const actionId = body?.actionId as string | undefined;
        if (!actionId) return badRequest("actionId requerido");
        return ok(await deleteSigManagementReviewAction(id, actionId));
      }
      if (action === "unlink") {
        const parsed = linkManagementReviewSchema.safeParse(body);
        if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());
        return ok(await unlinkSigManagementReview(id, parsed.data));
      }

      const parsed = linkManagementReviewSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos de vínculo inválidos", parsed.error.flatten());
      return ok(await linkSigManagementReview(id, parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
