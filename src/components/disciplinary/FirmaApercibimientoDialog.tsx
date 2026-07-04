"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apercibimiento: {
    id: string;
    numero: string;
    nombreEmpleado: string;
    firmado?: boolean;
  } | null;
  onSuccess?: () => void;
};

export function FirmaApercibimientoDialog({ open, onOpenChange, apercibimiento, onSuccess }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasStroke(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(resetCanvas, 50);
    return () => window.clearTimeout(t);
  }, [open, apercibimiento?.id, resetCanvas]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  }

  async function submit() {
    const canvas = canvasRef.current;
    if (!canvas || !apercibimiento) return;
    if (!hasStroke) {
      toast.error("Dibuje la firma antes de guardar");
      return;
    }
    setSaving(true);
    try {
      const signatureDataUrl = canvas.toDataURL("image/png");
      const res = await fetch(`/api/disciplinary/apercibimientos/${apercibimiento.id}/firmar`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { emailSent?: boolean; emailTo?: string | null };
      };
      if (!res.ok) throw new Error(json.error ?? "Error al firmar");

      if (json.data?.emailSent) {
        toast.success(
          "Apercibimiento firmado",
          `PDF firmado enviado a ${json.data.emailTo ?? "destinatarios configurados"} (oficial, administrador y CC).`,
        );
      } else {
        toast.success(
          "Firma guardada",
          "El PDF incluye la firma. No se envió correo (revise SMTP o correos del empleado/zona).",
        );
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error("No se pudo firmar", e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5 text-violet-600" />
            Firmar apercibimiento
          </DialogTitle>
          <DialogDescription>
            {apercibimiento ? (
              <>
                <strong>{apercibimiento.numero}</strong> — {apercibimiento.nombreEmpleado}. La firma se
                incrusta en el PDF (Recibido por) y se envía el documento firmado al oficial, al administrador
                de zona y al correo CC fijo.
              </>
            ) : (
              "Seleccione un apercibimiento."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Dibuje la firma del oficial con el mouse o el dedo:</p>
          <div className="rounded-lg border bg-white overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              width={640}
              height={200}
              className="w-full h-[200px] cursor-crosshair block"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={resetCanvas} disabled={saving}>
              <Eraser className="h-4 w-4 mr-1" /> Limpiar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || !hasStroke}>
            {saving ? "Guardando…" : "Firmar y enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
