import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession, canModifyContracts } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import { clientContactSchema } from "@/modules/presupuestos/validations/contract.schema";

type Ctx = { params: Promise<{ id: string }> };

function serialize(row: {
  id: string;
  name: string;
  jobTitle: string | null;
  isBillingContact: boolean;
  isContractAdmin: boolean;
  phone: string;
  phone2: string | null;
  email: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    jobTitle: row.jobTitle,
    isBillingContact: row.isBillingContact,
    isContractAdmin: row.isContractAdmin,
    phone: row.phone,
    phone2: row.phone2,
    email: row.email,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true },
    });
    if (!contract) return notFound();

    const rows = await prisma.contractClientContact.findMany({
      where: { contractId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(rows.map(serialize));
  } catch (e) {
    return serverError("Error al obtener contactos del cliente", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canModifyContracts(session)) return forbidden();

  const { id: contractId } = await params;
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      select: { id: true },
    });
    if (!contract) return notFound();

    const body = await req.json();
    const parsed = clientContactSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const maxSort = await prisma.contractClientContact.aggregate({
      where: { contractId },
      _max: { sortOrder: true },
    });
    const sortOrder = parsed.data.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1;

    const row = await prisma.contractClientContact.create({
      data: {
        contractId,
        name: parsed.data.name.trim(),
        jobTitle: parsed.data.jobTitle?.trim() || null,
        isBillingContact: parsed.data.isBillingContact,
        isContractAdmin: parsed.data.isContractAdmin,
        phone: parsed.data.phone.trim(),
        phone2: parsed.data.phone2?.trim() || null,
        email: parsed.data.email.trim().toLowerCase(),
        sortOrder,
        createdById: session.user.id,
      },
    });

    return created(serialize(row));
  } catch (e) {
    return serverError("Error al crear contacto del cliente", e);
  }
}
