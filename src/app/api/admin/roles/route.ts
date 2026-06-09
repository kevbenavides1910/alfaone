import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { createRole, listRoles } from "@/modules/plataforma/services/roles";
import { z } from "zod";

const permSchema = z.object({
  permissionKey: z.string(),
  level: z.enum(["none", "view", "edit", "admin"]),
});

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  code: z.string().optional(),
  permissions: z.array(permSchema),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  try {
    const data = await listRoles(prisma);
    return ok(data);
  } catch (e) {
    return serverError("Error al listar roles", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const role = await createRole(prisma, parsed.data);
    return created(role);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al crear rol";
    if (msg.includes("existe")) return badRequest(msg);
    return serverError(msg, e);
  }
}
