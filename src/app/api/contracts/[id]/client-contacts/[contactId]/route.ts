import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { clientContactUpdateSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId, contactId } = await params;
  try {
    const existing = await prisma.contractClientContact.findFirst({
      where: { id: contactId, contractId },
    });
    if (!existing) return notFound();

    const body = await req.json();
    const parsed = clientContactUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const data: {
      name?: string;
      jobTitle?: string | null;
      isBillingContact?: boolean;
      isContractAdmin?: boolean;
      phone?: string;
      phone2?: string | null;
      email?: string;
      sortOrder?: number;
    } = {};

    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.jobTitle !== undefined) data.jobTitle = parsed.data.jobTitle?.trim() || null;
    if (parsed.data.isBillingContact !== undefined) data.isBillingContact = parsed.data.isBillingContact;
    if (parsed.data.isContractAdmin !== undefined) data.isContractAdmin = parsed.data.isContractAdmin;
    if (parsed.data.phone !== undefined) data.phone = parsed.data.phone.trim();
    if (parsed.data.phone2 !== undefined) data.phone2 = parsed.data.phone2?.trim() || null;
    if (parsed.data.email !== undefined) data.email = parsed.data.email.trim().toLowerCase();
    if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;

    const updated = await prisma.contractClientContact.update({
      where: { id: contactId },
      data,
    });

    return ok({
      id: updated.id,
      name: updated.name,
      jobTitle: updated.jobTitle,
      isBillingContact: updated.isBillingContact,
      isContractAdmin: updated.isContractAdmin,
      phone: updated.phone,
      phone2: updated.phone2,
      email: updated.email,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    return serverError("Error al actualizar contacto del cliente", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId, contactId } = await params;
  try {
    const existing = await prisma.contractClientContact.findFirst({
      where: { id: contactId, contractId },
    });
    if (!existing) return notFound();

    await prisma.contractClientContact.delete({ where: { id: contactId } });
    return ok({ deleted: true });
  } catch (e) {
    return serverError("Error al eliminar contacto del cliente", e);
  }
}
