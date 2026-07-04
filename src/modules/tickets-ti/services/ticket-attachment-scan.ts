import "server-only";

/** Punto de extensión para antivirus / escaneo futuro sin cambiar el flujo de guardado. */
export type AttachmentScanResult = { clean: true } | { clean: false; reason: string };

export async function scanTicketAttachmentBeforeStore(
  _buffer: Buffer,
  _meta: { fileName: string; mimeType: string; extension: string }
): Promise<AttachmentScanResult> {
  // Integración futura: ClamAV, Defender API, etc.
  return { clean: true };
}
