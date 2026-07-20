import { jwtVerify } from "jose";

export type ImpersonationTokenPayload = {
  sub: string;
  impersonatedRoleId: string;
  impersonatedRoleCode: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Verifica el JWT de vista previa emitido por POST /api/admin/roles/[id]/impersonate-token. */
export async function verifyImpersonationToken(
  token: string
): Promise<ImpersonationTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "alfa-one",
      audience: "impersonation",
    });
    const sub = payload.sub;
    const impersonatedRoleId = payload.impersonatedRoleId;
    const impersonatedRoleCode = payload.impersonatedRoleCode;
    if (typeof sub !== "string" || !sub) return null;
    if (typeof impersonatedRoleId !== "string" || !impersonatedRoleId) return null;
    if (typeof impersonatedRoleCode !== "string" || !impersonatedRoleCode) return null;
    return { sub, impersonatedRoleId, impersonatedRoleCode };
  } catch {
    return null;
  }
}
