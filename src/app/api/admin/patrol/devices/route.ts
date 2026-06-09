import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/modules/core/db/prisma";
import { ok, created, badRequest, notFound, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";

const createSchema = z.object({
  imei: z.string().trim().min(8).max(20),
  employeeCode: z.string().trim().min(1).max(40),
  password: z.string().min(4).max(100),
  label: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const GET = withPermission(async () => {
  try {
    const devices = await prisma.patrolDevice.findMany({
      orderBy: [{ isActive: "desc" }, { employeeCode: "asc" }],
      include: {
        _count: { select: { assignments: true } },
      },
    });
    return ok(
      devices.map(({ passwordHash: _ph, ...d }) => ({
        ...d,
        assignmentsCount: d._count.assignments,
      })),
    );
  } catch (e) {
    return serverError("Error al listar dispositivos", e);
  }
}, "recorridos.dispositivos", "view");

export const POST = withPermission(async (req: NextRequest) => {
  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const employeeCode = normalizeEmployeeCode(parsed.data.employeeCode);
    const imei = parsed.data.imei.trim();
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    const device = await prisma.patrolDevice.create({
      data: {
        imei,
        employeeCode,
        passwordHash,
        label: parsed.data.label?.trim() || null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    const { passwordHash: _ph, ...safe } = device;
    return created(safe);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return badRequest("Ya existe un dispositivo con ese IMEI");
    }
    return serverError("Error al crear dispositivo", e);
  }
}, "recorridos.dispositivos", "edit");
