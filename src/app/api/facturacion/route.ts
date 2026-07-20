import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { serializeFacturaMensual } from "@/modules/presupuestos/services/facturacion-cobro";
import { facturaListSerializeInclude } from "@/modules/presupuestos/services/facturacion-includes";
import { prismaDateRange } from "@/modules/presupuestos/services/list-date-filters";
import { facturacionListSchema } from "@/modules/presupuestos/validations/facturacion.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const companyValues = searchParams.getAll("company").map((c) => c.trim()).filter(Boolean);
  const raw = {
    periodMonth: searchParams.get("periodMonth") ?? String(now.getMonth() + 1),
    periodYear: searchParams.get("periodYear") ?? String(now.getFullYear()),
    company: companyValues[0] ?? searchParams.get("company") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    client: searchParams.get("client") ?? undefined,
    licitacion: searchParams.get("licitacion") ?? undefined,
    expectedFrom: searchParams.get("expectedFrom") ?? undefined,
    expectedTo: searchParams.get("expectedTo") ?? undefined,
    issuedFrom: searchParams.get("issuedFrom") ?? undefined,
    issuedTo: searchParams.get("issuedTo") ?? undefined,
    receivedFrom: searchParams.get("receivedFrom") ?? undefined,
    receivedTo: searchParams.get("receivedTo") ?? undefined,
  };

  const parsed = facturacionListSchema.safeParse(raw);
  if (!parsed.success) return badRequest("Parámetros inválidos", parsed.error.flatten());

  const q = parsed.data;

  try {
    const dateFilters = [
      prismaDateRange("expectedIssueDate", q.expectedFrom, q.expectedTo),
      prismaDateRange("closedAt", q.issuedFrom, q.issuedTo),
      prismaDateRange("invoiceReceivedAt", q.receivedFrom, q.receivedTo),
    ].filter(Boolean) as Prisma.FacturaMensualWhereInput[];

    const rows = await prisma.facturaMensual.findMany({
      where: {
        periodMonth: q.periodMonth,
        periodYear: q.periodYear,
        ...(companyValues.length === 1
          ? { companyCodeCopied: companyValues[0] }
          : companyValues.length > 1
            ? { companyCodeCopied: { in: companyValues } }
            : q.company
              ? { companyCodeCopied: q.company }
              : {}),
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.client
          ? { clientNameCopied: { contains: q.client, mode: "insensitive" } }
          : {}),
        ...(q.licitacion
          ? { contract: { licitacionNo: { contains: q.licitacion, mode: "insensitive" } } }
          : {}),
        ...(dateFilters.length > 0 ? { AND: dateFilters } : {}),
      },
      orderBy: [{ clientNameCopied: "asc" }],
      include: facturaListSerializeInclude,
    });

    return ok(rows.map(serializeFacturaMensual));
  } catch (e) {
    return serverError("Error al listar facturación", e);
  }
}
