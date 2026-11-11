/** Validación de archivos por magic bytes (sin dependencias externas). */

const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // OOXML (docx/xlsx/pptx) y zip

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function startsWith(buf: Uint8Array, sig: number[]): boolean {
  if (buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

function asBuffer(buf: Uint8Array): Buffer {
  if (Buffer.isBuffer(buf)) return buf;
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * docx, xlsx y pptx comparten la firma ZIP (PK). El nombre de cada parte
 * va en claro en los headers del zip, así que se distingue por la parte principal.
 * Un docx puede incrustar un xlsx: la parte principal (word/) manda.
 */
function detectOpenXmlMime(buf: Uint8Array): DetectedMime {
  const raw = asBuffer(buf);
  if (raw.includes("word/document.xml")) return MIME_DOCX;
  if (raw.includes("ppt/presentation.xml")) return MIME_PPTX;
  if (raw.includes("xl/workbook.xml")) return MIME_XLSX;
  return "application/zip";
}

export type DetectedMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | typeof MIME_DOCX
  | typeof MIME_XLSX
  | typeof MIME_PPTX
  | "application/zip"
  | "text/csv"
  | "application/octet-stream";

export function detectMimeFromBuffer(buf: ArrayBuffer | Uint8Array): DetectedMime {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (startsWith(u8, PDF)) return "application/pdf";
  if (startsWith(u8, PNG)) return "image/png";
  if (startsWith(u8, JPEG)) return "image/jpeg";
  if (startsWith(u8, ZIP)) return detectOpenXmlMime(u8);
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
  if (d === "application/vnd.ms-excel" && detected === MIME_XLSX) return true;
  if (d === "application/msword" && detected === MIME_DOCX) return true;
  if (d === "application/vnd.ms-powerpoint" && detected === MIME_PPTX) return true;
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
