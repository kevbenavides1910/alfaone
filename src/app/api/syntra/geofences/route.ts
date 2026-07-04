import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/response";
import { withDeviceAuth, assertImeiMatch } from "@/modules/syntra/middleware/with-device-auth";
import { getPatrolGeofencesForDevice } from "@/modules/syntra/services/patrol-routes-service";

export const GET = withDeviceAuth(async (req: NextRequest, { payload }) => {
  try {
    const imei = req.nextUrl.searchParams.get("imei");
    const imeiError = assertImeiMatch(payload, imei);
    if (imeiError) return imeiError;

    const data = await getPatrolGeofencesForDevice(payload.sub);
    return NextResponse.json(data);
  } catch (e) {
    return serverError("Error al obtener geocercas SYNTRA", e);
  }
});
