"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { OrdenCompraNafRow } from "@/modules/presupuestos/services/list-ordenes-compra-naf";
import type { NafFacturaProveedorDetalle } from "@/modules/pagos/services/naf-oc-factura";
import { ExpenseOcDetallePanel } from "@/components/expenses/ExpenseOcPicker";

export type ProveedorDetalleTarget =
  | { kind: "oc"; noOrden: string; company?: string | null }
  | { kind: "factura"; noFisico: string; noOrden?: string | null; company?: string | null };

type OcPayload = OrdenCompraNafRow & { tipo?: string };
type FacturaPayload = NafFacturaProveedorDetalle & { tipo?: string };

export function PagosProveedorDetalleDialog({
  target,
  onClose,
  onOpenOc,
}: {
  target: ProveedorDetalleTarget | null;
  onClose: () => void;
  /** Desde factura, abrir detalle de una OC ligada. */
  onOpenOc?: (noOrden: string, company?: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oc, setOc] = useState<OcPayload | null>(null);
  const [factura, setFactura] = useState<FacturaPayload | null>(null);

  useEffect(() => {
    if (!target) {
      setOc(null);
      setFactura(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setOc(null);
    setFactura(null);

    const params = new URLSearchParams({ tipo: target.kind });
    if (target.company?.trim()) params.set("company", target.company.trim());
    if (target.kind === "oc") {
      params.set("noOrden", target.noOrden);
    } else {
      params.set("noFisico", target.noFisico);
      if (target.noOrden?.trim()) params.set("noOrden", target.noOrden.trim());
    }

    fetch(`/api/pagos/proveedores/detalle?${params}`, { signal: ac.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error?.message || json?.message || "No se pudo cargar el detalle");
        }
        const data = (json.data ?? json) as OcPayload | FacturaPayload;
        if (target.kind === "oc") setOc(data as OcPayload);
        else setFactura(data as FacturaPayload);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Error al cargar detalle");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [target]);

  const open = Boolean(target);
  const title =
    target?.kind === "oc"
      ? `Orden de compra ${target.noOrden}`
      : target?.kind === "factura"
        ? `Factura ${target.noFisico}`
        : "Detalle";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {loading && (
            <p className="text-sm text-muted-foreground animate-pulse py-6 text-center">
              Cargando detalle NAF…
            </p>
          )}
          {error && !loading && (
            <p className="text-sm text-destructive py-4 text-center">{error}</p>
          )}
          {!loading && !error && target?.kind === "oc" && (
            <ExpenseOcDetallePanel oc={oc} loading={false} />
          )}
          {!loading && !error && target?.kind === "factura" && factura && (
            <FacturaDetallePanel
              factura={factura}
              onOpenOc={(noOrden) =>
                onOpenOc?.(noOrden, factura.companyCode ?? target.company)
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FacturaDetallePanel({
  factura,
  onOpenOc,
}: {
  factura: NafFacturaProveedorDetalle;
  onOpenOc?: (noOrden: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border divide-y text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 sm:grid-cols-3">
          <Field label="N° factura" value={factura.noFisico} mono />
          <Field label="N° interno NAF" value={factura.numFac} mono />
          <Field label="Serie" value={factura.serieFisico ?? "—"} />
          <Field label="Proveedor" value={factura.proveedor ?? factura.proveedorCodigo ?? "—"} />
          <Field
            label="Fecha doc."
            value={factura.fechaDoc ? formatDate(factura.fechaDoc) : "—"}
          />
          <Field label="Cía" value={factura.companyCode ?? factura.noCia} />
          <Field label="Tipo" value={factura.tipoFac ?? "—"} />
          <Field label="Estado" value={factura.estado ?? "—"} />
          <Field
            label="Total"
            value={
              factura.total != null
                ? `${formatCurrency(factura.total)}${factura.moneda ? ` (${factura.moneda})` : ""}`
                : "—"
            }
          />
        </div>
        {factura.ordenes.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">OC ligadas:</span>
            {factura.ordenes.map((oc) => (
              <button
                key={oc}
                type="button"
                className="font-mono text-xs text-sky-700 hover:underline dark:text-sky-400"
                onClick={() => onOpenOc?.(oc)}
              >
                {oc}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Líneas ({factura.lineas.length})
        </div>
        {factura.lineas.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">Sin líneas en NAF.</p>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr className="border-b">
                  <th className="px-2 py-1 text-left font-medium">#</th>
                  <th className="px-2 py-1 text-left font-medium">Artículo</th>
                  <th className="px-2 py-1 text-left font-medium">OC</th>
                  <th className="px-2 py-1 text-right font-medium">Cant.</th>
                  <th className="px-2 py-1 text-right font-medium">P. unit.</th>
                  <th className="px-2 py-1 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {factura.lineas.map((l) => (
                  <tr key={`${l.noLinea}-${l.noArti}`} className="border-b last:border-0">
                    <td className="px-2 py-1 text-muted-foreground">{l.noLinea}</td>
                    <td className="px-2 py-1">
                      <div>{l.descripcion || l.noArti}</div>
                      {l.descripcion && (
                        <div className="font-mono text-[10px] text-muted-foreground">{l.noArti}</div>
                      )}
                    </td>
                    <td className="px-2 py-1 font-mono">
                      {l.noOrden ? (
                        <button
                          type="button"
                          className="text-sky-700 hover:underline dark:text-sky-400"
                          onClick={() => onOpenOc?.(l.noOrden!)}
                        >
                          {l.noOrden}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{l.cantidad}</td>
                    <td className="px-2 py-1 text-right font-mono">{formatCurrency(l.precio)}</td>
                    <td className="px-2 py-1 text-right font-mono">{formatCurrency(l.montoLinea)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
