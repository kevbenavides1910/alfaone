import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = "finger-smb-password-v1";

function encryptionKey() {
  const secret = process.env.FINGER_ENCRYPTION_KEY?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("Configure NEXTAUTH_SECRET (o FINGER_ENCRYPTION_KEY) para guardar credenciales SMB.");
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptFingerSmbPassword(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptFingerSmbPassword(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Contraseña SMB almacenada corrupta.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
