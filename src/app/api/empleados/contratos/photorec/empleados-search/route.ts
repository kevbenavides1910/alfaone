import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { getLiveE5StatusMany } from "@/modules/empleados/services/photorec-review";

/**
 * Búsqueda rápida de empleados NAF para asignar PDFs PhotoRec.
 * Usa permiso empleados.contratos (no exige empleadosNaf.list).
 * Incluye hasE5 / e5Path del expediente vivo.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "view")) return forbidden();

  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return badRequest("Escribe al menos 2 caracteres");

    const limitRaw = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "15", 10);
    const take = Math.min(30, Math.max(5, Number.isNaN(limitRaw) ? 15 : limitRaw));

    const rows = await prisma.nafEmployee.findMany({
      where: {
        OR: [
          { noEmple: { contains: q, mode: "insensitive" } },
          { nombre: { contains: q, mode: "insensitive" } },
          { cedula: { contains: q, mode: "insensitive" } },
          { apePat: { contains: q, mode: "insensitive" } },
          { apeMat: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ estado: "asc" }, { nombre: "asc" }, { noEmple: "asc" }],
      take,
      select: {
        noEmple: true,
        nombre: true,
        cedula: true,
        estado: true,
        noCia: true,
        puesto: true,
      },
    });

    const e5Map = await getLiveE5StatusMany(rows.map((r) => r.noEmple));

    return ok(
      rows.map((r) => {
        const e5 = e5Map[r.noEmple];
        return {
          noEmple: r.noEmple,
          nombre: r.nombre ?? "",
          cedula: r.cedula ?? "",
          estado: r.estado ?? "",
          noCia: r.noCia,
          puesto: r.puesto ?? "",
          hasE5: e5?.hasE5 ?? false,
          e5Path: e5?.remotePath ?? null,
        };
      }),
    );
  } catch (e) {
    return serverError("Error al buscar empleados NAF", e);
  }
}
