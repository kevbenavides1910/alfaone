import path from "path";
import { paymentUploadRoot } from "@/lib/storage/paths";

export const PAYMENT_UPLOAD_ROOT = paymentUploadRoot();

export function paymentAttachmentDir(paymentId: string) {
  return path.join(PAYMENT_UPLOAD_ROOT, paymentId);
}

/** Relative to PAYMENT_UPLOAD_ROOT (e.g. `<paymentId>/<file>`) */
export function paymentStoragePathForFile(paymentId: string, storedFileName: string) {
  return path.join(paymentId, storedFileName);
}

export const ALLOWED_PAYMENT_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

export const MAX_PAYMENT_ATTACHMENT_BYTES = 15 * 1024 * 1024;
