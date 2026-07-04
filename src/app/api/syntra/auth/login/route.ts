import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, serverError, unauthorized } from "@/lib/api/response";
import { tokenTtlSeconds } from "@/modules/syntra/auth/device-token";
import { loginPatrolDevice } from "@/modules/syntra/services/patrol-auth-service";

const loginSchema = z.object({
  employeeCode: z.string().min(1),
  password: z.string().optional(),
  imei: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Datos de login inválidos", parsed.error.flatten());
    }

    const result = await loginPatrolDevice(parsed.data);
    if (!result.ok) {
      return unauthorized(result.message);
    }

    return NextResponse.json({
      token: result.token,
      accessToken: result.token,
      expiresIn: tokenTtlSeconds(),
      employeeCode: result.device.employeeCode,
      imei: result.device.imei,
      deviceId: result.device.id,
      locationDesc: result.device.locationDesc,
    });
  } catch (e) {
    return serverError("Error en login SYNTRA", e);
  }
}
