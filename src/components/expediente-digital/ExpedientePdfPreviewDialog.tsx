"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ExpedienteDocumento } from "@/modules/expediente-digital/business/types";
import { formatExpedienteVigencia } from "@/components/expediente-digital/expediente-display";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: ExpedienteDocumento | null;
  previewUrl: string | null;
  downloadUrl: string | null;
};

export function ExpedientePdfPreviewDialog({
  open,
  onOpenChange,
  doc,
  previewUrl,
  downloadUrl,
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !previewUrl) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      try {
        // Fetch → blob evita ERR_BLOCKED_BY_RESPONSE (X-Frame-Options DENY en la URL API).
        const res = await fetch(previewUrl, { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Archivo no encontrado en el share"
              : `No se pudo cargar el PDF (${res.status})`,
          );
        }
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("pdf") && !ct.includes("octet-stream")) {
          throw new Error("El servidor no devolvió un PDF válido");
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          blob.type.includes("pdf") ? blob : new Blob([blob], { type: "application/pdf" }),
        );
        setBlobUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar la previsualización");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, previewUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,920px)] w-[min(96vw,1100px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:rounded-xl">
        <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
          <DialogTitle className="text-base sm:text-lg">
            {doc ? (
              <>
                <span className="font-bold text-red-700">{doc.tipoDoc}</span>
                <span className="text-slate-400"> — </span>
                <span className="font-medium text-slate-800">{doc.tipoDescripcion}</span>
              </>
            ) : (
              "Previsualización"
            )}
          </DialogTitle>
          {doc ? (
            <DialogDescription className="text-xs sm:text-sm">
              Código {doc.noEmple} · Versión {doc.nVersion}
              {doc.estado ? ` · Estado ${doc.estado}` : ""}
              {" · "}
              Vigencia {formatExpedienteVigencia(doc.venceDesde, doc.venceHasta)}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap gap-2">
          {downloadUrl ? (
            <Button asChild size="sm" variant="outline" className="gap-2">
              <a href={downloadUrl}>
                <Download className="h-4 w-4" />
                Descargar
              </a>
            </Button>
          ) : null}
          {previewUrl ? (
            <Button asChild size="sm" variant="outline" className="gap-2">
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir en pestaña
              </a>
            </Button>
          ) : null}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando PDF…
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              {previewUrl ? (
                <Button asChild size="sm" variant="outline">
                  <a href={previewUrl} target="_blank" rel="noreferrer">
                    Abrir en pestaña
                  </a>
                </Button>
              ) : null}
            </div>
          ) : blobUrl ? (
            <object
              key={blobUrl}
              data={blobUrl}
              type="application/pdf"
              title={doc ? `PDF ${doc.tipoDoc}` : "PDF"}
              className="h-full w-full bg-white"
            >
              <iframe
                title={doc ? `PDF ${doc.tipoDoc}` : "PDF"}
                src={blobUrl}
                className="h-full w-full bg-white"
              />
            </object>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Sin archivo para previsualizar
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
