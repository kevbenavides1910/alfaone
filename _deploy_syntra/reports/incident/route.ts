import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError } from "@/lib/api/response";
import { withDeviceAuth, assertImeiMatch } from "@/modules/syntra/middleware/with-device-auth";
import { savePatrolBitacoraEntry } from "@/modules/syntra/services/patrol-bitacora-service";

const schema = z.object({
  imei: z.string().min(8),
  description: z.string().min(1),
  employeeCode: z.string().optional(),
  routeCode: z.string().optional().nullable(),
  incidentAt: z.string().optional(),
  imageBase64: z.string().optional().nullable(),
  imageMimeType: z.string().optional().nullable(),
  imageFileName: z.string().optional().nullable(),
});

export const POST = withDeviceAuth(async (req, { payload }) => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Datos de incidente invalidos", parsed.error.flatten());

    const imeiError = assertImeiMatch(payload, parsed.data.imei);
    if (imeiError) return imeiError;

    const entry = await savePatrolBitacoraEntry({
      deviceId: payload.sub,
      imei: parsed.data.imei,
      employeeCode: parsed.data.employeeCode ?? payload.employeeCode,
      description: parsed.data.description,
      routeCode: parsed.data.routeCode,
      incidentAt: parsed.data.incidentAt,
      imageBase64: parsed.data.imageBase64,
      imageMimeType: parsed.data.imageMimeType,
      imageFileName: parsed.data.imageFileName,
      source: "APP",
    });

    return NextResponse.json({
      success: true,
      COD_ERROR: "0000",
      DESC_ERROR: "OK",
      data: { id: entry.id },
    });
  } catch (e) {
    return serverError("Error al registrar bitácora", e);
  }
});
