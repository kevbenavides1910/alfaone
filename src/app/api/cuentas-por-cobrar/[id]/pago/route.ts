import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { confirmPaymentSchema } from "@/modules/presupuestos/validations/cuentas-por-cobrar.schema";
import {
  confirmFacturaPayment,
  serializeCuentaPorCobrar,
} from "@/modules/presupuestos/services/cuentas-por-cobrar";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cxc", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = confirmPaymentSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await confirmFacturaPayment(prisma, id, parsed.data.received);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message);
    }

    const updated = await prisma.facturaMensual.findUniqueOrThrow({
      where: { id },
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

    return ok(serializeCuentaPorCobrar(updated));
  } catch (e) {
    return serverError("Error al registrar pago", e);
  }
}
