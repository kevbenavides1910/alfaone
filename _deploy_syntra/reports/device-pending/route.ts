import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError } from "@/lib/api/response";
import { withDeviceAuth, assertImeiMatch } from "@/modules/syntra/middleware/with-device-auth";
import { saveDevicePendingSnapshot } from "@/modules/syntra/services/patrol-device-pending-service";

const markSchema = z.object({
  localId: z.number().optional(),
  type: z.string(),
  tag: z.string().optional(),
  markType: z.string().optional(),
  timestamp: z.string().optional(),
  status: z.string().optional(),
  employeeCode: z.string().optional(),
  positionCode: z.string().optional(),
});

const schema = z.object({
  imei: z.string().min(8),
  employeeCode: z.string().optional(),
  pendingCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(),
  appVersion: z.string().optional(),
  marks: z.array(markSchema).default([]),
});

export const POST = withDeviceAuth(async (req, { payload }) => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Snapshot de pendientes invalido", parsed.error.flatten());
    }

    const imeiError = assertImeiMatch(payload, parsed.data.imei);
    if (imeiError) return imeiError;

    const snapshot = await saveDevicePendingSnapshot({
      deviceId: payload.sub,
      imei: parsed.data.imei,
      employeeCode: parsed.data.employeeCode ?? payload.employeeCode,
      pendingCount: parsed.data.pendingCount,
      staleCount: parsed.data.staleCount,
      appVersion: parsed.data.appVersion,
      marks: parsed.data.marks,
    });

    return NextResponse.json({
      success: true,
      COD_ERROR: "0000",
      data: { id: snapshot.id, receivedAt: snapshot.createdAt },
    });
  } catch (e) {
    return serverError("Error al registrar snapshot de pendientes", e);
  }
});
