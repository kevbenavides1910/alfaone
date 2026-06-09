import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/modules/core/db/prisma";
import { ok, created, badRequest, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";

const createSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  contractId: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const GET = withPermission(async () => {
  try {
    const routes = await prisma.patrolRoute.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: {
        contract: { select: { id: true, licitacionNo: true, client: true } },
        _count: { select: { points: true, authorizedPhones: true } },
      },
    });
    return ok(
      routes.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        contractId: r.contractId,
        contract: r.contract,
        isActive: r.isActive,
        pointsCount: r._count.points,
        phonesCount: r._count.authorizedPhones,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    );
  } catch (e) {
    return serverError("Error al listar rutas", e);
  }
}, "recorridos.rutas", "view");

export const POST = withPermission(async (req: NextRequest) => {
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const route = await prisma.patrolRoute.create({
      data: {
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        contractId: parsed.data.contractId?.trim() || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return created(route);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return badRequest("Ya existe una ruta con ese código");
    }
    return serverError("Error al crear ruta", e);
  }
}, "recorridos.rutas", "edit");
