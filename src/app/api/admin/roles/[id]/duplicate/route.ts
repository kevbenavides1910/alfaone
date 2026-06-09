import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { duplicateRole } from "@/modules/plataforma/services/roles";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ name: z.string().min(2) });

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Nombre requerido");
    const role = await duplicateRole(prisma, id, parsed.data.name);
    return created(role);
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al duplicar", e);
  }
}
