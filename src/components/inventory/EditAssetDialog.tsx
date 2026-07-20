"use client";

import { useState, useEffect, useMemo } from "react";
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

export function EditAssetDialog({
  asset, onOpenChange, onSuccess,
}: {
  asset: AssetRow | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<{ code: string; name: string; brand: string; model: string; attributes: Record<string, unknown>; notes: string }>({
    code: "", name: "", brand: "", model: "", attributes: {}, notes: "",
  });

  useEffect(() => {
    if (asset) {
      setForm({
        code: asset.code,
        name: asset.name ?? "",
        brand: asset.brand ?? "",
        model: asset.model ?? "",
        attributes: ensureAttrs(asset.attributes),
        notes: asset.notes ?? "",
      });
    }
  }, [asset]);

  const fields = useMemo(
    () => (asset && Array.isArray(asset.type.fields) ? (asset.type.fields as ExtraField[]) : []),
    [asset]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const r = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim() || null,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
          attributes: form.attributes,
          notes: form.notes.trim() || null,
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error");
      return json;
    },
    onSuccess: () => {
      toast.success("Activo actualizado");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar activo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {asset && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              {asset.type.name}
              <Badge variant={STATUS_VARIANT[asset.status]}>{STATUS_LABEL[asset.status]}</Badge>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Código / serial *</label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Nombre</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Marca</label>
              <Input
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Modelo</label>
              <Input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          {fields.length > 0 && (
            <div className="grid grid-cols-2 gap-2 border-t pt-2">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-slate-500">
                    {f.label}
                    {f.required && " *"}
                  </label>
                  {f.type === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(form.attributes[f.key])}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, attributes: { ...s.attributes, [f.key]: e.target.checked } }))
                      }
                      className="w-4 h-4 rounded mt-2"
                    />
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={(form.attributes[f.key] as string | number | undefined) ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v = f.type === "number" && raw !== "" ? parseFloat(raw) : raw;
                        setForm((s) => ({ ...s, attributes: { ...s.attributes, [f.key]: v } }));
                      }}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500">Notas</label>
            <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Assign from stock to a contract position (autocompletar por número/nombre)

