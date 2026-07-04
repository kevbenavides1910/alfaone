"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MinusCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils/format";
import type { CuentaPorCobrarRow } from "@/app/(app)/facturacion/cuentas-por-cobrar/page";

type RebajoRow = NonNullable<CuentaPorCobrarRow["rebajos"]>[number];

type Props = {
  row: CuentaPorCobrarRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
};

export function CxcRebajosDialog({ row, open, onOpenChange, canEdit }: Props) {
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");

  useEffect(() => {
    if (!open) {
      setDescription("");
      setAmount("");
      setEditingId(null);
    }
  }, [open, row.id]);

  const rebajos = row.rebajos ?? [];
  const neto = row.netAmountExpected ?? row.totalCalculated ?? 0;
  const totalRebajos = row.totalRebajos ?? 0;
  const netoDespuesRebajos = row.adjustedCollectible ?? neto;
  const abono = row.totalAbonos ?? row.provisionalPaymentAmount ?? 0;
  const saldo = row.remainingBalance ?? 0;

  const createMutation = useMutation({
    mutationFn: async (payload: { description: string; amount: number }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/rebajos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar rebajo");
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
      setDescription("");
      setAmount("");
      toast.success("Rebajo registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      rebajoId,
      payload,
    }: {
      rebajoId: string;
      payload: { description?: string; amount?: number };
    }) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/rebajos/${rebajoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al actualizar rebajo");
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
      toast.success("Rebajo actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (rebajoId: string) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/rebajos/${rebajoId}`, {
        method: "DELETE",
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al eliminar rebajo");
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
      toast.success("Rebajo eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const maxNewRebajo = useMemo(
    () => Math.max(0, neto - totalRebajos),
    [neto, totalRebajos]
  );

  function startEdit(rebajo: RebajoRow) {
    setEditingId(rebajo.id);
    setEditDescription(rebajo.description);
    setEditAmount(String(rebajo.amount));
  }

  function handleCreate() {
    const parsed = Number.parseFloat(amount);
    if (!description.trim()) {
      toast.error("Indique el detalle del rebajo");
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Monto inválido");
      return;
    }
    createMutation.mutate({ description: description.trim(), amount: parsed });
  }

  function handleSaveEdit(rebajoId: string) {
    const parsed = Number.parseFloat(editAmount);
    if (!editDescription.trim()) {
      toast.error("Indique el detalle del rebajo");
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Monto inválido");
      return;
    }
    updateMutation.mutate({
      rebajoId,
      payload: { description: editDescription.trim(), amount: parsed },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Justificación de diferencia</DialogTitle>
          <DialogDescription>
            Registre multas, deducciones u otros rebajos del cliente. El saldo se calcula sobre el
            neto a cobrar menos rebajos y abonos.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Neto a cobrar</span>
            <span className="font-medium tabular-nums">{formatCurrency(neto)}</span>
          </div>
          <div className="flex justify-between gap-4 text-red-800">
            <span>Total rebajos</span>
            <span className="font-medium tabular-nums">− {formatCurrency(totalRebajos)}</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="font-medium text-slate-800">Neto después de rebajos</span>
            <span className="font-semibold tabular-nums">{formatCurrency(netoDespuesRebajos)}</span>
          </div>
          {abono > 0 && (
            <div className="flex justify-between gap-4 text-green-800">
              <span>Abono recibido</span>
              <span className="font-medium tabular-nums">− {formatCurrency(abono)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-slate-200 pt-2">
            <span className="font-semibold text-amber-900">Saldo pendiente</span>
            <span className="font-bold tabular-nums text-amber-900">{formatCurrency(saldo)}</span>
          </div>
        </div>

        {rebajos.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">Rebajos registrados</h4>
            <ul className="space-y-2">
              {rebajos.map((rebajo) => (
                <li
                  key={rebajo.id}
                  className="rounded-md border border-slate-200 p-3 bg-white space-y-2"
                >
                  {editingId === rebajo.id && canEdit ? (
                    <div className="space-y-2">
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Detalle del rebajo"
                        maxLength={500}
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
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSaveEdit(rebajo.id)}
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
                        <p className="text-sm text-slate-800 break-words">{rebajo.description}</p>
                        <p className="text-sm font-semibold text-red-800 tabular-nums mt-1">
                          − {formatCurrency(rebajo.amount)}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => startEdit(rebajo)}
                            disabled={busy}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-red-700 hover:text-red-800 hover:bg-red-50"
                            onClick={() => deleteMutation.mutate(rebajo.id)}
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
          <p className="text-sm text-slate-500 italic">No hay rebajos registrados.</p>
        )}

        {canEdit && (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <MinusCircle className="h-4 w-4 text-red-600" />
              Agregar rebajo
            </h4>
            <div className="space-y-2">
              <Label htmlFor={`rebajo-desc-${row.id}`}>Detalle</Label>
              <Input
                id={`rebajo-desc-${row.id}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Multa por incumplimiento, rebajo administrativo…"
                maxLength={500}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`rebajo-amt-${row.id}`}>Monto</Label>
              <Input
                id={`rebajo-amt-${row.id}`}
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  maxNewRebajo > 0 ? `Máx. ${maxNewRebajo.toFixed(2)}` : "Sin margen disponible"
                }
                disabled={busy || maxNewRebajo <= 0}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleCreate}
              disabled={busy || maxNewRebajo <= 0}
            >
              <Plus className="h-4 w-4" />
              Agregar rebajo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
