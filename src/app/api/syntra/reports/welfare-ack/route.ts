import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError } from "@/lib/api/response";
import { withDeviceAuth, assertImeiMatch } from "@/modules/syntra/middleware/with-device-auth";
import { acknowledgeWelfareCheck } from "@/modules/syntra/services/patrol-welfare-service";

const schema = z.object({
  checkId: z.string().optional(),
  routeCode: z.string().optional(),
  source: z.enum(["SCHEDULED", "MANUAL"]).optional(),
  scheduledAt: z.string().optional(),
  imei: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const POST = withDeviceAuth(async (req, { payload }) => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());

    if (parsed.data.imei) {
      const imeiError = assertImeiMatch(payload, parsed.data.imei);
      if (imeiError) return imeiError;
    }

    if (!parsed.data.checkId && !parsed.data.routeCode) {
      return badRequest("Se requiere checkId o routeCode");
    }

    const check = await acknowledgeWelfareCheck({
      checkId: parsed.data.checkId,
      deviceId: payload.sub,
      imei: parsed.data.imei ?? payload.imei,
      routeCode: parsed.data.routeCode,
      source: parsed.data.source,
      scheduledAt: parsed.data.scheduledAt,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });

    return NextResponse.json({ success: true, data: { id: check.id, status: check.status } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CHECK_NOT_FOUND") return badRequest("Alerta no encontrada");
    if (msg === "IMEI_MISMATCH") return badRequest("IMEI no coincide");
    if (msg === "ROUTE_REQUIRED" || msg === "ROUTE_NOT_FOUND") {
      return badRequest("Ruta no válida");
    }
    return serverError("Error al registrar confirmación", e);
  }
});
