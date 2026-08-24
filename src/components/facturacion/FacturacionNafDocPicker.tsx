"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Link2, Loader2, Search, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { labelTipoDoc } from "@/modules/naf-documentos/business/document-labels";
import type { FacturaEmisionNafLinkSerialized } from "@/modules/presupuestos/types/factura-naf-link";

type NafCandidate = {
  id: string;
  noCia: string;
  tipoDoc: string;
  noFactu: string;
  noFisico: string | null;
  cliente: string;
  fecha: string;
  total: number;
  consecutivoFe: string | null;
  yaLigado: boolean;
  ligadoEmisionId: string | null;
};

export type FacturacionNafNumbers = {
  invoiceNumber: string | null;
  documentNumber: string | null;
  invoiceReceivedAt: string | null;
  dueDate: string | null;
};

type Props = {
  facturaId: string;
  emisionId: string | null;
  periodMonth: number;
  periodYear: number;
  companyCode: string;
  canEdit: boolean;
  linkedDocs: FacturaEmisionNafLinkSerialized[];
  invoiceReceivedAt?: string;
  dueDate?: string;
  onNumbersChange: (values: FacturacionNafNumbers) => void;
};

function shortFe(consecutivo: string | null | undefined): string {
  const raw = (consecutivo ?? "").trim();
  if (!raw) return "—";
  if (/^\d{20}$/.test(raw)) {
    return raw.slice(10).replace(/^0+/, "") || "0";
  }
  return raw.replace(/^0+/, "") || raw;
}

export function FacturacionNafDocPicker({
  facturaId,
  emisionId,
  periodMonth,
  periodYear,
  companyCode,
  canEdit,
  linkedDocs,
  invoiceReceivedAt,
  dueDate,
  onNumbersChange,
}: Props) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const linksQueryKey = ["facturacion-naf-links", facturaId, emisionId];

  const { data: linksData, isFetching: linksLoading } = useQuery({
    queryKey: linksQueryKey,
    enabled: Boolean(emisionId),
    queryFn: async () => {
      const r = await fetch(`/api/facturacion/${facturaId}/emisiones/${emisionId}/naf-docs`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar vínculos NAF");
      return json.data as { links: FacturaEmisionNafLinkSerialized[] };
    },
  });

  const links = linksData?.links ?? linkedDocs;

  const { data: candidatesData, isFetching: candidatesLoading } = useQuery({
    queryKey: ["facturacion-naf-candidates", facturaId, emisionId, debouncedSearch, periodMonth, periodYear],
    enabled: pickerOpen && Boolean(emisionId),
    queryFn: async () => {
      const params = new URLSearchParams({
        includeSearch: "1",
        periodMonth: String(periodMonth),
        periodYear: String(periodYear),
        page: "1",
        pageSize: "40",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const r = await fetch(
        `/api/facturacion/${facturaId}/emisiones/${emisionId}/naf-docs?${params}`,
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al buscar documentos NAF");
      return json.data as {
        candidates: { rows: NafCandidate[]; total: number } | null;
      };
    },
  });

  const candidates = candidatesData?.candidates?.rows ?? [];

  const linkMutation = useMutation({
    mutationFn: async (row: Pick<NafCandidate, "noCia" | "tipoDoc" | "noFactu">) => {
      if (!emisionId) throw new Error("Sin administración seleccionada");
      const body: Record<string, string | null> = {
        noCia: row.noCia,
        tipoDoc: row.tipoDoc,
        noFactu: row.noFactu,
      };
      if (invoiceReceivedAt) body.invoiceReceivedAt = invoiceReceivedAt;
      if (dueDate) body.dueDate = dueDate;
      const r = await fetch(`/api/facturacion/${facturaId}/emisiones/${emisionId}/naf-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al ligar documento NAF");
      return json.data as FacturacionNafNumbers & {
        links: FacturaEmisionNafLinkSerialized[];
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: linksQueryKey });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      onNumbersChange({
        invoiceNumber: data.invoiceNumber,
        documentNumber: data.documentNumber,
        invoiceReceivedAt: data.invoiceReceivedAt,
        dueDate: data.dueDate,
      });
      toast.success("Documento NAF ligado");
      setPickerOpen(false);
      setSearch("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      if (!emisionId) throw new Error("Sin administración seleccionada");
      const r = await fetch(
        `/api/facturacion/${facturaId}/emisiones/${emisionId}/naf-docs?linkId=${encodeURIComponent(linkId)}`,
        { method: "DELETE" },
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al desligar");
      return json.data as { links: FacturaEmisionNafLinkSerialized[] };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: linksQueryKey });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      qc.invalidateQueries({ queryKey: ["cuentas-por-cobrar"] });
      if (data.links.length === 0) {
        onNumbersChange({
          invoiceNumber: null,
          documentNumber: null,
          invoiceReceivedAt: null,
          dueDate: null,
        });
      } else {
        const ranked = [...data.links].sort((a, b) => b.total - a.total);
        const fcs = ranked.filter((l) => l.nafTipoDoc.toUpperCase() === "FC");
        const pool = fcs.length > 0 ? fcs : ranked;
        const withFe = pool.find((l) => l.nafConsecutivoFe?.trim());
        const withDoc = pool.find((l) => l.nafNoFactu?.trim());
        const primary = withFe ?? withDoc ?? pool[0];
        onNumbersChange({
          invoiceNumber: primary?.nafConsecutivoFe?.trim() || null,
          documentNumber: primary?.nafNoFactu?.trim() || null,
          invoiceReceivedAt: null,
          dueDate: null,
        });
      }
      toast.success("Documento NAF desligado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!emisionId) {
    return (
      <p className="text-xs text-slate-500">
        Seleccione una administración para ligar documentos NAF.
      </p>
    );
  }

  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setPickerOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Buscar en documentos NAF
          </Button>
        )}
        {linksLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        <span className="text-xs text-slate-500">
          El número de factura y el Nº Codisa se asignan al ligar el documento NAF.
        </span>
      </div>

      {links.length > 0 && (
        <ul className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50/80 p-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center gap-2 text-xs text-slate-700"
            >
              <Link2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <Badge variant="secondary" className="font-normal">
                {labelTipoDoc(link.nafTipoDoc)}
              </Badge>
              <span className="font-medium tabular-nums">Codisa {link.nafNoFactu}</span>
              {link.nafConsecutivoFe && (
                <span className="text-slate-500 tabular-nums" title={link.nafConsecutivoFe}>
                  FE {shortFe(link.nafConsecutivoFe)}
                </span>
              )}
              <span className="text-slate-500">{formatCurrency(link.total)}</span>
              {link.nafFecha && (
                <span className="text-slate-400">{formatDate(link.nafFecha)}</span>
              )}
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 ml-auto text-slate-500 hover:text-red-600"
                  disabled={unlinkMutation.isPending}
                  onClick={() => unlinkMutation.mutate(link.id)}
                >
                  {unlinkMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">Desligar</span>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b border-slate-100">
            <DialogTitle className="text-base">Documentos NAF — {companyCode}</DialogTitle>
            <p className="text-xs text-slate-500 font-normal">
              Periodo {periodMonth}/{periodYear}. Busque por cliente, Nº Codisa, físico o consecutivo FE.
            </p>
          </DialogHeader>

          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar documento NAF…"
                className="pl-9 pr-9"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setSearch("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto min-h-[200px] max-h-[50vh]">
            {candidatesLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando en NAF…
              </div>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-12 px-4">
                {debouncedSearch
                  ? "Sin resultados. Pruebe con otro criterio o amplíe el periodo en Documentos NAF."
                  : "Escriba para buscar o espere la lista del periodo."}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 text-xs text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Tipo</th>
                    <th className="text-left px-3 py-2 font-medium">Codisa</th>
                    <th className="text-left px-3 py-2 font-medium">Nº FE</th>
                    <th className="text-left px-3 py-2 font-medium">Cliente</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((row) => {
                    const blocked =
                      row.yaLigado && row.ligadoEmisionId != null && row.ligadoEmisionId !== emisionId;
                    return (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-2 whitespace-nowrap">{labelTipoDoc(row.tipoDoc)}</td>
                        <td className="px-3 py-2 tabular-nums whitespace-nowrap">{row.noFactu}</td>
                        <td className="px-3 py-2 tabular-nums text-slate-600 whitespace-nowrap" title={row.consecutivoFe ?? undefined}>
                          {shortFe(row.consecutivoFe)}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={row.cliente}>
                          {row.cliente}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          {formatCurrency(row.total)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {blocked ? (
                            <Badge variant="outline" className="text-xs font-normal">
                              Ligado
                            </Badge>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8"
                              disabled={linkMutation.isPending}
                              onClick={() =>
                                linkMutation.mutate({
                                  noCia: row.noCia,
                                  tipoDoc: row.tipoDoc,
                                  noFactu: row.noFactu,
                                })
                              }
                            >
                              {linkMutation.isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Seleccionar"
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
