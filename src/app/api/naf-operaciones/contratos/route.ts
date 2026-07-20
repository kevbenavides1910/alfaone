import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { listOpAssignments } from "@/modules/naf-operaciones/services/list-role-assignments";
import {
  OpWriteNotAvailableError,
  asignarEmpleadoRol,
  reasignarRol,
} from "@/modules/naf-operaciones/services/op-write";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.roles", "view")) return forbidden();

  try {
    const sp = req.nextUrl.searchParams;
    const page = Number.parseInt(sp.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
    const noRolRaw = sp.get("noRol");
    const result = await listOpAssignments({
      noCia: sp.get("noCia") ?? undefined,
      noEmple: sp.get("noEmple") ?? undefined,
      noContrato: sp.get("noContrato") ?? undefined,
      noRol: noRolRaw != null && noRolRaw !== "" ? Number(noRolRaw) : undefined,
      vigentesOnly: sp.get("vigentesOnly") !== "0",
      page: Number.isNaN(page) ? 1 : page,
      pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
    });
    return ok(result);
  } catch (e) {
    return serverError("Error al listar asignaciones OP", e);
  }
}

const AsignarSchema = z.object({
  action: z.literal("asignar").optional(),
  noCia: z.string().trim().min(1),
  noEmple: z.string().trim().min(1),
  noRol: z.coerce.number().int().positive(),
  noContrato: z.string().trim().optional().nullable(),
  noUbicacion: z.string().trim().optional().nullable(),
  tipo: z.string().trim().optional().nullable(),
});

const ReasignarSchema = z.object({
  action: z.literal("reasignar"),
  noRol: z.coerce.number().int().positive(),
  noCiaNuevo: z.string().trim().min(1),
  noEmpleNuevo: z.string().trim().min(1),
  noContrato: z.string().trim().optional().nullable(),
  noUbicacion: z.string().trim().optional().nullable(),
  tipo: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "nafOperaciones.programacion", "edit")) return forbidden();

  try {
    const json = await req.json();
    const usuario = session.user?.email ?? session.user?.id ?? "ALFA_ONE";

    if (json?.action === "reasignar") {
      const parsed = ReasignarSchema.safeParse(json);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
      return ok(await reasignarRol({ ...parsed.data, usuario }));
    }

    const parsed = AsignarSchema.safeParse({ action: "asignar", ...json });
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    return ok(await asignarEmpleadoRol({ ...parsed.data, usuario }));
  } catch (e) {
    if (e instanceof OpWriteNotAvailableError) return badRequest(e.message);
    return serverError("Error al asignar/reasignar rol OP", e);
  }
}
