/**
 * Configuración centralizada de adjuntos Tickets TI.
 * Equivalente a config/tickets.php — no codificar límites en rutas/controladores.
 */

export type TicketAttachmentContext = "ticket" | "comment";

/** Extensiones permitidas (sin punto, minúsculas). */
export const TICKET_ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "txt", "csv",
  "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "svg",
  "zip", "rar", "7z", "tar", "gz",
  "log", "json", "xml", "yaml", "yml", "ini", "conf", "sql", "bat", "ps1", "sh",
  "dwg", "dxf", "psd", "ai",
  "mp4", "avi", "mov", "mkv", "wmv",
  "mp3", "wav", "ogg",
] as const;

export type TicketAllowedExtension = (typeof TICKET_ALLOWED_EXTENSIONS)[number];

export const TICKETS_ATTACHMENT_CONFIG = {
  /** Tamaño máximo por archivo (bytes). */
  maxFileBytes: 25 * 1024 * 1024,
  /** Máximo de adjuntos directos al ticket (sin comentario). */
  maxFilesPerTicket: 20,
  /** Máximo de adjuntos por comentario. */
  maxFilesPerComment: 5,
  allowedExtensions: TICKET_ALLOWED_EXTENSIONS,
} as const;

/** MIME esperados por extensión (validación flexible para tipos empresariales). */
export const EXTENSION_MIME_HINTS: Record<TicketAllowedExtension, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  odt: ["application/vnd.oasis.opendocument.text"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  odp: ["application/vnd.oasis.opendocument.presentation"],
  rtf: ["application/rtf", "text/rtf"],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain", "application/csv"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  gif: ["image/gif"],
  bmp: ["image/bmp", "image/x-ms-bmp"],
  webp: ["image/webp"],
  tiff: ["image/tiff"],
  tif: ["image/tiff"],
  svg: ["image/svg+xml"],
  zip: ["application/zip", "application/x-zip-compressed"],
  rar: ["application/vnd.rar", "application/x-rar-compressed"],
  "7z": ["application/x-7z-compressed"],
  tar: ["application/x-tar"],
  gz: ["application/gzip", "application/x-gzip"],
  log: ["text/plain"],
  json: ["application/json", "text/plain"],
  xml: ["application/xml", "text/xml"],
  yaml: ["application/x-yaml", "text/yaml", "text/plain"],
  yml: ["application/x-yaml", "text/yaml", "text/plain"],
  ini: ["text/plain"],
  conf: ["text/plain"],
  sql: ["application/sql", "text/plain"],
  bat: ["application/x-bat", "text/plain"],
  ps1: ["text/plain", "application/x-powershell"],
  sh: ["application/x-sh", "text/plain"],
  dwg: ["application/acad", "image/vnd.dwg", "application/octet-stream"],
  dxf: ["image/vnd.dxf", "application/dxf", "application/octet-stream"],
  psd: ["image/vnd.adobe.photoshop", "application/octet-stream"],
  ai: ["application/postscript", "application/illustrator", "application/octet-stream"],
  mp4: ["video/mp4"],
  avi: ["video/x-msvideo", "video/avi"],
  mov: ["video/quicktime"],
  mkv: ["video/x-matroska"],
  wmv: ["video/x-ms-wmv"],
  mp3: ["audio/mpeg"],
  wav: ["audio/wav", "audio/x-wav"],
  ogg: ["audio/ogg"],
};

const ALLOWED_EXT_SET = new Set<string>(TICKET_ALLOWED_EXTENSIONS);

export function normalizeExtension(fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() ?? "" : "";
  return ext.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isAllowedTicketExtension(ext: string): ext is TicketAllowedExtension {
  return ALLOWED_EXT_SET.has(ext.toLowerCase());
}

export function maxFilesForContext(context: TicketAttachmentContext): number {
  return context === "comment"
    ? TICKETS_ATTACHMENT_CONFIG.maxFilesPerComment
    : TICKETS_ATTACHMENT_CONFIG.maxFilesPerTicket;
}
