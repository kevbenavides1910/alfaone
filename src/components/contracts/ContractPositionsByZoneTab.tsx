"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

type PositionRow = {
  id: string;
  name: string;
  nafUbicacionCode: string | null;
  locationId: string | null;
  location: { id: string; name: string } | null;
};

type ZoneGroup = {
  zoneId: string | null;
  zoneName: string;
  positions: PositionRow[];
};

type LocationOption = { id: string; name: string; positionsCount: number };

export function ContractPositionsByZoneTab({
  contractId,
  readOnly,
}: {
  contractId: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetLocationId, setTargetLocationId] = useState<string>("");

  const { data, isLoading } = useQuery<{
    data: { groups: ZoneGroup[]; locations: LocationOption[] };
  }>({
    queryKey: ["contract-positions-by-zone", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/positions-by-zone`).then((r) => r.json()),
  });

  const groups = data?.data?.groups ?? [];
  const locations = data?.data?.locations ?? [];
  const total = useMemo(() => groups.reduce((n, g) => n + g.positions.length, 0), [groups]);
  const unassigned = useMemo(
    () => groups.reduce((n, g) => n + g.positions.filter((p) => !p.locationId).length, 0),
    [groups],
  );

  const assignMutation = useMutation({
    mutationFn: (body: { positionIds: string[]; locationId: string | null }) =>
      fetch(`/api/contracts/${contractId}/positions/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok || json.error) throw new Error(json.error?.message ?? "Error al asignar");
        return json.data;
      }),
    onSuccess: (res: { updated: number }) => {
      toast.success(`${res.updated} puesto(s) asignado(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["contract-positions-by-zone", contractId] });
      qc.invalidateQueries({ queryKey: ["contract-locations", contractId] });
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
      qc.invalidateQueries({ queryKey: ["admin-positions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const assignSelected = (locationId: string | null) => {
    if (selected.size === 0) return;
    assignMutation.mutate({ positionIds: [...selected], locationId });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800">Puestos por zona operativa</h3>
          <p className="text-sm text-slate-500">
            {total} puesto{total !== 1 ? "s" : ""} · {unassigned} sin ubicación asignada
          </p>
        </div>
        {!readOnly && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600">{selected.size} seleccionado(s)</span>
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={targetLocationId}
              onChange={(e) => setTargetLocationId(e.target.value)}
            >
              <option value="">Asignar a ubicación…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.positionsCount})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!targetLocationId || assignMutation.isPending}
              onClick={() => assignSelected(targetLocationId)}
            >
              Asignar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={assignMutation.isPending}
              onClick={() => assignSelected(null)}
            >
              Quitar de ubicación
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Cargando puestos…</div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-400">
            <MapPin className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>No hay puestos sincronizados desde Operaciones.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const key = group.zoneId ?? "__sin__";
            const open = expanded === key;
            return (
              <Card key={key} className="overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                  onClick={() => setExpanded(open ? null : key)}
                >
                  {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <span className="font-medium text-slate-800">{group.zoneName}</span>
                  <Badge variant="secondary">{group.positions.length}</Badge>
                </button>
                {open && (
                  <div className="border-t divide-y">
                    {group.positions.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        {!readOnly && (
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="rounded border-slate-300"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">{p.name}</p>
                          {p.location && (
                            <p className="truncate text-xs text-slate-500">Ubicación: {p.location.name}</p>
                          )}
                        </div>
                        {!p.locationId && (
                          <Badge variant="outline" className="shrink-0 text-amber-700 border-amber-200">
                            Sin ubicación
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!readOnly && locations.length === 0 && total > 0 && (
        <p className="text-sm text-amber-700">
          Cree ubicaciones en la pestaña «Ubicaciones» para agrupar puestos manualmente.
        </p>
      )}
    </div>
  );
}
