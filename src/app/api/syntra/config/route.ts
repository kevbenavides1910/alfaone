import { NextResponse } from "next/server";
import { serverError } from "@/lib/api/response";
import { withDeviceAuth } from "@/modules/syntra/middleware/with-device-auth";
import { getSyntraRemoteConfig } from "@/modules/syntra/services/patrol-config-service";

export const GET = withDeviceAuth(async () => {
  try {
    const config = await getSyntraRemoteConfig();
    return NextResponse.json(config);
  } catch (e) {
    return serverError("Error al obtener configuración SYNTRA", e);
  }
});
