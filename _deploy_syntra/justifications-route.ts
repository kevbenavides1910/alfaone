import { NextRequest } from "next/server";
import { z } from "zod";
import { NextResponse } from "next/server";
import { badRequest, created, ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { createWebJustification } from "@/modules/syntra/services/patrol-justification-service";

const schema = z.object({
  omissionKey: z.string().trim().min(1),
  fecha: z.string().trim().min(10),
  deviceId: z.string().trim().min(1),
  routeId: z.string().trim().min(1),
  routePointId: z.string().trim().min(1),
  routeCode: z.string().trim().min(1),
  pointLabel: z.string().trim().min(1),
  nfcTagCode: z.string().trim().min(1),
  description: z.string().trim().min(3).max(5000),
  imageBase64: z.string().optional().nullable(),
  imageMimeType: z.string().optional().nullable(),
  imageFileName: z.string().optional().nullable(),
});

export const POST = withPermission(async (req: NextRequest, { session }) => {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await createWebJustification({
      ...parsed.data,
      createdById: (session as { user?: { id?: string } }).user?.id ?? null,
    });
    return created(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ALREADY_JUSTIFIED") return badRequest("Esta omisión ya tiene justificación");
    return serverError("Error al registrar justificación", e);
  }
}, "recorridos.reportes", "edit");
