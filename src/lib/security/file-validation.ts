/** Validación de archivos por magic bytes (sin dependencias externas). */

const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const ZIP_XLSX = [0x50, 0x4b, 0x03, 0x04]; // xlsx/docx

function startsWith(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

export type DetectedMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/msword"
  | "application/vnd.ms-excel"
  | "application/vnd.ms-powerpoint"
  | "text/csv"
  | "application/octet-stream";

const OLE_COMPOUND = [0xd0, 0xcf, 0x11, 0xe0];

/** docx/xlsx/pptx son ZIP; se distinguen por carpetas internas en los primeros KB. */
function detectOoxmlZipSubtype(u8: Uint8Array): DetectedMime {
  const sample = u8.slice(0, Math.min(u8.length, 16_384));
  const text = new TextDecoder("latin1").decode(sample);
  if (text.includes("word/")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (text.includes("ppt/")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (text.includes("xl/")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

/** .doc / .xls / .ppt legacy (OLE). */
function detectOleCompoundSubtype(u8: Uint8Array): DetectedMime {
  const sample = u8.slice(0, Math.min(u8.length, 32_768));
  const text = new TextDecoder("latin1").decode(sample);
  if (text.includes("Workbook") || text.includes("Excel")) {
    return "application/vnd.ms-excel";
  }
  if (text.includes("PowerPoint Document") || text.includes("PP97")) {
    return "application/vnd.ms-powerpoint";
  }
  if (text.includes("WordDocument") || text.includes("MSWordDoc")) {
    return "application/msword";
  }
  return "application/msword";
}

export function detectMimeFromBuffer(buf: ArrayBuffer | Uint8Array): DetectedMime {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (startsWith(u8, PDF)) return "application/pdf";
  if (startsWith(u8, PNG)) return "image/png";
  if (startsWith(u8, JPEG)) return "image/jpeg";
  if (startsWith(u8, OLE_COMPOUND)) return detectOleCompoundSubtype(u8);
  if (startsWith(u8, ZIP_XLSX)) {
    return detectOoxmlZipSubtype(u8);
  }
  // WebP: RIFF....WEBP
  if (
    u8.length >= 12 &&
    u8[0] === 0x52 &&
    u8[1] === 0x49 &&
    u8[2] === 0x46 &&
    u8[3] === 0x46 &&
    u8[8] === 0x57 &&
    u8[9] === 0x45 &&
    u8[10] === 0x42 &&
    u8[11] === 0x50
  ) {
    return "image/webp";
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(u8.slice(0, 512));
  if (/^[\x20-\x7e\r\n,;"']*$/.test(text) && text.includes(",")) {
    return "text/csv";
  }
  return "application/octet-stream";
}

export function mimeMatchesDeclared(detected: DetectedMime, declared: string): boolean {
  const d = declared.toLowerCase().split(";")[0].trim();
  if (detected === "application/octet-stream") return true;
  if (d === detected) return true;
  if (d === "image/jpg" && detected === "image/jpeg") return true;
  if (
    d === "application/vnd.ms-excel" &&
    (detected === "application/vnd.ms-excel" ||
      detected === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  ) {
    return true;
  }
  if (
    d === "application/vnd.ms-powerpoint" &&
    (detected === "application/vnd.ms-powerpoint" ||
      detected === "application/vnd.openxmlformats-officedocument.presentationml.presentation")
  ) {
    return true;
  }
  if (
    d === "application/msword" &&
    detected === "application/msword"
  ) {
    return true;
  }
  return false;
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_EXPENSE_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export function assertMaxBytes(size: number, max: number, label = "archivo"): string | null {
  if (size > max) {
    return `${label} demasiado grande (máx. ${Math.round(max / 1024 / 1024)} MB)`;
  }
  return null;
}
