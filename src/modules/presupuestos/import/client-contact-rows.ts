import { pickCell, rowToNormalized } from "../../core/import/xlsx-read";

function normalizeLicitacionNo(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

const LICITACION_ALIASES = [
  "licitacion",
  "licitación",
  "contactos_de_cobro__licitaciones_en_contratos",
];
const NAME_ALIASES = ["contacto_cobro", "contacto", "nombre", "__empty"];
const PHONE_ALIASES = ["telefono", "teléfono", "tel", "__empty_1"];
const EXT_ALIASES = ["extension", "extensión", "ext", "__empty_2"];
const EMAIL_ALIASES = ["correo", "email", "e_mail", "__empty_3"];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PLACEHOLDER_PHONE = "00000000";

export type ParsedBillingContact = {
  licitacionNo: string;
  name: string;
  phone: string;
  phone2: string | null;
  email: string;
  sheetRow: number;
};

export type ContactImportRowResult =
  | { ok: true; contacts: ParsedBillingContact[]; warnings: string[] }
  | { ok: false; sheetRow: number; message: string };

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(Math.trunc(v));
  return String(v).trim();
}

function splitLines(v: unknown): string[] {
  return str(v)
    .split(/[\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Extrae correos válidos de texto sucio (saltos de línea, puntos, espacios). */
export function extractEmails(raw: string): string[] {
  if (!raw.trim()) return [];
  const found = raw.match(EMAIL_RE) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of found) {
    const norm = e.toLowerCase().trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

function normalizePhoneToken(v: string): string {
  return v.replace(/[^\d+]/g, "").trim();
}

function pickPhones(raw: unknown): string[] {
  return splitLines(raw)
    .map(normalizePhoneToken)
    .filter((p) => p.length >= 6);
}

function pickExtensions(raw: unknown): string[] {
  return splitLines(raw).map((e) => e.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "contacto";
  return local
    .replace(/[._+-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function placeholderEmail(licitacionNo: string, index: number): string {
  const slug = licitacionNo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `importado.${index}.${slug || "contrato"}@seguridadgrupocr.com`;
}

function pickByIndex<T>(items: T[], index: number, fallback: T): T {
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  return items[index] ?? items[0];
}

export function isHeaderOrEmptyContactRow(row: Record<string, unknown>): boolean {
  const norm = rowToNormalized(row);
  const licitacion = str(pickCell(norm, LICITACION_ALIASES));
  if (!licitacion || /^licitaci[oó]n$/i.test(licitacion)) return true;

  const name = str(pickCell(norm, NAME_ALIASES));
  const phone = str(pickCell(norm, PHONE_ALIASES));
  const email = str(pickCell(norm, EMAIL_ALIASES));
  return !name && !phone && !email;
}

/**
 * Convierte una fila del Excel de contactos de cobro en uno o más contactos de facturación.
 * Si hay varios correos en la misma fila, genera un contacto por correo.
 */
export function billingContactRowsFromSheet(
  row: Record<string, unknown>,
  sheetRow: number
): ContactImportRowResult {
  const norm = rowToNormalized(row);
  const licitacionRaw = str(pickCell(norm, LICITACION_ALIASES));
  if (!licitacionRaw) {
    return { ok: false, sheetRow, message: "Falta licitación" };
  }

  const licitacionNo = normalizeLicitacionNo(licitacionRaw);
  const names = splitLines(pickCell(norm, NAME_ALIASES));
  const phones = pickPhones(pickCell(norm, PHONE_ALIASES));
  const extensions = pickExtensions(pickCell(norm, EXT_ALIASES));
  const emails = extractEmails(str(pickCell(norm, EMAIL_ALIASES)));

  const warnings: string[] = [];

  if (emails.length === 0 && names.length === 0 && phones.length === 0) {
    return {
      ok: false,
      sheetRow,
      message: `Sin datos de contacto para licitación «${licitacionNo}»`,
    };
  }

  const contactCount = Math.max(emails.length, names.length, phones.length, 1);
  if (emails.length > 1 && names.length > 1 && emails.length !== names.length) {
    warnings.push(
      `${emails.length} correo(s) y ${names.length} nombre(s); se asignan por posición con el primero como respaldo`
    );
  }

  const contacts: ParsedBillingContact[] = [];

  for (let i = 0; i < contactCount; i++) {
    const email = emails[i] ?? (emails.length === 1 ? emails[0] : placeholderEmail(licitacionNo, i + 1));
    if (!emails[i] && emails.length === 0) {
      warnings.push(`Contacto sin correo; se usa ${email}`);
    } else if (!emails[i] && emails.length > 0) {
      warnings.push(`Posición ${i + 1} sin correo propio; se reutiliza ${email}`);
    }

    const name =
      pickByIndex(names, i, "") ||
      (emails[i] ? nameFromEmail(emails[i]) : nameFromEmail(email)) ||
      "Contacto cobro";

    const phone = pickByIndex(phones, i, phones[0] ?? "") || PLACEHOLDER_PHONE;
    const ext = pickByIndex(extensions, i, extensions[0] ?? "");
    const phone2 = pickByIndex(phones, i + 1, "") || (ext && phone !== PLACEHOLDER_PHONE ? ext : "") || null;

    contacts.push({
      licitacionNo,
      name,
      phone,
      phone2: phone2 || null,
      email,
      sheetRow,
    });
  }

  return { ok: true, contacts, warnings };
}

export function buildContractLookup(
  contracts: { id: string; licitacionNo: string }[]
): Map<string, { id: string; licitacionNo: string }> {
  const map = new Map<string, { id: string; licitacionNo: string }>();
  for (const c of contracts) {
    const key = normalizeLicitacionNo(c.licitacionNo);
    map.set(key, c);
    map.set(c.licitacionNo.trim(), c);
    map.set(key.toUpperCase(), c);
  }
  return map;
}

export function resolveContractForLicitacion(
  licitacionNo: string,
  lookup: Map<string, { id: string; licitacionNo: string }>
): { id: string; licitacionNo: string } | undefined {
  const key = normalizeLicitacionNo(licitacionNo);
  return (
    lookup.get(key) ??
    lookup.get(licitacionNo.trim()) ??
    lookup.get(key.toUpperCase())
  );
}
