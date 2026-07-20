import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  createNafCargaSocialLine,
  deleteNafCargaSocialLine,
  listNafCargasSociales,
  listNafCargasSocialesEmpresas,
  updateNafCargaSocialPorcentaje,
} from "@/modules/empleados-naf/services/cargas-sociales";
import {
  nafCargasSocialesCreateSchema,
  nafCargasSocialesDeleteSchema,
  nafCargasSocialesUpdateSchema,
} from "@/modules/empleados-naf/validations/cargas-sociales.schema";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.cargasSociales", "view")) return forbidden();

  try {
    const noCia = req.nextUrl.searchParams.get("noCia")?.trim();
    const empresas = await listNafCargasSocialesEmpresas();

    if (!noCia) {
      return ok({ empresas });
    }

    const cargas = await listNafCargasSociales(noCia);
    return ok({ empresas, cargas });
  } catch (e) {
    return serverError("Error al consultar cargas sociales NAF", e);
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.cargasSociales", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = nafCargasSocialesUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const row = await updateNafCargaSocialPorcentaje(
      parsed.data.noCia,
      parsed.data.codigo,
      parsed.data.porcentaje,
    );
    if (!row) return badRequest("Línea no encontrada");
    const cargas = await listNafCargasSociales(parsed.data.noCia);
    return ok({ cargas });
  } catch (e) {
    return serverError("Error al actualizar carga social", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.cargasSociales", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = nafCargasSocialesCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    await createNafCargaSocialLine(parsed.data.noCia, parsed.data.item);
    const cargas = await listNafCargasSociales(parsed.data.noCia);
    return ok({ cargas });
  } catch (e) {
    return serverError("Error al crear línea de carga social", e);
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.cargasSociales", "edit")) return forbidden();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("JSON inválido");
  }

  const parsed = nafCargasSocialesDeleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

  try {
    const deleted = await deleteNafCargaSocialLine(parsed.data.noCia, parsed.data.codigo);
    if (!deleted) return badRequest("Línea no encontrada");
    const cargas = await listNafCargasSociales(parsed.data.noCia);
    return ok({ cargas });
  } catch (e) {
    return serverError("Error al eliminar línea de carga social", e);
  }
}
