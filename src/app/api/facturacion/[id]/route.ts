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
  facturaMensualUpdateSchema,
  cerrarFacturacionSchema,
} from "@/modules/presupuestos/validations/facturacion.schema";
import {
  closeFacturaMensual,
  parseCalendarDateInput,
  serializeFacturaMensual,
} from "@/modules/presupuestos/services/facturacion-cobro";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  const { id } = await params;
  try {
    const row = await prisma.facturaMensual.findUnique({
      where: { id },
      include: {
        contract: { select: { licitacionNo: true } },
        requisitos: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!row) return notFound("Factura mensual no encontrada");
    return ok(serializeFacturaMensual(row));
  } catch (e) {
    return serverError("Error al obtener factura", e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = facturaMensualUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const existing = await prisma.facturaMensual.findUnique({ where: { id } });
    if (!existing) return notFound("Factura mensual no encontrada");

    const isClosed =
      existing.status === "FACTURADO" || existing.status === "COBRADO";
    const onlyInvoiceNumber =
      parsed.data.invoiceNumber !== undefined &&
      parsed.data.observationLog === undefined &&
      parsed.data.finalNotes === undefined &&
      parsed.data.dueDate === undefined;

    if (isClosed && !onlyInvoiceNumber) {
      return badRequest("No se puede editar una factura ya cerrada");
    }

    const data: {
      observationLog?: string;
      finalNotes?: string;
      invoiceNumber?: string | null;
      dueDate?: Date;
      status?: "EN_PROCESO";
    } = {};
    if (parsed.data.observationLog !== undefined) data.observationLog = parsed.data.observationLog;
    if (parsed.data.finalNotes !== undefined) data.finalNotes = parsed.data.finalNotes;
    if (parsed.data.invoiceNumber !== undefined) {
      data.invoiceNumber = parsed.data.invoiceNumber;
    }
    if (parsed.data.dueDate !== undefined) {
      data.dueDate = parseCalendarDateInput(parsed.data.dueDate);
    }
    if (
      !isClosed &&
      (parsed.data.observationLog !== undefined || parsed.data.dueDate !== undefined) &&
      existing.status === "PENDIENTE"
    ) {
      data.status = "EN_PROCESO";
    }

    const updated = await prisma.facturaMensual.update({
      where: { id },
      data,
      include: {
        contract: { select: { licitacionNo: true } },
        requisitos: { orderBy: { sortOrder: "asc" } },
      },
    });

    return ok(serializeFacturaMensual(updated));
  } catch (e) {
    return serverError("Error al actualizar factura", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  const { id } = await params;
  const action = new URL(req.url).searchParams.get("action");
  if (action !== "cerrar") return badRequest("Acción no reconocida. Use ?action=cerrar");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = cerrarFacturacionSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const result = await closeFacturaMensual(prisma, id, parsed.data.finalNotes);
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message, result.pending ? { pending: result.pending } : undefined);
    }

    const updated = await prisma.facturaMensual.findUniqueOrThrow({
      where: { id },
      include: {
        contract: { select: { licitacionNo: true } },
        requisitos: { orderBy: { sortOrder: "asc" } },
      },
    });

    return ok(serializeFacturaMensual(updated));
  } catch (e) {
    return serverError("Error al cerrar facturación", e);
  }
}
