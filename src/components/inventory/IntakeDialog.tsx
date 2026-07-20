"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Pencil, Undo2, AlertTriangle, Package, MapPin, Search, ArrowRightCircle, X, FileSpreadsheet,
} from "lucide-react";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils/format";
import {
  type FieldType, type ExtraField, type AssetType, type AssetPosition, type AssetRow, type MovementRow,
  STATUS_LABEL, STATUS_VARIANT, MOVEMENT_LABEL, MOVEMENT_BADGE, INTAKE_REASON, ISSUE_REASON,
  describePosition, zoneName, matchesFilter, ColumnFilterInput, ensureAttrs, renderAttributes,
} from "@/app/(app)/inventory/inventory-types";

type IntakeItem = { code: string; name: string; brand: string; model: string; attributes: Record<string, unknown> };

export function IntakeDialog({
  open, onOpenChange, types, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  types: AssetType[];
  onSuccess: () => void;
}) {
  const [typeId, setTypeId] = useState("");
  const [intakeReason, setIntakeReason] = useState<"PURCHASE" | "RETURN" | "INITIAL" | "OTHER">("PURCHASE");
  const [expenseRef, setExpenseRef] = useState("");
  const [expenseId, setExpenseId] = useState<string | null>(null);
  const [acquisitionDate, setAcquisitionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<IntakeItem[]>([{ code: "", name: "", brand: "", model: "", attributes: {} }]);

  const type = useMemo(() => types.find((t) => t.id === typeId), [types, typeId]);
  const fields = useMemo(
    () => (Array.isArray(type?.fields) ? (type!.fields as ExtraField[]) : []),
    [type]
  );

  const { data: expenseSearch } = useQuery<{ data: Array<{ id: string; description: string; referenceNumber: string | null; amount: number; periodMonth: string }> }>({
    queryKey: ["expense-search", expenseRef],
    queryFn: () => {
      if (!expenseRef.trim()) return Promise.resolve({ data: [] });
      return fetch(`/api/expenses?q=${encodeURIComponent(expenseRef)}&limit=10`).then((r) => r.json());
    },
    enabled: expenseRef.length >= 2 && !expenseId,
  });

  function reset() {
    setTypeId("");
    setIntakeReason("PURCHASE");
    setExpenseRef("");
    setExpenseId(null);
    setAcquisitionDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setItems([{ code: "", name: "", brand: "", model: "", attributes: {} }]);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeId,
          intakeReason,
          expenseId: expenseId || null,
          acquisitionDate,
          notes: notes.trim() || null,
          items: items.map((it) => ({
            code: it.code.trim(),
            name: it.name.trim() || null,
            brand: it.brand.trim() || null,
            model: it.model.trim() || null,
            attributes: it.attributes,
          })),
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error");
      return json;
    },
    onSuccess: (res) => {
      toast.success(`${res.data?.count ?? items.length} activo(s) ingresado(s) al stock`);
      reset();
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); } onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ingreso a stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Tipo de activo *</label>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="w-full h-9 text-sm border rounded-md px-2 bg-card"
              >
                <option value="">Seleccione…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Motivo</label>
              <select
                value={intakeReason}
                onChange={(e) => setIntakeReason(e.target.value as typeof intakeReason)}
                className="w-full h-9 text-sm border rounded-md px-2 bg-card"
              >
                <option value="PURCHASE">Compra</option>
                <option value="RETURN">Devolución</option>
                <option value="INITIAL">Inicial</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Fecha</label>
              <Input type="date" value={acquisitionDate} onChange={(e) => setAcquisitionDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Gasto / OC asociado {intakeReason === "PURCHASE" ? "*" : "(opcional)"}
            </label>
            {expenseId ? (
              <div className="flex items-center gap-2 p-2 rounded border bg-muted/50 text-sm">
                <span className="flex-1">{expenseRef}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setExpenseId(null); setExpenseRef(""); }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Busque por descripción o número de referencia"
                  value={expenseRef}
                  onChange={(e) => setExpenseRef(e.target.value)}
                />
                {expenseSearch?.data && expenseSearch.data.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                    {expenseSearch.data.map((exp) => (
                      <button
                        key={exp.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm border-b last:border-0"
                        onClick={() => {
                          setExpenseId(exp.id);
                          setExpenseRef(`${exp.referenceNumber ?? ""} ${exp.description}`.trim());
                        }}
                      >
                        <div className="font-medium text-slate-800">
                          {exp.referenceNumber ?? "(sin ref.)"} — {exp.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del ingreso" />
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Activos a ingresar</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setItems((p) => [...p, { code: "", name: "", brand: "", model: "", attributes: {} }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="border rounded p-3 space-y-2 bg-muted/50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Activo {i + 1}</span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-red-500"
                        onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs text-slate-500">Código / serial *</label>
                      <Input
                        value={it.code}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItems((p) => p.map((x, j) => (j === i ? { ...x, code: v } : x)));
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Nombre</label>
                      <Input
                        value={it.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItems((p) => p.map((x, j) => (j === i ? { ...x, name: v } : x)));
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Marca</label>
                      <Input
                        value={it.brand}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItems((p) => p.map((x, j) => (j === i ? { ...x, brand: v } : x)));
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500">Modelo</label>
                      <Input
                        value={it.model}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItems((p) => p.map((x, j) => (j === i ? { ...x, model: v } : x)));
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  {fields.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1 border-t">
                      {fields.map((f) => (
                        <div key={f.key}>
                          <label className="text-xs text-slate-500">
                            {f.label}
                            {f.required && " *"}
                          </label>
                          {f.type === "boolean" ? (
                            <input
                              type="checkbox"
                              checked={Boolean(it.attributes[f.key])}
                              onChange={(e) => {
                                const v = e.target.checked;
                                setItems((p) =>
                                  p.map((x, j) =>
                                    j === i ? { ...x, attributes: { ...x.attributes, [f.key]: v } } : x
                                  )
                                );
                              }}
                              className="w-4 h-4 rounded mt-2"
                            />
                          ) : (
                            <Input
                              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                              value={(it.attributes[f.key] as string | number | undefined) ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const v = f.type === "number" && raw !== "" ? parseFloat(raw) : raw;
                                setItems((p) =>
                                  p.map((x, j) =>
                                    j === i ? { ...x, attributes: { ...x.attributes, [f.key]: v } } : x
                                  )
                                );
                              }}
                              className="h-8 text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              if (!typeId) return toast.error("Seleccione un tipo");
              if (intakeReason === "PURCHASE" && !expenseId) {
                return toast.error("Seleccione el gasto / OC asociado a la compra");
              }
              if (items.some((it) => !it.code.trim())) {
                return toast.error("Todos los activos deben tener código / serial");
              }
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Guardando…" : "Ingresar al stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Issue / Return / Edit dialogs

