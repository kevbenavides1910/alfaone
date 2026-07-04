import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listNafDocuments } from "@/modules/naf-documentos/services/list-naf-documents";
import { nafDocumentosListSchema } from "@/modules/presupuestos/validations/naf-documentos.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.documentos_naf", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const parsed = nafDocumentosListSchema.safeParse({
    periodMonth: searchParams.get("periodMonth") ?? String(now.getMonth() + 1),
    periodYear: searchParams.get("periodYear") ?? String(now.getFullYear()),
    company: searchParams.get("company") ?? undefined,
    tipoDoc: searchParams.get("tipoDoc") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "50",
  });

  if (!parsed.success) {
    return badRequest("Parámetros inválidos", parsed.error.flatten());
  }

  try {
    const data = await listNafDocuments(parsed.data);
    return ok(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al consultar documentos NAF";
    if (message.includes("Oracle NAF no configurado")) {
      return serverError(message, e);
    }
    return serverError("Error al consultar documentos NAF", e);
  }
}
