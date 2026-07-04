import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { created, unauthorized, forbidden, serverError, notFound } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { SignJWT } from "jose";
import { getRoleById } from "@/modules/plataforma/services/roles";

const IMPERSONATION_TTL_SECONDS = 60 * 60; // 1 hour

type Ctx = { params: Promise<{ id: string }> };

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  try {
    const { id } = await params;
    const role = await getRoleById(prisma, id);
    if (!role) return notFound("Rol no encontrado");

    const secret = getSecret();
    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({
      sub: session.user.id,
      impersonatedRoleId: role.id,
      impersonatedRoleCode: role.code,
      iat: now,
      exp: now + IMPERSONATION_TTL_SECONDS,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("alfa-one")
      .setAudience("impersonation")
      .sign(secret);

    return created({
      token,
      roleId: role.id,
      roleCode: role.code,
      expiresIn: IMPERSONATION_TTL_SECONDS,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error generando token de impersonación", e);
  }
}