import { z } from "zod";

/** Contraseña temporal tras restablecimiento por administrador. */
export const DEFAULT_RESET_PASSWORD = "alfa1234";

export const PASSWORD_REQUIREMENTS_HINT =
  "Mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial (!@#$%&* etc.)";

const SPECIAL_CHAR = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const COMMON_PASSWORDS = new Set(
  [
    "admin123",
    "password",
    "password123",
    "123456",
    "12345678",
    "supervisor123",
    "compras123",
    "comercial123",
    "qwerty",
    "contraseña",
  ].map((s) => s.toLowerCase()),
);

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .refine((p) => /[a-z]/.test(p), "Debe incluir una minúscula")
  .refine((p) => /[A-Z]/.test(p), "Debe incluir una mayúscula")
  .refine((p) => /[0-9]/.test(p), "Debe incluir un número")
  .refine((p) => SPECIAL_CHAR.test(p), "Debe incluir un carácter especial")
  .refine((p) => p !== DEFAULT_RESET_PASSWORD, "Elija una contraseña distinta a la temporal")
  .refine((p) => !COMMON_PASSWORDS.has(p.toLowerCase()), "Contraseña demasiado común");

export function validatePassword(password: string): { ok: true } | { ok: false; message: string } {
  const r = passwordSchema.safeParse(password);
  if (r.success) return { ok: true };
  const msg = r.error.errors[0]?.message ?? "Contraseña inválida";
  return { ok: false, message: msg };
}
