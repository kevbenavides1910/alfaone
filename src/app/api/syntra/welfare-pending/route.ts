import { NextRequest, NextResponse } from "next/server";
import { serverError, unauthorized } from "@/lib/api/response";
import { verifyDeviceToken, extractBearerToken } from "@/modules/syntra/auth/device-token";
import { getPendingWelfareChecksForDevice } from "@/modules/syntra/services/patrol-welfare-service";
import { findDeviceByImei } from "@/modules/syntra/services/patrol-device-sync-service";
import { patrolImeisMatch } from "@/modules/syntra/utils/costa-rica-time";

/** Consulta ligera de alertas manuales pendientes (polling frecuente desde la app). */
export async function GET(req: NextRequest) {
  try {
    const imei = req.nextUrl.searchParams.get("imei")?.trim() || "";
    if (!imei) {
      return unauthorized("IMEI requerido");
    }

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
        return NextResponse.json({
          COD_ERROR: "1",
          DES_ERROR: "Dispositivo no encontrado",
          WelfarePending: [],
        });
      }
      deviceId = device.id;
    }

    const welfarePending = await getPendingWelfareChecksForDevice(deviceId, imei);
    return NextResponse.json({
      COD_ERROR: "0",
      DES_ERROR: "OK",
      WelfarePending: welfarePending,
    });
  } catch (e) {
    return serverError("Error al consultar hombre vivo pendiente", e);
  }
}
