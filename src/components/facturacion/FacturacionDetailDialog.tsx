"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Link2,
  Loader2,
  Trash2,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate, calendarDateInputValue, formatServicePeriodDates } from "@/lib/utils/format";
import { FACTURA_BILLING_KIND_LABELS, FACTURA_MENSUAL_STATUS_LABELS } from "@/lib/utils/constants";
import { FacturaTimelinessBadge } from "@/components/facturacion/FacturaTimelinessBadge";

export type FacturaRequisitoRow = {
  id: string;
  facturaMensualEmisionId?: string | null;
  administrationName?: string | null;
  requirementName: string;
  status: "PENDIENTE" | "COMPLETADO";
  requiresEvidence: boolean;
  fileName: string | null;
  hasFile: boolean;
  isComplete: boolean;
  downloadUrl: string | null;
  sortOrder?: number;
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
  documentNumber?: string | null;
  servicePeriodFromDate?: string;
  servicePeriodToDate?: string;
  invoiceReceivedAt?: string | null;
  isReajuste?: boolean;
  subtotalCopied: number | null;
  ivaPctCopied: number;
  totalCalculated: number | null;
  /** Monto definido en contrato (registro de venta) para el periodo. */
  contractVentaSubtotal?: number | null;
  contractVentaTotal?: number | null;
  /** Facturado − venta contrato (subtotal). */
  ventaFacturadoDelta?: number | null;
  clientNameCopied: string;
  companyCodeCopied: string;
  licitacionNo?: string;
  requisitos: FacturaRequisitoRow[];
  emisiones?: {
    id: string;
    administrationName?: string | null;
    managerName?: string | null;
    zoneName?: string | null;
    sortOrder?: number;
    closedAt?: string | null;
    invoiceNumber?: string | null;
    documentNumber?: string | null;
    invoiceReceivedAt?: string | null;
    status?: keyof typeof FACTURA_MENSUAL_STATUS_LABELS;
    subtotalCopied?: number | null;
    totalCalculated?: number | null;
    subtotalFacturadoNaf?: number | null;
    totalFacturadoNaf?: number | null;
    contractVentaSubtotal?: number | null;
    contractVentaTotal?: number | null;
    ventaFacturadoDelta?: number | null;
    nafLinks?: {
      id: string;
      nafNoCia: string;
      nafTipoDoc: string;
      nafNoFactu: string;
      nafNoFisico: string | null;
      nafConsecutivoFe?: string | null;
      subtotal: number;
      impuesto: number;
      total: number;
      amountSign: number;
      signedTotal: number;
      linkedAt: string;
    }[];
  }[];
  totalFacturadoNaf?: number | null;
  subtotalFacturadoNaf?: number | null;
  returnRequestStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
  returnRequestType?: "DOCUMENTATION" | "AMOUNT" | null;
  returnRequestRequestedSubtotal?: number | null;
  lastCorrectionType?: "DOCUMENTATION" | "AMOUNT" | null;
  lastCorrectionPreviousSubtotal?: number | null;
  lastCorrectionReason?: string | null;
  isModifiedAfterBilling?: boolean;
};

interface Props {
  factura: FacturaMensualRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  /** Emisión (administración) seleccionada en la lista, para mostrar solo sus requisitos. */
  focusedEmisionId?: string | null;
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

export function FacturacionDetailDialog({
  factura,
  open,
  onOpenChange,
  canEdit,
  focusedEmisionId,
}: Props) {
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
  const [invoiceReceivedAtDirty, setInvoiceReceivedAtDirty] = useState(false);
  const [dueDateDirty, setDueDateDirty] = useState(false);
  const [isReajuste, setIsReajuste] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [requestedSubtotal, setRequestedSubtotal] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [viewEmisionId, setViewEmisionId] = useState<string | null>(null);
  const [nafSearch, setNafSearch] = useState("");
  const [nafCandidates, setNafCandidates] = useState<
    {
      noCia: string;
      tipoDoc: string;
      noFactu: string;
      noFisico: string | null;
      consecutivoFe?: string | null;
      cliente: string;
      total: number;
      fecha: string;
      yaLigado?: boolean;
    }[]
  >([]);
  const [nafLoading, setNafLoading] = useState(false);
  const [nafBusyId, setNafBusyId] = useState<string | null>(null);

  // Seed form only when opening / switching factura — avoid wiping unsaved dates on NAF invalidate.
  useEffect(() => {
    if (!open || !factura) return;
    setObservationLog(factura.observationLog ?? "");
    setFinalNotes(factura.finalNotes ?? "");
    setInvoiceNumber(factura.invoiceNumber ?? "");
    setDocumentNumber(factura.documentNumber ?? "");
    setServicePeriodFromDate(calendarDateInputValue(factura.servicePeriodFromDate ?? ""));
    setServicePeriodToDate(calendarDateInputValue(factura.servicePeriodToDate ?? ""));
    setInvoiceReceivedAt(calendarDateInputValue(factura.invoiceReceivedAt ?? ""));
    setDueDate(calendarDateInputValue(factura.dueDate));
    setInvoiceReceivedAtDirty(false);
    setDueDateDirty(false);
    setIsReajuste(factura.isReajuste ?? false);
  }, [open, factura?.id]);

  useEffect(() => {
    if (!open || !factura) return;
    const em =
      (viewEmisionId || focusedEmisionId)
        ? factura.emisiones?.find((e) => e.id === (viewEmisionId || focusedEmisionId))
        : null;
    if (!em) return;
    setInvoiceNumber(em.invoiceNumber ?? factura.invoiceNumber ?? "");
    setDocumentNumber(em.documentNumber ?? factura.documentNumber ?? "");
    if (em.invoiceReceivedAt) {
      setInvoiceReceivedAt(calendarDateInputValue(em.invoiceReceivedAt));
    }
  }, [open, factura?.id, viewEmisionId, focusedEmisionId]);

  useEffect(() => {
    if (!open) {
      setViewEmisionId(null);
      setNafSearch("");
      setNafCandidates([]);
      return;
    }
    if (focusedEmisionId) {
      setViewEmisionId(focusedEmisionId);
      return;
    }
    if (factura?.emisiones?.length) {
      setViewEmisionId(factura.emisiones[0]?.id ?? null);
    }
  }, [open, focusedEmisionId, factura?.id, factura?.emisiones]);

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
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      toast.success("Cambios guardados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!factura) throw new Error("Sin factura");
      const multiAdmin = (factura.emisiones?.length ?? 0) > 0;
      const emisionId = multiAdmin
        ? viewEmisionId ?? focusedEmisionId ?? factura.emisiones?.[0]?.id
        : undefined;
      const r = await fetch(`/api/facturacion/${factura.id}?action=cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalNotes: finalNotes.trim() || undefined,
          isReajuste,
          ...(emisionId ? { emisionId } : {}),
        }),
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      const allClosed = data.status === "FACTURADO" || data.status === "COBRADO";
      toast.success(
        allClosed ? "Facturación cerrada correctamente" : "Administración cerrada correctamente"
      );
      if (allClosed) onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tipoMutation = useMutation({
    mutationFn: async (nextIsReajuste: boolean) => {
      if (!factura) throw new Error("Sin factura");
      const r = await fetch(`/api/facturacion/${factura.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReajuste: nextIsReajuste }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar tipo");
      return json.data as FacturaMensualRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      toast.success("Tipo de factura actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correctionMutation = useMutation({
    mutationFn: async ({
      action,
      body,
    }: {
      action: "documentation" | "amount" | "approve" | "reject";
      body?: Record<string, unknown>;
    }) => {
      if (!factura) throw new Error("Sin factura");
      const r = await fetch(`/api/facturacion/${factura.id}/return-request?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al procesar corrección");
      return json.data as FacturaMensualRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      setReturnReason("");
      setRequestedSubtotal("");
      setReviewNote("");
      toast.success("Solicitud procesada");
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

  async function handleToggleRequisito(requisitoId: string, completed: boolean) {
    if (!factura) return;
    setTogglingId(requisitoId);
    try {
      const r = await fetch(`/api/facturacion/${factura.id}/requisitos/${requisitoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al actualizar");
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      toast.success(completed ? "Requisito marcado como cumplido" : "Requisito marcado como pendiente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setTogglingId(null);
    }
  }

  const hasEmisiones = (factura?.emisiones?.length ?? 0) > 0;
  const effectiveFocusedEmisionId =
    viewEmisionId ?? focusedEmisionId ?? (hasEmisiones ? (factura?.emisiones?.[0]?.id ?? null) : null);

  const activeRequisitos = useMemo(() => {
    const reqs = factura?.requisitos ?? [];
    if (!hasEmisiones) return reqs;
    if (effectiveFocusedEmisionId) {
      return reqs.filter((r) => r.facturaMensualEmisionId === effectiveFocusedEmisionId);
    }
    return reqs.filter((r) => r.facturaMensualEmisionId != null);
  }, [factura?.requisitos, hasEmisiones, effectiveFocusedEmisionId]);

  const requisitoGroups = useMemo(() => {
    if (!factura) return [];

    if (effectiveFocusedEmisionId) {
      const reqs = activeRequisitos.filter(
        (r) => r.facturaMensualEmisionId === effectiveFocusedEmisionId
      );
      const emision = factura.emisiones?.find((e) => e.id === effectiveFocusedEmisionId);
      return [
        {
          key: effectiveFocusedEmisionId,
          label: emision?.administrationName ?? "Administración",
          reqs,
        },
      ];
    }

    const byEmision = new Map<string, FacturaRequisitoRow[]>();
    for (const req of activeRequisitos) {
      const key = req.facturaMensualEmisionId ?? "__general__";
      const list = byEmision.get(key) ?? [];
      list.push(req);
      byEmision.set(key, list);
    }

    if (byEmision.size <= 1) {
      return [{ key: "__all__", label: null as string | null, reqs: activeRequisitos }];
    }

    return (factura.emisiones ?? [])
      .map((em) => ({
        key: em.id,
        label: em.administrationName ?? `Administración ${(em.sortOrder ?? 0) + 1}`,
        reqs: byEmision.get(em.id) ?? [],
      }))
      .filter((g) => g.reqs.length > 0);
  }, [activeRequisitos, factura, effectiveFocusedEmisionId]);

  const focusedEmision = effectiveFocusedEmisionId
    ? factura?.emisiones?.find((e) => e.id === effectiveFocusedEmisionId)
    : null;

  const isClosed =
    factura?.status === "COBRADO" ||
    (hasEmisiones && focusedEmision
      ? focusedEmision.status === "FACTURADO" || Boolean(focusedEmision.closedAt)
      : factura?.status === "FACTURADO");

  const allRequisitosComplete =
    activeRequisitos.length === 0 ||
    activeRequisitos.every((r) => r.isComplete);


  const nafLinks = focusedEmision?.nafLinks ?? [];
  const hasNafLinks = nafLinks.length > 0;
  const emisionIdForNaf =
    effectiveFocusedEmisionId ?? (!hasEmisiones ? null : factura?.emisiones?.[0]?.id ?? null);

  async function searchNafCandidates() {
    if (!factura || !emisionIdForNaf) return;
    setNafLoading(true);
    try {
      const params = new URLSearchParams({
        includeSearch: "1",
        periodMonth: String(factura.periodMonth),
        periodYear: String(factura.periodYear),
      });
      if (nafSearch.trim()) params.set("search", nafSearch.trim());
      const r = await fetch(
        `/api/facturacion/${factura.id}/emisiones/${emisionIdForNaf}/naf-docs?${params}`
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al buscar NAF");
      setNafCandidates(json.data?.candidates?.rows ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al buscar NAF");
    } finally {
      setNafLoading(false);
    }
  }

  async function linkNafDoc(doc: {
    noCia: string;
    tipoDoc: string;
    noFactu: string;
    noFisico?: string | null;
    consecutivoFe?: string | null;
  }) {
    if (!factura || !emisionIdForNaf) return;
    const key = `${doc.noCia}-${doc.tipoDoc}-${doc.noFactu}`;
    setNafBusyId(key);
    try {
      const r = await fetch(
        `/api/facturacion/${factura.id}/emisiones/${emisionIdForNaf}/naf-docs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            noCia: doc.noCia,
            tipoDoc: doc.tipoDoc,
            noFactu: doc.noFactu,
            // Only send dates the user explicitly changed; otherwise NAF FECHA/PLAZO apply
            ...(invoiceReceivedAtDirty && invoiceReceivedAt
              ? { invoiceReceivedAt }
              : {}),
            ...(dueDateDirty && dueDate && !isClosed ? { dueDate } : {}),
          }),
        }
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al ligar");
      const data = json.data as {
        link?: {
          nafNoFisico?: string | null;
          nafConsecutivoFe?: string | null;
        };
        invoiceNumber?: string | null;
        documentNumber?: string | null;
        invoiceReceivedAt?: string | null;
        dueDate?: string | null;
      };
      const electronic =
        data.invoiceNumber?.trim() ||
        data.link?.nafConsecutivoFe?.trim() ||
        doc.consecutivoFe?.trim() ||
        "";
      const physical =
        data.documentNumber?.trim() ||
        data.link?.nafNoFisico?.trim() ||
        doc.noFisico?.trim() ||
        "";
      if (electronic) setInvoiceNumber(electronic);
      if (physical) setDocumentNumber(physical);
      if (!invoiceReceivedAtDirty && data.invoiceReceivedAt) {
        setInvoiceReceivedAt(calendarDateInputValue(data.invoiceReceivedAt));
      }
      if (!dueDateDirty && data.dueDate && !isClosed) {
        setDueDate(calendarDateInputValue(data.dueDate));
      }
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["facturacion-documentos-naf"] });
      toast.success("Documento NAF ligado");
      setNafCandidates((prev) =>
        prev.filter((c) => !(c.noCia === doc.noCia && c.tipoDoc === doc.tipoDoc && c.noFactu === doc.noFactu))
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al ligar");
    } finally {
      setNafBusyId(null);
    }
  }

  async function unlinkNafDoc(linkId: string) {
    if (!factura || !emisionIdForNaf) return;
    setNafBusyId(linkId);
    try {
      const r = await fetch(
        `/api/facturacion/${factura.id}/emisiones/${emisionIdForNaf}/naf-docs?linkId=${encodeURIComponent(linkId)}`,
        { method: "DELETE" }
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al desligar");
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["facturacion-documentos-naf"] });
      toast.success("Documento NAF desligado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al desligar");
    } finally {
      setNafBusyId(null);
    }
  }


  if (!factura) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>{factura.clientNameCopied}</span>
            <Badge variant={STATUS_VARIANT[factura.status]}>
              {FACTURA_MENSUAL_STATUS_LABELS[factura.status]}
            </Badge>
            {(isReajuste || factura.isReajuste) && (
              <Badge variant="outline" className="border-amber-300 text-amber-800">
                {FACTURA_BILLING_KIND_LABELS.reajuste}
              </Badge>
            )}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {factura.licitacionNo && <>Licitación {factura.licitacionNo} · </>}
            {factura.companyCodeCopied} · {factura.periodMonth}/{factura.periodYear}
            {focusedEmision?.administrationName && (
              <> · {focusedEmision.administrationName}</>
            )}
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm bg-slate-50 rounded-lg p-3">
          <div>
            <p className="text-xs text-slate-500">Venta contrato</p>
            <p className="font-semibold">
              {(focusedEmision?.contractVentaSubtotal ?? factura.contractVentaSubtotal) != null
                ? formatCurrency(focusedEmision?.contractVentaSubtotal ?? factura.contractVentaSubtotal!)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Facturado NAF (neto)</p>
            <p className="font-semibold">
              {(focusedEmision?.subtotalFacturadoNaf ??
                focusedEmision?.subtotalCopied ??
                factura.subtotalFacturadoNaf ??
                factura.subtotalCopied) != null
                ? formatCurrency(
                    focusedEmision?.subtotalFacturadoNaf ??
                      focusedEmision?.subtotalCopied ??
                      factura.subtotalFacturadoNaf ??
                      factura.subtotalCopied!
                  )
                : "Pendiente"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Diferencia</p>
            <p
              className={`font-semibold ${
                (focusedEmision?.ventaFacturadoDelta ?? factura.ventaFacturadoDelta ?? 0) === 0
                  ? "text-slate-700"
                  : (focusedEmision?.ventaFacturadoDelta ?? factura.ventaFacturadoDelta ?? 0) > 0
                    ? "text-amber-700"
                    : "text-rose-700"
              }`}
            >
              {(focusedEmision?.ventaFacturadoDelta ?? factura.ventaFacturadoDelta) != null
                ? formatCurrency(focusedEmision?.ventaFacturadoDelta ?? factura.ventaFacturadoDelta!)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total c/IVA</p>
            <p className="font-semibold text-slate-700">
              {(focusedEmision?.totalFacturadoNaf ??
                focusedEmision?.totalCalculated ??
                factura.totalFacturadoNaf ??
                factura.totalCalculated) != null
                ? formatCurrency(
                    focusedEmision?.totalFacturadoNaf ??
                      focusedEmision?.totalCalculated ??
                      factura.totalFacturadoNaf ??
                      factura.totalCalculated!
                  )
                : "—"}
            </p>
          </div>
        </div>


        {emisionIdForNaf && (
          <div className="rounded-lg border border-slate-200 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" />
                  Documentos NAF ligados
                </h4>
                <p className="text-xs text-slate-500">
                  FC/ND suman; NC/AN restan. El neto actualiza el monto facturado oficial.
                </p>
              </div>
            </div>

            {nafLinks.length === 0 ? (
              <p className="text-sm text-slate-500">Ningún documento NAF ligado a esta administración.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
                {nafLinks.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{link.nafTipoDoc}</Badge>
                        <span className="font-medium tabular-nums">
                          {link.nafNoFisico ?? link.nafNoFactu}
                        </span>
                        <span
                          className={`tabular-nums font-medium ${
                            link.amountSign < 0 ? "text-rose-700" : "text-emerald-700"
                          }`}
                        >
                          {link.amountSign < 0 ? "−" : "+"}
                          {formatCurrency(Math.abs(link.signedTotal))}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {link.nafNoCia} · {link.nafNoFactu}
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-slate-500 hover:text-rose-700"
                        disabled={nafBusyId === link.id}
                        onClick={() => unlinkNafDoc(link.id)}
                        title="Quitar vínculo"
                      >
                        {nafBusyId === link.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <Input
                    value={nafSearch}
                    onChange={(e) => setNafSearch(e.target.value)}
                    placeholder="Buscar cliente, nº físico, clave FE…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void searchNafCandidates();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={nafLoading}
                    onClick={() => void searchNafCandidates()}
                  >
                    {nafLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                  </Button>
                </div>
                {nafCandidates.length > 0 && (
                  <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-md border border-slate-100">
                    {nafCandidates.map((c) => {
                      const key = `${c.noCia}-${c.tipoDoc}-${c.noFactu}`;
                      const already = nafLinks.some(
                        (l) =>
                          l.nafNoCia === c.noCia &&
                          l.nafTipoDoc === c.tipoDoc &&
                          l.nafNoFactu === c.noFactu
                      );
                      return (
                        <li key={key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{c.tipoDoc}</Badge>
                              <span className="font-medium">{c.noFisico ?? c.noFactu}</span>
                              {c.consecutivoFe ? (
                                <span className="text-xs text-slate-500 tabular-nums">
                                  FE {c.consecutivoFe}
                                </span>
                              ) : null}
                              <span className="tabular-nums text-slate-600">{formatCurrency(c.total)}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{c.cliente}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={already || c.yaLigado || nafBusyId === key}
                            onClick={() => void linkNafDoc(c)}
                          >
                            {nafBusyId === key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : already ? (
                              "Ligado"
                            ) : (
                              "Ligar"
                            )}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

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
                disabled={!canEdit || hasNafLinks}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={hasNafLinks ? "Consecutivo FE desde NAF" : "Ej. A-12345"}
                maxLength={100}
              />
              {hasNafLinks && (
                <p className="text-[11px] text-slate-500">
                  Se toma del consecutivo electrónico (F_ELECTRONICA) del FC ligado.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documentNumber" className="text-xs text-slate-500 font-normal">
                Número de documento
              </Label>
              <Input
                id="documentNumber"
                disabled={!canEdit || hasNafLinks}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={hasNafLinks ? "Nº físico desde NAF" : "Ej. DOC-2026-001"}
                maxLength={100}
              />
              {hasNafLinks && (
                <p className="text-[11px] text-slate-500">
                  Se toma del número físico (NO_FISICO) del FC ligado.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceReceivedAt" className="text-xs text-slate-500 font-normal">
                Recibido conforme
              </Label>
              <Input
                id="invoiceReceivedAt"
                type="date"
                disabled={!canEdit}
                value={invoiceReceivedAt}
                onChange={(e) => {
                  setInvoiceReceivedAt(e.target.value);
                  setInvoiceReceivedAtDirty(true);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="servicePeriodFromDate" className="text-xs text-slate-500 font-normal">
                Periodo servicio desde
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
                Periodo servicio hasta
              </Label>
              <Input
                id="servicePeriodToDate"
                type="date"
                disabled={!canEdit}
                value={servicePeriodToDate}
                onChange={(e) => setServicePeriodToDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-xs text-slate-500 font-normal">
                Vencimiento factura
              </Label>
              <Input
                id="dueDate"
                type="date"
                disabled={!canEdit || isClosed}
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueDateDirty(true);
                }}
              />
            </div>
          </div>

          {servicePeriodFromDate && servicePeriodToDate && (
            <p className="text-xs text-slate-500">
              Periodo: {formatServicePeriodDates(servicePeriodFromDate, servicePeriodToDate)}
            </p>
          )}

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
                  ...(isClosed ? {} : { dueDate: dueDate || undefined }),
                })
              }
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Guardar datos de factura
            </Button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-1">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Emisión esperada</p>
              <p className="font-medium text-slate-800">{formatDate(factura.expectedIssueDate)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Últ. actualización precio</p>
              <p className="font-medium text-slate-800">{formatDate(factura.lastPriceUpdateCopied)}</p>
            </div>
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
              {hasEmisiones
                ? "Cada administración se cierra por separado. Complete los requisitos de la pestaña activa y use Cerrar facturación."
                : "Los requisitos con evidencia deben tener un archivo adjunto. Los demás se marcan como cumplidos con el check."}
            </p>
          </div>
          {hasEmisiones && (factura.emisiones?.length ?? 0) > 1 && (
            <div className="flex flex-wrap gap-2">
              {(factura.emisiones ?? []).map((em) => {
                const reqs = (factura.requisitos ?? []).filter(
                  (r) => r.facturaMensualEmisionId === em.id
                );
                const pending = reqs.filter((r) => !r.isComplete).length;
                const active = effectiveFocusedEmisionId === em.id;
                const emClosed = em.status === "FACTURADO" || em.status === "COBRADO" || Boolean(em.closedAt);
                return (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => setViewEmisionId(em.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-red-600 bg-red-600 text-white"
                        : emClosed
                          ? "border-green-300 bg-green-50 text-green-900 hover:bg-green-100"
                          : pending > 0
                            ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {em.administrationName ?? `Administración ${(em.sortOrder ?? 0) + 1}`}
                    {reqs.length > 0 && (
                      <span className={`ml-1.5 text-xs ${active ? "text-white/90" : "text-slate-500"}`}>
                        {emClosed ? "Cerrada" : `(${reqs.length - pending}/${reqs.length})`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {activeRequisitos.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin requisitos configurados en el contrato.</p>
          ) : (
            <div className="space-y-4">
              {requisitoGroups.map((group) => (
                <div key={group.key} className="space-y-2">
                  {group.label && requisitoGroups.length > 1 && (
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      {group.label}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {group.reqs.map((req) => (
                      <li
                        key={req.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 p-3"
                      >
                        {req.isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{req.requirementName}</p>
                          {!req.requiresEvidence && (
                            <p className="text-xs text-slate-500 mt-0.5">Solo confirmación (sin evidencia)</p>
                          )}
                          {req.fileName && (
                            <a
                              href={req.downloadUrl ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              {req.fileName}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        {canEdit && !isClosed && (
                          <div className="shrink-0">
                            {req.requiresEvidence ? (
                              <>
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
                              </>
                            ) : (
                              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300"
                                  checked={req.status === "COMPLETADO"}
                                  disabled={togglingId === req.id}
                                  onChange={(e) => handleToggleRequisito(req.id, e.target.checked)}
                                />
                                <span>Cumplido</span>
                                {togglingId === req.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              </label>
                            )}
                          </div>
                        )}
                        {!canEdit && !req.requiresEvidence && req.status === "COMPLETADO" && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            Cumplido
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingKind">Tipo de factura</Label>
          <Select
            value={isReajuste ? "reajuste" : "mensual"}
            disabled={!canEdit || factura.status === "COBRADO" || tipoMutation.isPending}
            onValueChange={(value) => {
              const next = value === "reajuste";
              setIsReajuste(next);
              if (isClosed) {
                tipoMutation.mutate(next);
              }
            }}
          >
            <SelectTrigger id="billingKind" className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mensual">{FACTURA_BILLING_KIND_LABELS.mensual}</SelectItem>
              <SelectItem value="reajuste">{FACTURA_BILLING_KIND_LABELS.reajuste}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            {isClosed
              ? "Clasificación de la factura en cuentas por cobrar. Se puede cambiar mientras no esté cobrada."
              : "Indique si corresponde a la facturación mensual regular o a un reajuste antes de cerrar."}
          </p>
        </div>

        {factura.status === "FACTURADO" && canEdit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Corrección después de facturar</h4>
              {factura.returnRequestStatus === "PENDING" && (
                <p className="text-xs text-amber-800 mt-1">
                  Solicitud pendiente
                  {factura.returnRequestRequestedSubtotal != null
                    ? ` · Subtotal solicitado: ${formatCurrency(factura.returnRequestRequestedSubtotal)}`
                    : ""}
                </p>
              )}
              {factura.isModifiedAfterBilling && factura.lastCorrectionReason && (
                <p className="text-xs text-slate-600 mt-1">{factura.lastCorrectionReason}</p>
              )}
            </div>

            {factura.returnRequestStatus === "PENDING" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={correctionMutation.isPending}
                  onClick={() => correctionMutation.mutate({ action: "approve" })}
                >
                  Aprobar cambio
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={correctionMutation.isPending}
                  onClick={() =>
                    correctionMutation.mutate({
                      action: "reject",
                      body: { reviewNote: reviewNote.trim() || null },
                    })
                  }
                >
                  Rechazar
                </Button>
                <Input
                  className="max-w-xs h-9"
                  placeholder="Nota de rechazo (opcional)"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={correctionMutation.isPending}
                    onClick={() =>
                      correctionMutation.mutate({
                        action: "documentation",
                        body: { reason: returnReason.trim() || undefined },
                      })
                    }
                  >
                    Regresar por documentación
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Justificación cambio de monto"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Nuevo subtotal solicitado"
                    value={requestedSubtotal}
                    onChange={(e) => setRequestedSubtotal(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={correctionMutation.isPending || !returnReason.trim() || !requestedSubtotal}
                  onClick={() =>
                    correctionMutation.mutate({
                      action: "amount",
                      body: {
                        reason: returnReason.trim(),
                        requestedSubtotal: Number.parseFloat(requestedSubtotal),
                      },
                    })
                  }
                >
                  Solicitar cambio de monto
                </Button>
              </div>
            )}
          </div>
        )}

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
          {canEdit && !isClosed && hasEmisiones && (
            <p className="text-xs text-slate-500 w-full sm:w-auto">
              Cierra solo la administración activa
            </p>
          )}
          {canEdit && !isClosed && amountPending && (
            <p className="text-xs text-amber-600 w-full sm:w-auto">
              Defina el monto en el contrato antes de cerrar.
            </p>
          )}
          {canEdit && !isClosed && !amountPending && !allRequisitosComplete && activeRequisitos.length > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1 w-full sm:w-auto">
              <XCircle className="h-3.5 w-3.5" />
              Complete los requisitos de{" "}
              {focusedEmision?.administrationName ?? "esta administración"} para cerrar
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
