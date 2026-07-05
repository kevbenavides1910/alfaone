"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatMonthYear } from "@/lib/utils/format";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type DemandSlot = {
  periodYear: number;
  periodMonth: number;
  monthlyBilling: number | null;
  notes: string | null;
  id: string | null;
};

interface Props {
  contractId: string;
  readOnly?: boolean;
}

function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

export function OnDemandBillingTab({ contractId, readOnly }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{
    data: { slots: DemandSlot[]; startDate: string; endDate: string };
  }>({
    queryKey: ["demand-billing", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/demand-billing`).then((r) => r.json()),
  });

  const slots = data?.data?.slots ?? [];

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      periodYear: number;
      periodMonth: number;
      monthlyBilling: number;
      notes?: string;
    }) => {
      const r = await fetch(`/api/contracts/${contractId}/demand-billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["demand-billing", contractId] });
      qc.invalidateQueries({ queryKey: ["facturacion"] });
      const key = `${vars.periodYear}-${vars.periodMonth}`;
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      toast.success(`Monto de ${monthLabel(vars.periodYear, vars.periodMonth)} guardado`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingCount = useMemo(
    () => slots.filter((s) => s.monthlyBilling === null).length,
    [slots]
  );

  function draftKey(slot: DemandSlot) {
    return `${slot.periodYear}-${slot.periodMonth}`;
  }

  function draftValue(slot: DemandSlot) {
    const key = draftKey(slot);
    if (drafts[key] !== undefined) return drafts[key];
    return slot.monthlyBilling !== null ? String(slot.monthlyBilling) : "";
  }

  function saveSlot(slot: DemandSlot) {
    const raw = draftValue(slot).trim();
    const amount = parseFloat(raw);
    if (!raw || Number.isNaN(amount) || amount <= 0) {
      toast.error("Ingrese un monto mayor a 0");
      return;
    }
    saveMutation.mutate({
      periodYear: slot.periodYear,
      periodMonth: slot.periodMonth,
      monthlyBilling: amount,
    });
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Cargando meses del contrato...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-800">Facturación por demanda</h3>
        <p className="text-sm text-slate-500 mt-1">
          Indique el monto a facturar en cada mes de vigencia del contrato. Hasta definirlo, en
          Facturación aparecerá como <Badge variant="outline" className="mx-1">Pendiente de definir</Badge>.
          {pendingCount > 0 && (
            <span className="block mt-1 text-amber-700">
              {pendingCount} mes{pendingCount !== 1 ? "es" : ""} sin monto definido.
            </span>
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Montos mensuales</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {slots.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Sin meses en la vigencia del contrato.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Mes</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Monto a facturar (₡)</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Estado</th>
                  {!readOnly && <th className="px-4 py-3 w-28" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {slots.map((slot) => {
                  const defined = slot.monthlyBilling !== null;
                  const key = draftKey(slot);
                  const saving =
                    saveMutation.isPending &&
                    saveMutation.variables?.periodYear === slot.periodYear &&
                    saveMutation.variables?.periodMonth === slot.periodMonth;

                  return (
                    <tr key={key} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {formatMonthYear(new Date(slot.periodYear, slot.periodMonth - 1, 1).toISOString())}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {readOnly ? (
                          defined ? formatCurrency(slot.monthlyBilling!) : "—"
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="max-w-[180px] ml-auto text-right"
                            placeholder="0.00"
                            value={draftValue(slot)}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [key]: e.target.value }))
                            }
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {defined ? (
                          <Badge variant="secondary">Definido</Badge>
                        ) : (
                          <Badge variant="outline">Pendiente de definir</Badge>
                        )}
                      </td>
                      {!readOnly && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={saving}
                            onClick={() => saveSlot(slot)}
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Guardar
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Ver también el módulo{" "}
        <Link href="/facturacion" className="text-red-600 hover:underline">
          Facturación
        </Link>{" "}
        para el seguimiento de requisitos y cierre de cada mes.
      </p>
    </div>
  );
}
