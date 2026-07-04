import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { serializeCuentaPorCobrar } from "@/modules/presupuestos/services/cuentas-por-cobrar";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "pending";
  const company = searchParams.get("company")?.trim();

  if (!["pending", "collected", "all"].includes(filter)) {
    return badRequest("Filtro inválido");
  }

  try {
    const statusWhere =
      filter === "pending"
        ? { status: "FACTURADO" as const }
        : filter === "collected"
          ? { status: "COBRADO" as const }
          : { status: { in: ["FACTURADO", "COBRADO"] as const } };

    const rows = await prisma.facturaMensual.findMany({
      where: {
        ...statusWhere,
        ...(company ? { companyCodeCopied: company } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { clientNameCopied: "asc" }],
      include: {
        contract: {
          select: {
            licitacionNo: true,
            hiringType: true,
            clientContacts: {
              orderBy: { sortOrder: "asc" },
              select: {
                name: true,
                jobTitle: true,
                phone: true,
                phone2: true,
                email: true,
                isBillingContact: true,
                sortOrder: true,
              },
            },
          },
        },
        requisitos: { orderBy: { sortOrder: "asc" } },
      },
    });

    return ok(rows.map(serializeCuentaPorCobrar));
  } catch (e) {
    return serverError("Error al listar cuentas por cobrar", e);
  }
}
