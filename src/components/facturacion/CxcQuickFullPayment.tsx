"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { formatCurrency } from "@/lib/utils/format";
import type { CuentaPorCobrarRow } from "@/app/(app)/facturacion/cuentas-por-cobrar/page";

type Props = {
  row: CuentaPorCobrarRow;
  disabled?: boolean;
};

export function CxcQuickFullPayment({ row, disabled }: Props) {
  const qc = useQueryClient();
  const [receiptNumber, setReceiptNumber] = useState("");

  const amountToCollect = row.adjustedCollectible ?? row.netAmountExpected ?? row.totalCalculated ?? 0;

  const collectMutation = useMutation({
    mutationFn: async (receipt: string) => {
      const r = await fetch(`/api/cuentas-por-cobrar/${row.id}/pago`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptNumber: receipt.trim() }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al registrar cobro");
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
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      setReceiptNumber("");
      toast.success("Pago total registrado. La factura aparece en «Cobradas».");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = collectMutation.isPending || disabled;
  const canSubmit = receiptNumber.trim().length > 0 && amountToCollect > 0;

  return (
    <div className="space-y-1.5 min-w-[160px]">
      <Input
        type="text"
        className="h-8 text-sm"
        placeholder="Nº recibo provisional"
        value={receiptNumber}
        onChange={(e) => setReceiptNumber(e.target.value)}
        disabled={busy}
        maxLength={100}
        onKeyDown={(e) => {
          if (e.key === "Enter" && canSubmit && !busy) {
            e.preventDefault();
            collectMutation.mutate(receiptNumber);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        className="w-full gap-1 justify-start h-8"
        disabled={busy || !canSubmit}
        onClick={() => collectMutation.mutate(receiptNumber)}
      >
        {collectMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        Cobrar total
      </Button>
      {amountToCollect > 0 && (
        <p className="text-[11px] text-slate-500 tabular-nums">
          Monto: {formatCurrency(amountToCollect)}
        </p>
      )}
    </div>
  );
}
