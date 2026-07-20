import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import {
  cxcDocumentInclude,
  cxcListWhere,
  serializeCuentaPorCobrar,
} from "@/modules/presupuestos/services/cuentas-por-cobrar";
import { cuentasPorCobrarListSchema } from "@/modules/presupuestos/validations/cuentas-por-cobrar.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const companyValues = searchParams.getAll("company").map((c) => c.trim()).filter(Boolean);
  const raw = {
    filter: searchParams.get("filter") ?? "pending",
    company: companyValues[0] ?? searchParams.get("company") ?? undefined,
    companies: companyValues.length > 0 ? companyValues : undefined,
    client: searchParams.get("client") ?? undefined,
    licitacion: searchParams.get("licitacion") ?? undefined,
    issuedFrom: searchParams.get("issuedFrom") ?? undefined,
    issuedTo: searchParams.get("issuedTo") ?? undefined,
    expectedPaymentFrom: searchParams.get("expectedPaymentFrom") ?? undefined,
    expectedPaymentTo: searchParams.get("expectedPaymentTo") ?? undefined,
    receivedFrom: searchParams.get("receivedFrom") ?? undefined,
    receivedTo: searchParams.get("receivedTo") ?? undefined,
  };

  const parsed = cuentasPorCobrarListSchema.safeParse(raw);
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  try {
    const rows = await prisma.cxcDocumento.findMany({
      where: cxcListWhere(parsed.data),
      orderBy: [{ dueDate: "asc" }, { clientName: "asc" }],
      include: cxcDocumentInclude,
    });

    return ok(rows.map(serializeCuentaPorCobrar));
  } catch (e) {
    return serverError("Error al listar cuentas por cobrar", e);
  }
}
