import { NextResponse, type NextRequest } from "next/server";
import { unauthorized, serverError } from "@/lib/api/response";
import {
  extractBearerToken,
  signDeviceToken,
  tokenTtlSeconds,
  verifyDeviceToken,
} from "@/modules/syntra/auth/device-token";

export async function POST(req: NextRequest) {
  try {
    const raw = extractBearerToken(req);
    if (!raw) return unauthorized("Token requerido");

    const payload = verifyDeviceToken(raw);
    if (!payload) return unauthorized("Token invalido o expirado");

    const token = signDeviceToken({
      deviceId: payload.sub,
      imei: payload.imei,
      employeeCode: payload.employeeCode,
    });

    return NextResponse.json({
      token,
      accessToken: token,
      expiresIn: tokenTtlSeconds(),
    });
  } catch (e) {
    return serverError("Error al renovar token", e);
  }
}
