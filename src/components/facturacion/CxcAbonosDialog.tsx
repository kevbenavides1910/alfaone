"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatCurrencyPrecise, calendarDateInputValue, formatDate } from "@/lib/utils/format";
import type { CuentaPorCobrarRow } from "@/app/(app)/facturacion/cuentas-por-cobrar/page";

type AbonoRow = NonNullable<CuentaPorCobrarRow["abonos"]>[number];

type Props = {
  row: CuentaPorCobrarRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
};

export function CxcAbonosDialog({ row, open, onOpenChange, canEdit }: Props) {
  const qc = useQueryClient();
  const [receiptNumber, setReceiptNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editReceiptNumber, setEditReceiptNumber] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");

  useEffect(() => {
    if (!open) {
      setReceiptNumber("");
      setAmount("");
      setPaidAt("");
      setEditingId(null);
    }
  }, [open, row.id]);

  const abonos = row.abonos ?? [];
  const neto = row.netAmountExpected ?? row.totalCalculated ?? 0;
  const totalRebajos = row.totalRebajos ?? 0;
  const netoDespuesRebajos = row.adjustedCollectible ?? neto;
  const totalAbonos = row.totalAbonos ?? 0;
  const saldo = row.remainingBalance ?? 0;

  const createMutation = useMutation({
    mutationFn: async (payload: { receiptNumber?: string | null; amount: number; paidAt?: string | null }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/abonos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar abono");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: (data) => {
      qc.setQueriesData<{ data: CuentaPorCobrarRow[] }>(
        { queryKey: ["cuentas-por-cobrar"] },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((row) => (row.id === data.id ? data : row)),
          };
        }
      );
      setReceiptNumber("");
      setAmount("");
      setPaidAt("");
      const cobrada = saldo <= 1;
      toast.success(
        cobrada
          ? "Abono registrado. La factura quedó cobrada y aparece en «Cobradas»."
          : "Abono registrado",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      abonoId,
      payload,
    }: {
      abonoId: string;
      payload: { receiptNumber?: string | null; amount?: number; paidAt?: string | null };
    }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/abonos/${abonoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al actualizar abono");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: (data) => {
      qc.setQueriesData<{ data: CuentaPorCobrarRow[] }>(
        { queryKey: ["cuentas-por-cobrar"] },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((row) => (row.id === data.id ? data : row)),
          };
        }
      );
      setEditingId(null);
      toast.success("Abono actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (abonoId: string) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/abonos/${abonoId}`, {
        method: "DELETE",
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al eliminar abono");
      return json.data as CuentaPorCobrarRow;
    },
    onSuccess: (data) => {
      qc.setQueriesData<{ data: CuentaPorCobrarRow[] }>(
        { queryKey: ["cuentas-por-cobrar"] },
        (old) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((row) => (row.id === data.id ? data : row)),
          };
        }
      );
      toast.success("Abono eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const maxNewAbono = useMemo(
    () => Math.max(0, netoDespuesRebajos - totalAbonos),
    [netoDespuesRebajos, totalAbonos]
  );

  function startEdit(abono: AbonoRow) {
    setEditingId(abono.id);
    setEditReceiptNumber(abono.receiptNumber ?? "");
    setEditAmount(String(abono.amount));
    setEditPaidAt(calendarDateInputValue(abono.paidAt ?? ""));
  }

  function handleCreate() {
    const parsed = Number.parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Monto inválido");
      return;
    }
    createMutation.mutate({
      receiptNumber: receiptNumber.trim() || null,
      amount: parsed,
      paidAt: paidAt || null,
    });
  }

  function handleSaveEdit(abonoId: string) {
    const parsed = Number.parseFloat(editAmount);
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Monto inválido");
      return;
    }
    updateMutation.mutate({
      abonoId,
      payload: {
        receiptNumber: editReceiptNumber.trim() || null,
        amount: parsed,
        paidAt: editPaidAt || null,
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abonos recibidos</DialogTitle>
          <DialogDescription>
            Registre uno o varios abonos parciales. El saldo pendiente se calcula sobre el neto a
            cobrar menos rebajos y abonos.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Neto a cobrar</span>
            <span className="font-medium tabular-nums">{formatCurrency(neto)}</span>
          </div>
          {totalRebajos > 0 && (
            <div className="flex justify-between gap-4 text-red-800">
              <span>Total rebajos</span>
              <span className="font-medium tabular-nums">− {formatCurrency(totalRebajos)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="font-medium text-slate-800">Neto después de rebajos</span>
            <span className="font-semibold tabular-nums">{formatCurrency(netoDespuesRebajos)}</span>
          </div>
          {totalAbonos > 0 && (
            <div className="flex justify-between gap-4 text-green-800">
              <span>Total abonos</span>
              <span className="font-medium tabular-nums">− {formatCurrency(totalAbonos)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="font-semibold text-amber-900">Saldo pendiente</span>
            <span className="font-bold tabular-nums text-amber-900">{formatCurrencyPrecise(saldo)}</span>
          </div>
        </div>

        {abonos.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Abonos registrados</h4>
            <ul className="space-y-2">
              {abonos.map((abono) => (
                <li
                  key={abono.id}
                  className="rounded-md border border-slate-200 p-3 bg-white space-y-2"
                >
                  {editingId === abono.id && canEdit ? (
                    <div className="space-y-2">
                      <Input
                        value={editReceiptNumber}
                        onChange={(e) => setEditReceiptNumber(e.target.value)}
                        placeholder="Nº recibo provisional"
                        maxLength={100}
                        disabled={busy}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        disabled={busy}
                      />
                      <CalendarDateInput
                        value={editPaidAt}
                        onChange={setEditPaidAt}
                        disabled={busy}
                        showPicker
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(abono.id)}
                          disabled={busy}
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          disabled={busy}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {abono.receiptNumber?.trim() ? (
                          <p className="text-sm text-slate-800">Recibo: {abono.receiptNumber}</p>
                        ) : (
                          <p className="text-sm text-slate-500 italic">Sin número de recibo</p>
                        )}
                        <p className="text-sm font-semibold text-green-800 tabular-nums mt-1">
                          − {formatCurrency(abono.amount)}
                        </p>
                        {abono.paidAt && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Fecha: {formatDate(abono.paidAt)}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => startEdit(abono)}
                            disabled={busy}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-red-700 hover:text-red-800 hover:bg-red-50"
                            onClick={() => deleteMutation.mutate(abono.id)}
                            disabled={busy}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No hay abonos registrados.</p>
        )}

        {canEdit && (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Banknote className="h-4 w-4 text-green-700" />
              Agregar abono
            </h4>
            <div className="space-y-2">
              <Label htmlFor={`abono-recibo-${row.id}`}>Nº recibo provisional</Label>
              <Input
                id={`abono-recibo-${row.id}`}
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="Opcional"
                maxLength={100}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`abono-amt-${row.id}`}>Monto</Label>
              <Input
                id={`abono-amt-${row.id}`}
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  maxNewAbono > 0 ? `Máx. ${maxNewAbono.toFixed(2)}` : "Sin margen disponible"
                }
                disabled={busy || maxNewAbono <= 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`abono-fecha-${row.id}`}>Fecha del abono</Label>
              <CalendarDateInput
                id={`abono-fecha-${row.id}`}
                value={paidAt}
                onChange={setPaidAt}
                disabled={busy || maxNewAbono <= 0}
                showPicker
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleCreate}
              disabled={busy || maxNewAbono <= 0}
            >
              <Plus className="h-4 w-4" />
              Agregar abono
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
