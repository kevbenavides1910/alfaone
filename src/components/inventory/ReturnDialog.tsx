"use client";

import { useState } from "react";
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

export function ReturnDialog({
  asset, onOpenChange, onSuccess,
}: {
  asset: AssetRow | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset) return;
      const r = await fetch(`/api/assets/${asset.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETURN", notes: notes.trim() || null }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error");
      return json;
    },
    onSuccess: () => {
      toast.success("Activo devuelto al stock");
      onSuccess();
      onOpenChange(false);
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Devolver al stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {asset && (
            <>
              <p className="text-sm text-slate-600">
                {asset.type.name} · <code className="text-xs bg-slate-100 px-1 rounded">{asset.code}</code>
              </p>
              <p className="text-xs text-slate-500">
                Desde: {describePosition(asset.currentPosition)}
              </p>
            </>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Guardando…" : "Devolver"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

