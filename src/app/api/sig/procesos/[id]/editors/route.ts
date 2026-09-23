import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "@/lib/api/response";
import {
  addSigProcessEditor,
  listSigProcessEditors,
  removeSigProcessEditor,
  setSigProcessEditors,
} from "@/modules/sig/services/process-editors";
import { prisma } from "@/modules/core/db/prisma";

type Ctx = { params: Promise<{ id: string }> };

function serializeEditors(
  processId: string,
  rows: Awaited<ReturnType<typeof listSigProcessEditors>>
) {
  return {
    processId,
    editors: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.procesos", "view")) return forbidden();

  const { id } = await params;
  const process = await prisma.sigProcess.findUnique({ where: { id }, select: { id: true } });
  if (!process) return notFound("Proceso no encontrado");

  try {
    return ok(serializeEditors(id, await listSigProcessEditors(id)));
  } catch (e) {
    return serverError("Error al listar editores del proceso", e);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (
    !hasPermission(session, "sig.procesos", "admin") &&
    !hasPermission(session, "sig.procesos", "edit")
  ) {
    return forbidden();
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const userIds = Array.isArray(body?.userIds)
      ? body.userIds.filter((x: unknown) => typeof x === "string")
      : null;
    if (!userIds) return badRequest("userIds (array) requerido");
    return ok(serializeEditors(id, await setSigProcessEditors(id, userIds)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("no encontrado")) return notFound(msg);
    return serverError("Error al guardar editores del proceso", e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.procesos", "edit")) return forbidden();

  const { id } = await params;
  try {
    const body = await req.json();
    const userId = typeof body?.userId === "string" ? body.userId : "";
    if (!userId) return badRequest("userId requerido");
    return ok(serializeEditors(id, await addSigProcessEditor(id, userId)));
  } catch (e) {
    return serverError("Error al agregar editor", e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "sig.procesos", "edit")) return forbidden();

  const { id } = await params;
  try {
    let userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      const body = await req.json().catch(() => null);
      userId = body && typeof body.userId === "string" ? body.userId : null;
    }
    if (!userId) return badRequest("userId requerido");
    return ok(serializeEditors(id, await removeSigProcessEditor(id, userId)));
  } catch (e) {
    return serverError("Error al quitar editor", e);
  }
}
