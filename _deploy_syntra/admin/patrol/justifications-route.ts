import { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, created, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { createWebJustificationsBulk } from "@/modules/syntra/services/patrol-justification-service";

const omissionSchema = z.object({
  omissionKey: z.string().trim().min(1),
  fecha: z.string().trim().min(10),
  deviceId: z.string().trim().min(1),
  routeId: z.string().trim().min(1),
  routePointId: z.string().trim().min(1),
  routeCode: z.string().trim().min(1),
  pointLabel: z.string().trim().min(1),
  nfcTagCode: z.string().trim().min(1),
});

const schema = z.object({
  description: z.string().trim().min(3).max(5000),
  imageBase64: z.string().optional().nullable(),
  imageMimeType: z.string().optional().nullable(),
  imageFileName: z.string().optional().nullable(),
  omissions: z.array(omissionSchema).min(1),
});

export const POST = withPermission(async (req: NextRequest, { session }) => {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const rows = await createWebJustificationsBulk({
      omissions: parsed.data.omissions,
      description: parsed.data.description,
      imageBase64: parsed.data.imageBase64,
      imageMimeType: parsed.data.imageMimeType,
      imageFileName: parsed.data.imageFileName,
      createdById: (session as { user?: { id?: string } }).user?.id ?? null,
    });
    return created({ count: rows.length, items: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("ALREADY_JUSTIFIED")) {
      return badRequest("Una o más omisiones ya tienen justificación");
    }
    if (msg === "NO_OMISSIONS") return badRequest("Seleccione al menos una omisión");
    return serverError("Error al registrar justificación", e);
  }
}, "recorridos.reportes", "edit");
