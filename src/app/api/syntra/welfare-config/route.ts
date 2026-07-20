import { NextRequest, NextResponse } from "next/server";
import { serverError, unauthorized } from "@/lib/api/response";
import { verifyDeviceToken, extractBearerToken } from "@/modules/syntra/auth/device-token";
import { findDeviceByImei } from "@/modules/syntra/services/patrol-device-sync-service";
import { getWelfareConfigForDevice } from "@/modules/syntra/services/patrol-welfare-service";
import { patrolImeisMatch } from "@/modules/syntra/utils/costa-rica-time";

export async function GET(req: NextRequest) {
  try {
    const imei = req.nextUrl.searchParams.get("imei")?.trim() || "";
    if (!imei) return unauthorized("IMEI requerido");

    let deviceId: string | null = null;

    const token = extractBearerToken(req);
    if (token) {
      const payload = verifyDeviceToken(token);
      if (payload) {
        if (!patrolImeisMatch(payload.imei, imei)) {
          return unauthorized("IMEI no coincide con el token");
        }
        deviceId = payload.sub;
      }
    }

    if (!deviceId) {
      const device = await findDeviceByImei(imei);
      if (!device) {
        return NextResponse.json({ Table: [] });
      }
      deviceId = device.id;
    }

    const Table = await getWelfareConfigForDevice(deviceId);
    return NextResponse.json({ Table });
  } catch (e) {
    return serverError("Error al obtener configuración hombre vivo", e);
  }
}
