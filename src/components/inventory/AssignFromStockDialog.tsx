"use client";

import { useState, useEffect } from "react";
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

interface PositionSearchShift { id: string; label: string | null; hours: number }
interface PositionSearchResult {
  id: string;
  name: string;
  description?: string | null;
  phoneLine?: string | null;
  shifts: PositionSearchShift[];
  location: {
    id: string;
    name: string;
    contract: { id: string; licitacionNo: string; client: string; status: string };
  };
}

export function AssignFromStockDialog({
  asset, onOpenChange, onSuccess,
}: {
  asset: AssetRow | null;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PositionSearchResult | null>(null);
  const [showList, setShowList] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!asset) {
      setQuery("");
      setSelected(null);
      setNotes("");
      setShowList(false);
    }
  }, [asset]);

  const { data: resultsRes, isLoading } = useQuery<{ data: PositionSearchResult[] }>({
    queryKey: ["positions-search", query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "25");
      return fetch(`/api/positions/search?${params}`).then((r) => r.json());
    },
    enabled: !!asset && showList,
  });
  const results = resultsRes?.data ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!asset || !selected) return;
      const r = await fetch(`/api/assets/${asset.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ASSIGN", toPositionId: selected.id, notes: notes.trim() || null }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error");
      return json;
    },
    onSuccess: (json: { data?: { displaced?: number } } | undefined) => {
      const displaced = json?.data?.displaced ?? 0;
      if (displaced > 0) {
        toast.success(
          `Activo asignado. ${displaced} activo(s) del mismo tipo en el puesto pasaron a "Pendientes de devolución".`
        );
      } else {
        toast.success("Activo asignado al puesto");
      }
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!asset} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar activo a un puesto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {asset && (
            <p className="text-sm text-slate-600">
              {asset.type.name} · <code className="text-xs bg-slate-100 px-1 rounded">{asset.code}</code>
              {(asset.brand || asset.model) && (
                <span className="text-slate-500"> — {[asset.brand, asset.model].filter(Boolean).join(" / ")}</span>
              )}
            </p>
          )}

          <div>
            <label className="text-sm font-medium text-slate-700">
              Buscar puesto por número o nombre *
            </label>
            <p className="text-xs text-slate-500 mb-1">
              Escriba el número del puesto, el nombre de la ubicación o la licitación del contrato.
            </p>
            {selected ? (
              <div className="flex items-start gap-2 p-3 rounded border bg-slate-50">
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-medium text-slate-800">{selected.name}</div>
                  {selected.description && (
                    <div className="text-xs text-slate-500">{selected.description}</div>
                  )}
                  <div className="text-xs text-slate-600 mt-1">
                    <span className="font-medium">Ubicación:</span> {selected.location.name}
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-medium">Contrato:</span> {selected.location.contract.licitacionNo} — {selected.location.contract.client}
                  </div>
                  {selected.shifts.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selected.shifts.map((s) => (
                        <span
                          key={s.id}
                          className="text-xs bg-card text-slate-700 px-1.5 py-0.5 rounded border"
                        >
                          {s.label ? `${s.label} · ` : ""}
                          {s.hours}h
                        </span>
                      ))}
                    </div>
                  )}
                  {selected.phoneLine && (
                    <div className="text-xs text-slate-500 mt-1">Línea: {selected.phoneLine}</div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelected(null);
                    setQuery("");
                    setShowList(true);
                  }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setShowList(true);
                    }}
                    onFocus={() => setShowList(true)}
                    placeholder="Ej: 101, Portón Principal, LP-2024-015…"
                    className="pl-8"
                  />
                </div>
                {showList && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-64 overflow-y-auto z-10">
                    {isLoading ? (
                      <div className="p-3 text-center text-xs text-slate-400">Buscando…</div>
                    ) : results.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        {query.trim()
                          ? "No se encontraron puestos."
                          : "Escriba el número del puesto o parte del nombre."}
                      </div>
                    ) : (
                      results.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-0"
                          onClick={() => {
                            setSelected(p);
                            setShowList(false);
                          }}
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-slate-800 text-sm">{p.name}</span>
                            <span className="text-xs text-slate-400">
                              {p.location.contract.licitacionNo}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {p.location.contract.client} · {p.location.name}
                          </div>
                          {p.shifts.length > 0 && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {p.shifts.map((s) => `${s.label ? s.label + " " : ""}${s.hours}h`).join(" · ")}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones (opcional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!selected || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Asignando…" : "Asignar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
