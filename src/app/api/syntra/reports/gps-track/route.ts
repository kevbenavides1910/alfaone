import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError } from "@/lib/api/response";
import { withDeviceAuth, assertImeiMatch } from "@/modules/syntra/middleware/with-device-auth";
import { savePatrolGpsTrack } from "@/modules/syntra/services/patrol-reports-service";

const schema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  recordedAt: z.string().optional(),
  imei: z.string().optional(),
  employeeCode: z.string().optional(),
});

export const POST = withDeviceAuth(async (req, { payload }) => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Datos GPS invalidos", parsed.error.flatten());

    if (parsed.data.imei) {
      const imeiError = assertImeiMatch(payload, parsed.data.imei);
      if (imeiError) return imeiError;
    }

    const track = await savePatrolGpsTrack({
      deviceId: payload.sub,
      imei: parsed.data.imei ?? payload.imei,
      employeeCode: parsed.data.employeeCode ?? payload.employeeCode,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      recordedAt: parsed.data.recordedAt,
    });

    return NextResponse.json({ success: true, data: { id: track.id } });
  } catch (e) {
    return serverError("Error al registrar GPS", e);
  }
});
