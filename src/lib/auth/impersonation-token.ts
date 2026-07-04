import crypto from "crypto";

const TOKEN_TTL_MS = 2 * 60 * 1000;

export type ImpersonationTokenPayload = {
  typ: "impersonate";
  adminId: string;
  targetUserId: string;
  exp: number;
  iat: number;
  jti: string;
};

function signingSecret(): string {
  const fromEnv = process.env.NEXTAUTH_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "alfa-one-dev-nextauth-secret-not-for-production";
  }
  throw new Error("NEXTAUTH_SECRET es obligatorio para suplantación de sesión");
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

export function signImpersonationToken(input: {
  adminId: string;
  targetUserId: string;
}): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body: ImpersonationTokenPayload = {
    typ: "impersonate",
    adminId: input.adminId,
    targetUserId: input.targetUserId,
    iat: now,
    exp: now + Math.floor(TOKEN_TTL_MS / 1000),
    jti: crypto.randomBytes(12).toString("hex"),
  };
  const payload = base64url(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", signingSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyImpersonationToken(token: string): ImpersonationTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expected = crypto
      .createHmac("sha256", signingSecret())
      .update(`${header}.${payload}`)
      .digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ImpersonationTokenPayload;
    if (decoded.typ !== "impersonate") return null;
    if (!decoded.adminId || !decoded.targetUserId) return null;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
