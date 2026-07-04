import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError } from "@/lib/api/response";
import { withDeviceAuth, assertImeiMatch } from "@/modules/syntra/middleware/with-device-auth";
import { savePatrolMark } from "@/modules/syntra/services/patrol-reports-service";

const schema = z.object({
  imei: z.string().min(8),
  nfcTag: z.string().min(1),
  timestamp: z.string().optional(),
  latitude: z.union([z.string(), z.number()]).optional(),
  longitude: z.union([z.string(), z.number()]).optional(),
  employeeCode: z.string().optional(),
  serialNumber: z.string().optional(),
  incorrectTimeFlag: z.union([z.string(), z.boolean()]).optional(),
  appVersion: z.string().optional(),
});

export const POST = withDeviceAuth(async (req, { payload }) => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Datos de marca invalidos", parsed.error.flatten());

    const imeiError = assertImeiMatch(payload, parsed.data.imei);
    if (imeiError) return imeiError;

    const mark = await savePatrolMark({
      deviceId: payload.sub,
      imei: parsed.data.imei,
      employeeCode: parsed.data.employeeCode ?? payload.employeeCode,
      nfcTagCode: parsed.data.nfcTag,
      markType: "NFC",
      markedAt: parsed.data.timestamp,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      serialNumber: parsed.data.serialNumber,
      incorrectTimeFlag: parsed.data.incorrectTimeFlag,
      appVersion: parsed.data.appVersion,
    });

    return NextResponse.json({ success: true, COD_ERROR: "0000", DESC_ERROR: "OK", data: { id: mark.id } });
  } catch (e) {
    return serverError("Error al registrar marca NFC", e);
  }
});
