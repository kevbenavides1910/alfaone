import { NextRequest } from "next/server";
import { z } from "zod";
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
  linkNafDocumento,
  listEmisionNafLinks,
  listLinkableNafDocs,
  unlinkNafDocumento,
} from "@/modules/presupuestos/services/factura-emision-naf-link";
import { parseCalendarDateInput } from "@/modules/presupuestos/services/facturacion-cobro";

type Ctx = { params: Promise<{ id: string; emisionId: string }> };

const optionalCalendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .nullable()
  .transform((v) => (v === "" || v == null ? null : v));

const linkBodySchema = z.object({
  noCia: z.string().trim().min(1),
  tipoDoc: z.string().trim().min(1),
  noFactu: z.string().trim().min(1),
  invoiceReceivedAt: optionalCalendarDate,
  dueDate: optionalCalendarDate,
});

async function assertEmision(facturaId: string, emisionId: string) {
  return prisma.facturaMensualEmision.findFirst({
    where: { id: emisionId, facturaMensualId: facturaId },
    select: {
      id: true,
      facturaMensual: {
        select: {
          id: true,
          companyCodeCopied: true,
          periodMonth: true,
          periodYear: true,
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();

  const { id, emisionId } = await params;
  try {
    const emision = await assertEmision(id, emisionId);
    if (!emision) return notFound("Emisión no encontrada");

    const links = await listEmisionNafLinks(prisma, emisionId);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || undefined;
    const includeSearch = searchParams.get("includeSearch") === "1" || Boolean(search);
    const periodMonth = Number(searchParams.get("periodMonth") ?? emision.facturaMensual.periodMonth);
    const periodYear = Number(searchParams.get("periodYear") ?? emision.facturaMensual.periodYear);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "30");

    let candidates = null;
    if (includeSearch) {
      candidates = await listLinkableNafDocs({
        companyCode: emision.facturaMensual.companyCodeCopied,
        periodMonth,
        periodYear,
        search,
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 30,
        excludeEmisionId: emisionId,
      });
    }

    return ok({
      links,
      candidates,
      periodMonth,
      periodYear,
      companyCode: emision.facturaMensual.companyCodeCopied,
    });
  } catch (e) {
    return serverError("Error al listar documentos NAF ligados", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  const { id, emisionId } = await params;
  try {
    const body = await req.json();
    const parsed = linkBodySchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const emision = await assertEmision(id, emisionId);
    if (!emision) return notFound("Emisión no encontrada");

    const result = await linkNafDocumento(prisma, {
      facturaId: id,
      emisionId,
      key: {
        noCia: parsed.data.noCia,
        tipoDoc: parsed.data.tipoDoc,
        noFactu: parsed.data.noFactu,
      },
      userId: session.user.id,
      invoiceReceivedAt:
        parsed.data.invoiceReceivedAt != null
          ? parseCalendarDateInput(parsed.data.invoiceReceivedAt)
          : undefined,
      dueDate:
        parsed.data.dueDate != null ? parseCalendarDateInput(parsed.data.dueDate) : undefined,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message);
    }

    const links = await listEmisionNafLinks(prisma, emisionId);
    const [emisionRow, facturaRow] = await Promise.all([
      prisma.facturaMensualEmision.findUnique({
        where: { id: emisionId },
        select: {
          invoiceNumber: true,
          documentNumber: true,
          invoiceReceivedAt: true,
        },
      }),
      prisma.facturaMensual.findUnique({
        where: { id: id },
        select: {
          invoiceNumber: true,
          documentNumber: true,
          invoiceReceivedAt: true,
          dueDate: true,
        },
      }),
    ]);
    return ok({
      link: result.link,
      links,
      invoiceNumber: emisionRow?.invoiceNumber ?? facturaRow?.invoiceNumber ?? null,
      documentNumber: emisionRow?.documentNumber ?? facturaRow?.documentNumber ?? null,
      invoiceReceivedAt:
        (emisionRow?.invoiceReceivedAt ?? facturaRow?.invoiceReceivedAt)?.toISOString() ?? null,
      dueDate: facturaRow?.dueDate?.toISOString() ?? null,
    });
  } catch (e) {
    return serverError("Error al ligar documento NAF", e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "facturacion.cobro", "edit")) return forbidden();

  const { id, emisionId } = await params;
  try {
    const linkId = new URL(req.url).searchParams.get("linkId")?.trim();
    if (!linkId) return badRequest("linkId es requerido");

    const result = await unlinkNafDocumento(prisma, {
      facturaId: id,
      emisionId,
      linkId,
    });
    if (!result.ok) {
      if (result.code === "NOT_FOUND") return notFound(result.message);
      return badRequest(result.message);
    }

    const links = await listEmisionNafLinks(prisma, emisionId);
    return ok({ links });
  } catch (e) {
    return serverError("Error al desligar documento NAF", e);
  }
}
