import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { badRequest, noContent, notFound, ok, serverError } from "@/lib/api/response";
import {
  deleteLegalDocument,
  getLegalDocument,
  markLegalDocumentPaid,
  updateLegalDocument,
} from "@/modules/documentos-legales/services/documents";
import { LegalDocumentError } from "@/modules/documentos-legales/services/errors";
import {
  legalDocumentBodySchema,
  markPaidSchema,
  zodErrorMessage,
} from "@/modules/documentos-legales/validations/document.schema";

type Ctx = { params: Promise<{ id: string }> };

function httpError(error: unknown, fallback: string) {
  if (error instanceof LegalDocumentError) {
    return error.code === "NOT_FOUND" ? notFound(error.message) : badRequest(error.message);
  }
  return serverError(fallback, error);
}

export const GET = withPermission(async (_req: NextRequest, ctx) => {
  try {
    return ok(await getLegalDocument(ctx.params.id));
  } catch (error) {
    return httpError(error, "Error al leer el documento legal");
  }
}, "documentosLegales.calendario", "view") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const PATCH = withPermission(async (req: NextRequest, ctx) => {
  try {
    const userId = ctx.session.user?.id;
    if (!userId) return badRequest("Sesión sin usuario");
    const body: unknown = await req.json();
    const paidOnly = markPaidSchema.safeParse(body);
    if (paidOnly.success) {
      const updated = await markLegalDocumentPaid(ctx.params.id, paidOnly.data.paid, userId);
      return ok(updated);
    }
    const parsed = legalDocumentBodySchema.safeParse(body);
    if (!parsed.success) return badRequest(zodErrorMessage(parsed.error));
    const updated = await updateLegalDocument(ctx.params.id, parsed.data, userId);
    return ok(updated);
  } catch (error) {
    return httpError(error, "Error al actualizar el documento legal");
  }
}, "documentosLegales.calendario", "edit") as (req: NextRequest, ctx: Ctx) => Promise<Response>;

export const DELETE = withPermission(async (_req: NextRequest, ctx) => {
  try {
    await deleteLegalDocument(ctx.params.id);
    return noContent();
  } catch (error) {
    return httpError(error, "Error al eliminar el documento legal");
  }
}, "documentosLegales.calendario", "admin") as (req: NextRequest, ctx: Ctx) => Promise<Response>;
