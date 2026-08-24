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
  reconcileFacturaMensualStatusFromEmisiones,
  serializeFacturaMensual,
} from "@/modules/presupuestos/services/facturacion-cobro";
import { facturaListSerializeInclude } from "@/modules/presupuestos/services/facturacion-includes";
import {
  syncCxcFromFacturaEmision,
  syncCxcFromFacturaMensual,
} from "@/modules/presupuestos/services/sync-cxc-from-factura";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  const { id } = await params;
  try {
    const row = await prisma.facturaMensual.findUnique({
      where: { id },
      include: facturaListSerializeInclude,
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

    const existing = await prisma.facturaMensual.findUnique({
      where: { id },
      include: { emisiones: { select: { id: true, closedAt: true, totalFacturadoNaf: true } } },
    });
    if (!existing) return notFound("Factura mensual no encontrada");

    const emisionId = parsed.data.emisionId?.trim();
    const targetEmision = emisionId
      ? existing.emisiones.find((e) => e.id === emisionId)
      : undefined;
    if (emisionId && !targetEmision) {
      return notFound("Administración no encontrada en esta factura");
    }

    const isolateEmision = Boolean(emisionId) && existing.emisiones.length > 1;
    const isClosed =
      existing.status === "FACTURADO" || existing.status === "COBRADO";

    const metadataFieldsOnly =
      parsed.data.observationLog === undefined &&
      parsed.data.finalNotes === undefined &&
      parsed.data.dueDate === undefined &&
      (parsed.data.invoiceNumber !== undefined ||
        parsed.data.isReajuste !== undefined ||
        parsed.data.servicePeriodFromDate !== undefined ||
        parsed.data.servicePeriodToDate !== undefined ||
        parsed.data.invoiceReceivedAt !== undefined);

    if (isClosed && !metadataFieldsOnly) {
      return badRequest("No se puede editar una factura ya cerrada");
    }

    const data: {
      observationLog?: string;
      finalNotes?: string;
      invoiceNumber?: string | null;
      documentNumber?: string | null;
      servicePeriodFromDate?: Date | null;
      servicePeriodToDate?: Date | null;
      invoiceReceivedAt?: Date | null;
      isReajuste?: boolean;
      dueDate?: Date;
      status?: "EN_PROCESO";
    } = {};
    if (parsed.data.observationLog !== undefined) data.observationLog = parsed.data.observationLog;
    if (parsed.data.finalNotes !== undefined) data.finalNotes = parsed.data.finalNotes;
    if (parsed.data.isReajuste !== undefined) data.isReajuste = parsed.data.isReajuste;
    // documentNumber solo se escribe desde NAF (ligar documento); se ignora en PATCH.
    if (parsed.data.servicePeriodFromDate !== undefined) {
      data.servicePeriodFromDate = parsed.data.servicePeriodFromDate
        ? parseCalendarDateInput(parsed.data.servicePeriodFromDate)
        : null;
    }
    if (parsed.data.servicePeriodToDate !== undefined) {
      data.servicePeriodToDate = parsed.data.servicePeriodToDate
        ? parseCalendarDateInput(parsed.data.servicePeriodToDate)
        : null;
    }

    const invoiceNumber =
      parsed.data.invoiceNumber !== undefined ? parsed.data.invoiceNumber : undefined;
    const invoiceReceivedAt =
      parsed.data.invoiceReceivedAt !== undefined
        ? parsed.data.invoiceReceivedAt
          ? parseCalendarDateInput(parsed.data.invoiceReceivedAt)
          : null
        : undefined;
    const dueDate =
      parsed.data.dueDate !== undefined
        ? parseCalendarDateInput(parsed.data.dueDate)
        : undefined;

    if (!isolateEmision) {
      if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber;
      if (invoiceReceivedAt !== undefined) data.invoiceReceivedAt = invoiceReceivedAt;
      if (dueDate !== undefined) data.dueDate = dueDate;
    }

    if (
      !isClosed &&
      (parsed.data.observationLog !== undefined || parsed.data.dueDate !== undefined) &&
      existing.status === "PENDIENTE"
    ) {
      data.status = "EN_PROCESO";
    }

    const emisionData: {
      invoiceNumber?: string | null;
      invoiceReceivedAt?: Date | null;
      dueDate?: Date;
    } = {};
    if (invoiceNumber !== undefined) emisionData.invoiceNumber = invoiceNumber;
    if (invoiceReceivedAt !== undefined) emisionData.invoiceReceivedAt = invoiceReceivedAt;
    if (dueDate !== undefined) emisionData.dueDate = dueDate;

    if (targetEmision && Object.keys(emisionData).length > 0) {
      await prisma.facturaMensualEmision.update({
        where: { id: targetEmision.id },
        data: emisionData,
      });
    } else if (!isolateEmision && existing.emisiones.length === 1 && Object.keys(emisionData).length > 0) {
      await prisma.facturaMensualEmision.update({
        where: { id: existing.emisiones[0].id },
        data: emisionData,
      });
    }

    const updated = await prisma.facturaMensual.update({
      where: { id },
      data,
      include: facturaListSerializeInclude,
    });

    const shouldSyncCxc =
      parsed.data.isReajuste !== undefined ||
      parsed.data.servicePeriodFromDate !== undefined ||
      parsed.data.servicePeriodToDate !== undefined ||
      parsed.data.invoiceReceivedAt !== undefined ||
      parsed.data.invoiceNumber !== undefined;

    if (shouldSyncCxc) {
      if (targetEmision?.closedAt) {
        const emisionRow = updated.emisiones.find((e) => e.id === targetEmision.id);
        const total =
          emisionRow?.totalFacturadoNaf != null
            ? Number(emisionRow.totalFacturadoNaf)
            : Number(updated.totalCalculated);
        const syncResult = await syncCxcFromFacturaEmision(prisma, id, targetEmision.id, total);
        if (!syncResult.ok && syncResult.code !== "NO_DOCUMENT_NUMBER") {
          console.warn(`[facturacion PATCH] sync CxC emisión: ${syncResult.message}`);
        }
      } else if (isClosed && existing.emisiones.length <= 1) {
        const syncResult = await syncCxcFromFacturaMensual(prisma, id);
        if (!syncResult.ok && syncResult.code !== "NO_DOCUMENT_NUMBER") {
          console.warn(`[facturacion PATCH] sync CxC: ${syncResult.message}`);
        }
      }
      await reconcileFacturaMensualStatusFromEmisiones(prisma, id);
    }

    const serialized = serializeFacturaMensual(
      shouldSyncCxc
        ? await prisma.facturaMensual.findUniqueOrThrow({
            where: { id },
            include: facturaListSerializeInclude,
          })
        : updated
    );

    return ok(serialized);
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

    const result = await closeFacturaMensual(prisma, id, {
      finalNotes: parsed.data.finalNotes,
      isReajuste: parsed.data.isReajuste,
      emisionId: parsed.data.emisionId,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message, result.pending ? { pending: result.pending } : undefined);
    }

    const updated = await prisma.facturaMensual.findUniqueOrThrow({
      where: { id },
      include: facturaListSerializeInclude,
    });
    const serialized = serializeFacturaMensual(updated);

    if (result.emisionId) {
      const emision = serialized.emisiones?.find((e) => e.id === result.emisionId);
      if (emision?.totalCalculated != null) {
        const syncResult = await syncCxcFromFacturaEmision(
          prisma,
          id,
          result.emisionId,
          emision.totalCalculated
        );
        if (!syncResult.ok && syncResult.code !== "NO_DOCUMENT_NUMBER") {
          console.warn(`[facturacion cerrar] sync CxC emisión: ${syncResult.message}`);
        }
      }
    } else if (updated.status === "FACTURADO" || updated.status === "COBRADO") {
      const syncResult = await syncCxcFromFacturaMensual(prisma, id);
      if (!syncResult.ok && syncResult.code !== "NO_DOCUMENT_NUMBER") {
        console.warn(`[facturacion cerrar] sync CxC: ${syncResult.message}`);
      }
    }

    return ok(serialized);
  } catch (e) {
    return serverError("Error al cerrar facturación", e);
  }
}
