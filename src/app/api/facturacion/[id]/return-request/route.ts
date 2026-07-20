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
import {
  approveFacturaReturnRequest,
  canRequestAmountFacturaReturn,
  canReturnFacturaForDocumentation,
  canReviewFacturaReturnRequest,
  missingApproverConfigMessage,
  rejectFacturaReturnRequest,
  requestAmountFacturaReturn,
  returnFacturaForDocumentation,
  unauthorizedReviewMessage,
} from "@/modules/presupuestos/services/facturacion-invoice-correction";
import {
  facturaAmountReturnRequestSchema,
  facturaDocumentationReturnSchema,
  facturaReturnReviewSchema,
} from "@/modules/presupuestos/validations/facturacion.schema";
import {
  serializeFacturaMensual,
  type Db,
} from "@/modules/presupuestos/services/facturacion-cobro";
import { facturaListSerializeInclude } from "@/modules/presupuestos/services/facturacion-includes";
import { syncCxcFromFacturaMensual } from "@/modules/presupuestos/services/sync-cxc-from-factura";

type Ctx = { params: Promise<{ id: string }> };

async function loadApprover() {
  const settings = await prisma.appFacturacionCobroSettings.findFirst({
    select: {
      invoiceModificationAuthorizedUserId: true,
      invoiceModificationAuthorizedUser: { select: { name: true, email: true } },
    },
  });
  return settings;
}

async function reloadFactura(id: string) {
  const row = await prisma.facturaMensual.findUniqueOrThrow({
    where: { id },
    include: facturaListSerializeInclude,
  });
  return serializeFacturaMensual(row);
}

function mapResult(
  result: { ok: true; facturaId: string } | { ok: false; code: string; message: string }
) {
  if (result.ok) return null;
  if (result.code === "NOT_FOUND") return notFound(result.message);
  return badRequest(result.message);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const action = new URL(req.url).searchParams.get("action");

  try {
    if (action === "documentation") {
      if (!canReturnFacturaForDocumentation(session)) return forbidden();
      const body = await req.json().catch(() => ({}));
      const parsed = facturaDocumentationReturnSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

      const result = await returnFacturaForDocumentation(
        prisma as Db,
        id,
        parsed.data.reason,
        session.user.id
      );
      const err = mapResult(result);
      if (err) return err;
      return ok(await reloadFactura(id));
    }

    if (action === "amount") {
      if (!canRequestAmountFacturaReturn(session)) return forbidden();
      const body = await req.json();
      const parsed = facturaAmountReturnRequestSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

      const result = await requestAmountFacturaReturn(
        prisma as Db,
        id,
        parsed.data,
        session.user.id,
        session.user.name
      );
      const err = mapResult(result);
      if (err) return err;
      return ok(await reloadFactura(id));
    }

    if (action === "approve" || action === "reject") {
      if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();
      const settings = await loadApprover();
      if (!settings?.invoiceModificationAuthorizedUserId) {
        return badRequest(missingApproverConfigMessage());
      }
      if (
        !canReviewFacturaReturnRequest(session.user.id, {
          invoiceModificationAuthorizedUserId: settings.invoiceModificationAuthorizedUserId,
        })
      ) {
        return forbidden(
          unauthorizedReviewMessage(settings.invoiceModificationAuthorizedUser ?? null)
        );
      }

      const body = await req.json().catch(() => ({}));
      const parsed = facturaReturnReviewSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

      const result =
        action === "approve"
          ? await approveFacturaReturnRequest(prisma as Db, id, session.user.id)
          : await rejectFacturaReturnRequest(
              prisma as Db,
              id,
              session.user.id,
              parsed.data.reviewNote
            );
      const err = mapResult(result);
      if (err) return err;
      await syncCxcFromFacturaMensual(prisma, id);
      return ok(await reloadFactura(id));
    }

    return badRequest("Acción no reconocida. Use ?action=documentation|amount|approve|reject");
  } catch (e) {
    return serverError("Error al procesar solicitud de corrección", e);
  }
}
