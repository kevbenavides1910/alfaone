"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  formatCurrency,
  formatDate,
  calendarDateInputValue,
  formatServicePeriodDates,
} from "@/lib/utils/format";
import { FACTURA_MENSUAL_STATUS_LABELS } from "@/lib/utils/constants";
import { FacturaTimelinessBadge } from "@/components/facturacion/FacturaTimelinessBadge";

export type FacturaRequisitoRow = {
  id: string;
  requirementName: string;
  status: "PENDIENTE" | "COMPLETADO";
  fileName: string | null;
  hasFile: boolean;
  downloadUrl: string | null;
};

export type FacturaMensualRow = {
  id: string;
  contractId: string;
  periodMonth: number;
  periodYear: number;
  expectedIssueDate: string;
  dueDate: string;
  lastPriceUpdateCopied: string;
  status: keyof typeof FACTURA_MENSUAL_STATUS_LABELS;
  closedAt: string | null;
  closedOnTime: boolean | null;
  closeDaysLate: number | null;
  amountDefined: boolean;
  hiringTypeCopied?: "FIXED" | "ON_DEMAND";
  finalNotes: string | null;
  observationLog: string | null;
  invoiceNumber: string | null;
  documentNumber: string | null;
  servicePeriodFromDate: string;
  servicePeriodToDate: string;
  invoiceReceivedAt: string | null;
  subtotalCopied: number | null;
  ivaPctCopied: number;
  totalCalculated: number | null;
  clientNameCopied: string;
  companyCodeCopied: string;
  licitacionNo?: string;
  requisitos: FacturaRequisitoRow[];
};

interface Props {
  factura: FacturaMensualRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

const STATUS_VARIANT: Record<
  FacturaMensualRow["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDIENTE_DEFINIR: "outline",
  PENDIENTE: "secondary",
  EN_PROCESO: "outline",
  FACTURADO: "default",
  COBRADO: "default",
};

export function FacturacionDetailDialog({ factura, open, onOpenChange, canEdit }: Props) {
  const qc = useQueryClient();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [observationLog, setObservationLog] = useState("");
  const [finalNotes, setFinalNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [servicePeriodFromDate, setServicePeriodFromDate] = useState("");
  const [servicePeriodToDate, setServicePeriodToDate] = useState("");
  const [invoiceReceivedAt, setInvoiceReceivedAt] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    if (factura) {
      setObservationLog(factura.observationLog ?? "");
      setFinalNotes(factura.finalNotes ?? "");
      setInvoiceNumber(factura.invoiceNumber ?? "");
      setDocumentNumber(factura.documentNumber ?? "");
      setServicePeriodFromDate(calendarDateInputValue(factura.servicePeriodFromDate));
      setServicePeriodToDate(calendarDateInputValue(factura.servicePeriodToDate));
      setInvoiceReceivedAt(calendarDateInputValue(factura.invoiceReceivedAt ?? ""));
      setDueDate(calendarDateInputValue(factura.dueDate));
    }
  }, [factura]);

  const isClosed =
    factura?.status === "FACTURADO" || factura?.status === "COBRADO";
  const amountPending = factura?.status === "PENDIENTE_DEFINIR";

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      observationLog?: string;
      finalNotes?: string;
      invoiceNumber?: string | null;
      documentNumber?: string | null;
      servicePeriodFromDate?: string | null;
      servicePeriodToDate?: string | null;
      invoiceReceivedAt?: string | null;
      dueDate?: string;
    }) => {
      if (!factura) throw new Error("Sin factura");
      const r = await fetch(`/api/facturacion/${factura.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json.data as FacturaMensualRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      toast.success("Cambios guardados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!factura) throw new Error("Sin factura");
      const r = await fetch(`/api/facturacion/${factura.id}?action=cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalNotes: finalNotes.trim() || undefined }),
      });
      const json = await r.json();
      if (json.error) {
        const pending = json.error.details?.pending as string[] | undefined;
        const msg = pending?.length
          ? `${json.error.message}: ${pending.join(", ")}`
          : json.error.message;
        throw new Error(msg);
      }
      return json.data as FacturaMensualRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      toast.success("Facturación cerrada correctamente");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(requisitoId: string, file: File) {
    if (!factura) return;
    setUploadingId(requisitoId);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(
        `/api/facturacion/${factura.id}/requisitos/${requisitoId}/archivo`,
        { method: "POST", body: form }
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al subir");
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      toast.success("Entregable subido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setUploadingId(null);
    }
  }

  if (!factura) return null;

  const allRequisitosComplete =
    factura.requisitos.length === 0 ||
    factura.requisitos.every((r) => r.hasFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{factura.clientNameCopied}</span>
            <Badge variant={STATUS_VARIANT[factura.status]}>
              {FACTURA_MENSUAL_STATUS_LABELS[factura.status]}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {factura.licitacionNo && <>Licitación {factura.licitacionNo} · </>}
            {factura.companyCodeCopied} · {factura.periodMonth}/{factura.periodYear}
          </p>
        </DialogHeader>

        {amountPending && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            El monto de este mes aún no está definido. Indíquelo en el contrato, pestaña{" "}
            <Link href={`/contracts/${factura.contractId}`} className="font-medium underline">
              Facturación por demanda
            </Link>
            .
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-lg p-3">
          <div>
            <p className="text-xs text-slate-500">Subtotal</p>
            <p className="font-semibold">
              {factura.amountDefined && factura.subtotalCopied != null
                ? formatCurrency(factura.subtotalCopied)
                : "Pendiente de definir"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">IVA</p>
            <p className="font-semibold">{factura.ivaPctCopied.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="font-semibold text-blue-700">
              {factura.amountDefined && factura.totalCalculated != null
                ? formatCurrency(factura.totalCalculated)
                : "—"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Datos de la factura</h4>
            <p className="text-xs text-slate-500">
              Referencias del documento emitido y periodo de servicio que se factura.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="invoiceNumber" className="text-xs text-slate-500 font-normal">
                Número de factura
              </Label>
              <Input
                id="invoiceNumber"
                disabled={!canEdit}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej. A-12345"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documentNumber" className="text-xs text-slate-500 font-normal">
                Número de documento
              </Label>
              <Input
                id="documentNumber"
                disabled={!canEdit}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ej. DOC-2026-001"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceReceivedAt" className="text-xs text-slate-500 font-normal">
                Fecha de recepción de la factura
              </Label>
              <Input
                id="invoiceReceivedAt"
                type="date"
                disabled={!canEdit}
                value={invoiceReceivedAt}
                onChange={(e) => setInvoiceReceivedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-slate-500 font-normal">
              Periodo de servicio facturado
            </Label>
            {servicePeriodFromDate && servicePeriodToDate && (
              <p className="text-xs text-slate-500">
                {formatServicePeriodDates(servicePeriodFromDate, servicePeriodToDate)}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="servicePeriodFromDate" className="text-xs text-slate-500 font-normal">
                  Desde
                </Label>
                <Input
                  id="servicePeriodFromDate"
                  type="date"
                  disabled={!canEdit}
                  value={servicePeriodFromDate}
                  onChange={(e) => setServicePeriodFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="servicePeriodToDate" className="text-xs text-slate-500 font-normal">
                  Hasta
                </Label>
                <Input
                  id="servicePeriodToDate"
                  type="date"
                  disabled={!canEdit}
                  value={servicePeriodToDate}
                  onChange={(e) => setServicePeriodToDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() =>
                saveMutation.mutate({
                  invoiceNumber: invoiceNumber.trim() || null,
                  documentNumber: documentNumber.trim() || null,
                  servicePeriodFromDate: servicePeriodFromDate || null,
                  servicePeriodToDate: servicePeriodToDate || null,
                  invoiceReceivedAt: invoiceReceivedAt || null,
                })
              }
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Guardar datos de factura
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Emisión esperada</p>
            <p className="font-medium text-slate-800">{formatDate(factura.expectedIssueDate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs text-slate-500">Últ. actualización precio</p>
            <p className="font-medium text-slate-800">{formatDate(factura.lastPriceUpdateCopied)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
            <Label htmlFor="dueDate" className="text-xs text-slate-500 font-normal">
              Vencimiento factura
            </Label>
            <Input
              id="dueDate"
              type="date"
              disabled={!canEdit || isClosed}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {canEdit && !isClosed && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={saveMutation.isPending || !dueDate}
                onClick={() => saveMutation.mutate({ dueDate })}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Guardar vencimiento
              </Button>
            )}
          </div>
        </div>

        {isClosed && factura.closedAt && (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">Fecha de cierre de facturación</p>
              <p className="font-medium text-slate-800">{formatDate(factura.closedAt)}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Emisión esperada: {formatDate(factura.expectedIssueDate)}
              </p>
            </div>
            {factura.closedOnTime != null && factura.closeDaysLate != null && (
              <FacturaTimelinessBadge
                closedOnTime={factura.closedOnTime}
                closeDaysLate={factura.closeDaysLate}
              />
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="observationLog">Bitácora de observaciones</Label>
          <textarea
            id="observationLog"
            rows={4}
            disabled={!canEdit || isClosed}
            value={observationLog}
            onChange={(e) => setObservationLog(e.target.value)}
            placeholder="Notas críticas del mes (retrasos, incidencias, acuerdos con el cliente...)"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {canEdit && !isClosed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ observationLog })}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Guardar bitácora
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Requisitos del mes</h4>
            <p className="text-xs text-slate-500">
              Cada entregable obligatorio debe tener un archivo adjunto antes de cerrar la facturación.
            </p>
          </div>
          {factura.requisitos.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin requisitos configurados en el contrato.</p>
          ) : (
            <ul className="space-y-2">
              {factura.requisitos.map((req) => (
                <li
                  key={req.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
                >
                  {req.hasFile ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{req.requirementName}</p>
                    {req.fileName && (
                      <a
                        href={req.downloadUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        {req.fileName}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  {canEdit && !isClosed && (
                    <div className="shrink-0">
                      <input
                        ref={(el) => {
                          fileInputRefs.current[req.id] = el;
                        }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(req.id, file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant={req.hasFile ? "outline" : "default"}
                        size="sm"
                        className="gap-1"
                        disabled={uploadingId === req.id}
                        onClick={() => fileInputRefs.current[req.id]?.click()}
                      >
                        {uploadingId === req.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {req.hasFile ? "Reemplazar" : "Subir"}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="finalNotes">Notas finales de cierre</Label>
          <textarea
            id="finalNotes"
            rows={3}
            disabled={!canEdit || isClosed}
            value={finalNotes}
            onChange={(e) => setFinalNotes(e.target.value)}
            placeholder="Resumen al cerrar la facturación del mes..."
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {canEdit && !isClosed && (
            <Button
              type="button"
              disabled={closeMutation.isPending || !allRequisitosComplete || amountPending}
              onClick={() => closeMutation.mutate()}
              className="gap-1.5"
            >
              {closeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Cerrar facturación
            </Button>
          )}
          {canEdit && !isClosed && amountPending && (
            <p className="text-xs text-amber-600 w-full sm:w-auto">
              Defina el monto en el contrato antes de cerrar.
            </p>
          )}
          {canEdit && !isClosed && !amountPending && !allRequisitosComplete && factura.requisitos.length > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1 w-full sm:w-auto">
              <XCircle className="h-3.5 w-3.5" />
              Faltan entregables por subir
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
