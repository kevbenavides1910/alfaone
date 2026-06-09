import { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, created, ok, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { linkBitacoraToOmission } from "@/modules/syntra/services/patrol-justification-service";

const schema = z.object({
  bitacoraEntryId: z.string().trim().min(1),
  omissionKey: z.string().trim().min(1),
  fecha: z.string().trim().min(10),
  deviceId: z.string().trim().min(1),
  routeId: z.string().trim().min(1),
  routePointId: z.string().trim().min(1),
  routeCode: z.string().trim().min(1),
  pointLabel: z.string().trim().min(1),
  nfcTagCode: z.string().trim().min(1),
});

export const POST = withPermission(async (req: NextRequest, { session }) => {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    const row = await linkBitacoraToOmission({
      ...parsed.data,
      createdById: (session as { user?: { id?: string } }).user?.id ?? null,
    });
    return created(row);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "BITACORA_NOT_FOUND") return badRequest("Entrada de bitácora no encontrada");
    if (msg === "ALREADY_JUSTIFIED") return badRequest("Esta omisión ya está justificada");
    return serverError("Error al ligar bitácora", e);
  }
}, "recorridos.reportes", "edit");

export const GET = withPermission(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const fecha = url.searchParams.get("fecha");
    if (!fecha) return badRequest("Parametro fecha es obligatorio");
    const imei = url.searchParams.get("imei") ?? undefined;

    const { listOmissionsForLinking } = await import(
      "@/modules/syntra/services/patrol-justification-service"
    );
    const rows = await listOmissionsForLinking({ fecha, imei });
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar omisiones", e);
  }
}, "recorridos.reportes", "view");
