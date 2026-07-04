import type { Session } from "next-auth";
import { unlink } from "fs/promises";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import { hasPermission } from "@/lib/permissions/check";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { returnFacturaMensual, applyApprovedAmountChange, type Db } from "@/modules/presupuestos/services/facturacion-cobro";
import { FACTURACION_UPLOAD_ROOT } from "@/modules/presupuestos/services/facturacion-uploads";

export type FacturaCorrectionKind = "DOCUMENTATION" | "AMOUNT";

export const facturaReturnReasonSchema = z
  .string()
  .trim()
  .min(3, "La justificación es obligatoria (mínimo 3 caracteres)")
  .max(4000, "La justificación no puede superar 4000 caracteres");

export const facturaAmountReturnRequestSchema = z.object({
  reason: facturaReturnReasonSchema,
  requestedSubtotal: z
    .number({ invalid_type_error: "Indique el nuevo subtotal" })
    .finite("Indique el nuevo subtotal")
    .positive("El nuevo subtotal debe ser mayor a cero")
    .max(999_999_999_999.99, "El monto es demasiado alto"),
});

export type FacturaReturnRequestEvidence = {
  path: string;
  fileName: string;
  mimeType: string;
};

export type AmountFacturaReturnRequestInput = {
  reason: string;
  requestedSubtotal: number;
  evidence?: FacturaReturnRequestEvidence | null;
};

export const facturaDocumentationReturnReasonSchema = z
  .string()
  .trim()
  .max(4000, "La observación no puede superar 4000 caracteres")
  .optional();

export type FacturaCorrectionAuthSettings = {
  invoiceModificationAuthorizedUserId: string | null;
};

/** Regresión por documentación: cualquier usuario con edición en facturación. */
export function canReturnFacturaForDocumentation(session: Session | null): boolean {
  return hasPermission(session, "facturacion.cobro", "edit");
}

/** Solicitud de regresión por monto: admin en facturación. */
export function canRequestAmountFacturaReturn(session: Session | null): boolean {
  return hasPermission(session, "facturacion.cobro", "admin");
}

export function canReviewFacturaReturnRequest(
  sessionUserId: string | undefined,
  settings: FacturaCorrectionAuthSettings
): boolean {
  if (!sessionUserId) return false;
  const approverId = settings.invoiceModificationAuthorizedUserId?.trim();
  if (!approverId) return false;
  return sessionUserId === approverId;
}

export function missingApproverConfigMessage(): string {
  return "Configure el usuario que aprueba cambios de monto en Facturación → Configuración de correo de cobro.";
}

export function unauthorizedReviewMessage(
  authorizedUser?: { name: string; email: string } | null
): string {
  if (authorizedUser) {
    return `Solo ${authorizedUser.name} (${authorizedUser.email}) puede aprobar o rechazar solicitudes de cambio de monto.`;
  }
  return "Solo el usuario configurado para aprobar cambios de monto puede revisar esta solicitud.";
}

export type FacturaReturnRequestResult =
  | { ok: true; facturaId: string }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "NOT_FACTURADO"
        | "ALREADY_COBRADO"
        | "INVALID_REASON"
        | "REQUEST_PENDING"
        | "NO_REQUEST"
        | "INVALID_STATUS";
      message: string;
    };

function assertFacturaReturnable(
  factura: { status: string; returnRequestStatus: string | null } | null
): FacturaReturnRequestResult | null {
  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }
  if (factura.status === "COBRADO") {
    return {
      ok: false,
      code: "ALREADY_COBRADO",
      message: "No se puede regresar una factura ya cobrada",
    };
  }
  if (factura.status !== "FACTURADO") {
    return {
      ok: false,
      code: "NOT_FACTURADO",
      message: "Solo se puede regresar una factura en estado Facturado",
    };
  }
  if (factura.returnRequestStatus === "PENDING") {
    return {
      ok: false,
      code: "REQUEST_PENDING",
      message: "Ya existe una solicitud de cambio de monto pendiente de aprobación",
    };
  }
  return null;
}

function formatSubtotalForLog(value: number): string {
  return value.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const clearedReturnRequestFields = {
  returnRequestStatus: null,
  returnRequestType: null,
  returnRequestReason: null,
  returnRequestRequestedAt: null,
  returnRequestRequestedById: null,
  returnRequestReviewedAt: null,
  returnRequestReviewedById: null,
  returnRequestReviewNote: null,
  returnRequestRequestedSubtotal: null,
  returnRequestEvidencePath: null,
  returnRequestEvidenceFileName: null,
  returnRequestEvidenceMimeType: null,
} as const;

export async function deleteFacturaReturnRequestEvidence(
  evidencePath: string | null | undefined
): Promise<void> {
  if (!evidencePath?.trim()) return;
  const abs = resolveUnderRoot(FACTURACION_UPLOAD_ROOT, evidencePath);
  if (abs) {
    await unlink(abs).catch(() => undefined);
  }
}

export async function returnFacturaForDocumentation(
  db: Db,
  facturaId: string,
  reason: string | undefined,
  returnedById: string
): Promise<FacturaReturnRequestResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    select: { status: true, returnRequestStatus: true },
  });
  const block = assertFacturaReturnable(factura);
  if (block) return block;

  const trimmedReason = reason?.trim() || "Corrección de documentación";
  return returnFacturaMensual(db, facturaId, trimmedReason, returnedById, "DOCUMENTATION");
}

export async function requestAmountFacturaReturn(
  db: Db,
  facturaId: string,
  input: AmountFacturaReturnRequestInput,
  requestedById: string,
  requestedByName?: string | null
): Promise<FacturaReturnRequestResult> {
  const parsed = facturaAmountReturnRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_REASON",
      message: parsed.error.errors[0]?.message ?? "Datos de solicitud inválidos",
    };
  }

  const trimmedReason = parsed.data.reason.trim();
  const requestedSubtotal = parsed.data.requestedSubtotal;

  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    select: {
      status: true,
      observationLog: true,
      returnRequestStatus: true,
      subtotalCopied: true,
      returnRequestEvidencePath: true,
    },
  });
  const block = assertFacturaReturnable(factura);
  if (block) return block;

  await deleteFacturaReturnRequestEvidence(factura!.returnRequestEvidencePath);

  const requester = requestedByName?.trim() || "usuario";
  const now = new Date();
  const currentSubtotal = Number(factura!.subtotalCopied);
  const logLine = `[${now.toLocaleDateString("es-CR")}] Solicitud de cambio de monto (${requester}): subtotal ${formatSubtotalForLog(currentSubtotal)} → ${formatSubtotalForLog(requestedSubtotal)}. ${trimmedReason}`;

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: {
      returnRequestStatus: "PENDING",
      returnRequestType: "AMOUNT",
      returnRequestReason: trimmedReason,
      returnRequestRequestedSubtotal: new Decimal(requestedSubtotal.toFixed(2)),
      returnRequestEvidencePath: input.evidence?.path ?? null,
      returnRequestEvidenceFileName: input.evidence?.fileName ?? null,
      returnRequestEvidenceMimeType: input.evidence?.mimeType ?? null,
      returnRequestRequestedAt: now,
      returnRequestRequestedById: requestedById,
      returnRequestReviewedAt: null,
      returnRequestReviewedById: null,
      returnRequestReviewNote: null,
      observationLog: factura!.observationLog ? `${factura!.observationLog}\n${logLine}` : logLine,
    },
  });

  return { ok: true, facturaId };
}

export async function approveFacturaReturnRequest(
  db: Db,
  facturaId: string,
  reviewerId: string
): Promise<FacturaReturnRequestResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    select: {
      returnRequestStatus: true,
      returnRequestType: true,
      returnRequestReason: true,
      returnRequestRequestedSubtotal: true,
      returnRequestEvidencePath: true,
    },
  });

  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }
  if (factura.returnRequestStatus !== "PENDING" || !factura.returnRequestReason?.trim()) {
    return {
      ok: false,
      code: "NO_REQUEST",
      message: "No hay solicitud de cambio de monto pendiente para esta factura",
    };
  }
  if (factura.returnRequestType === "DOCUMENTATION") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "La solicitud pendiente no es de cambio de monto",
    };
  }

  if (factura.returnRequestRequestedSubtotal == null) {
    return {
      ok: false,
      code: "INVALID_REASON",
      message: "La solicitud no incluye un subtotal a aplicar",
    };
  }
  const requestedSubtotal = Number(factura.returnRequestRequestedSubtotal);

  const reasonParts: string[] = [];
  reasonParts.push(
    `Subtotal solicitado: ${formatSubtotalForLog(requestedSubtotal)}`
  );
  reasonParts.push(factura.returnRequestReason.trim());
  const reason = reasonParts.join(". ");

  const returnResult = await returnFacturaMensual(db, facturaId, reason, reviewerId, "AMOUNT");
  if (!returnResult.ok) {
    return returnResult;
  }

  const applyResult = await applyApprovedAmountChange(
    db,
    facturaId,
    requestedSubtotal,
    reviewerId
  );
  if (!applyResult.ok) {
    return { ok: false, code: "INVALID_STATUS", message: applyResult.message };
  }

  await deleteFacturaReturnRequestEvidence(factura.returnRequestEvidencePath);

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: clearedReturnRequestFields,
  });

  return { ok: true, facturaId };
}

export async function rejectFacturaReturnRequest(
  db: Db,
  facturaId: string,
  reviewerId: string,
  reviewNote?: string | null
): Promise<FacturaReturnRequestResult> {
  const factura = await db.facturaMensual.findUnique({
    where: { id: facturaId },
    select: {
      returnRequestStatus: true,
      returnRequestType: true,
      observationLog: true,
      returnRequestEvidencePath: true,
    },
  });

  if (!factura) {
    return { ok: false, code: "NOT_FOUND", message: "Factura mensual no encontrada" };
  }
  if (factura.returnRequestStatus !== "PENDING" || factura.returnRequestType === "DOCUMENTATION") {
    return {
      ok: false,
      code: "NO_REQUEST",
      message: "No hay solicitud de cambio de monto pendiente para esta factura",
    };
  }

  const now = new Date();
  const note = reviewNote?.trim();
  const logLine = `[${now.toLocaleDateString("es-CR")}] Solicitud de regresión por monto rechazada${note ? `: ${note}` : ""}`;

  await db.facturaMensual.update({
    where: { id: facturaId },
    data: {
      returnRequestStatus: "REJECTED",
      returnRequestReviewedAt: now,
      returnRequestReviewedById: reviewerId,
      returnRequestReviewNote: note || null,
      returnRequestRequestedSubtotal: null,
      returnRequestEvidencePath: null,
      returnRequestEvidenceFileName: null,
      returnRequestEvidenceMimeType: null,
      observationLog: factura.observationLog ? `${factura.observationLog}\n${logLine}` : logLine,
    },
  });

  await deleteFacturaReturnRequestEvidence(factura.returnRequestEvidencePath);

  return { ok: true, facturaId };
}

/** Alias retrocompatible. */
export const requestFacturaReturn = requestAmountFacturaReturn;
export const canRequestFacturaReturn = canRequestAmountFacturaReturn;
