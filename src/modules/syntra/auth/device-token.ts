import crypto from "crypto";
import type { NextRequest } from "next/server";

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export type DeviceTokenPayload = {
  sub: string;
  imei: string;
  employeeCode: string;
  typ: "syntra_device";
  exp: number;
  iat: number;
};

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

function signingSecret(): string {
  const fromEnv = process.env.SYNTRA_DEVICE_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "development") {
    return "syntra-device-dev-fallback-secret-not-for-prod-32chr";
  }
  throw new Error(
    "SYNTRA_DEVICE_SECRET es obligatorio en producción. Genere con: openssl rand -base64 32",
  );
}

export function signDeviceToken(input: {
  deviceId: string;
  imei: string;
  employeeCode: string;
}): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body: DeviceTokenPayload = {
    sub: input.deviceId,
    imei: input.imei,
    employeeCode: input.employeeCode,
    typ: "syntra_device",
    iat: now,
    exp: now + Math.floor(TOKEN_TTL_MS / 1000),
  };
  const payload = base64url(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", signingSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyDeviceToken(token: string): DeviceTokenPayload | null {
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
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DeviceTokenPayload;
    if (decoded.typ !== "syntra_device") return null;
    if (!decoded.sub || !decoded.imei || !decoded.employeeCode) return null;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function extractBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export function tokenTtlSeconds(): number {
  return Math.floor(TOKEN_TTL_MS / 1000);
}
