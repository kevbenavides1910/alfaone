"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PreviewableAttachment } from "@/app/(app)/(gastos)/expenses/expenses-types";

function isPdf(mime: string | undefined, fileName: string) {
  if (mime && mime.toLowerCase() === "application/pdf") return true;
  return fileName.toLowerCase().endsWith(".pdf");
}

function isImage(mime: string | undefined, fileName: string) {
  if (mime && mime.toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

export function AttachmentPreviewDialog({
  attachment,
  onOpenChange,
}: {
  attachment: PreviewableAttachment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = !!attachment;
  const inlineUrl = attachment ? `${attachment.downloadUrl}?inline=1` : "";
  const pdf = attachment ? isPdf(attachment.mimeType, attachment.fileName) : false;
  const img = attachment ? isImage(attachment.mimeType, attachment.fileName) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="truncate text-sm font-medium" title={attachment?.fileName}>
              {attachment?.fileName ?? "Previsualización"}
            </span>
            {attachment && (
              <a
                href={attachment.downloadUrl}
                className="text-xs text-red-600 hover:underline shrink-0"
                target="_blank"
                rel="noreferrer"
              >
                Descargar
              </a>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-slate-100" style={{ height: "80vh" }}>
          {attachment && pdf && (
            <iframe
              src={inlineUrl}
              title={attachment.fileName}
              className="w-full h-full bg-card"
            />
          )}
          {attachment && img && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={inlineUrl}
                alt={attachment.fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
          {attachment && !pdf && !img && (
            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">
              No hay previsualización disponible para este formato.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
