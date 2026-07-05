import type { NextRequest } from "next/server";
import { unauthorized, forbidden } from "@/lib/api/response";
import {
  extractBearerToken,
  verifyDeviceToken,
  type DeviceTokenPayload,
} from "@/modules/syntra/auth/device-token";
import { patrolImeisMatch } from "@/modules/syntra/utils/costa-rica-time";

export type DeviceAuthContext = {
  payload: DeviceTokenPayload;
};

export function withDeviceAuth(
  handler: (req: NextRequest, ctx: DeviceAuthContext) => Promise<Response>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const token = extractBearerToken(req);
    if (!token) return unauthorized("Token requerido");

    const payload = verifyDeviceToken(token);
    if (!payload) return unauthorized("Token inválido o expirado");

    return handler(req, { payload });
  };
}

export function assertImeiMatch(payload: DeviceTokenPayload, imeiParam: string | null): Response | null {
  if (!imeiParam?.trim()) return null;
  if (!patrolImeisMatch(payload.imei, imeiParam.trim())) {
    return forbidden("IMEI no coincide con el token");
  }
  return null;
}
