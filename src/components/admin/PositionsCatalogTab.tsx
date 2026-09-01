"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { useCompanies } from "@/lib/hooks/use-companies";
import { companyDisplayName } from "@/lib/utils/constants";

interface PositionRow {
  id: string;
  name: string;
  nafUbicacionCode: string | null;
  zoneId: string | null;
  locationId: string | null;
  contract: { id: string; licitacionNo: string; client: string; company: string };
  zone: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

interface LocationRow {
  id: string;
  name: string;
  contract: { id: string; licitacionNo: string; client: string };
}

export function PositionsCatalogTab({ readOnly }: { readOnly?: boolean }) {
  const qc = useQueryClient();
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const { data: zonesRes } = useQuery<{ data: Array<{ id: string; name: string; isActive: boolean }> }>({
    queryKey: ["admin-zones"],
    queryFn: () => fetch("/api/admin/catalogs/zones").then((r) => r.json()),
  });
  const zones = zonesRes?.data?.filter((z) => z.isActive) ?? [];

  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignContractId, setAssignContractId] = useState("");
  const [assignLocationId, setAssignLocationId] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (zoneFilter === "NONE") p.set("zoneId", "NONE");
    else if (zoneFilter !== "ALL") p.set("zoneId", zoneFilter);
    if (onlyUnassigned) p.set("unassigned", "1");
    if (query.trim()) p.set("q", query.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [zoneFilter, onlyUnassigned, query]);

  const { data, isLoading, refetch } = useQuery<{ data: PositionRow[] }>({
    queryKey: ["admin-positions", qs],
    queryFn: () => fetch(`/api/admin/catalogs/positions${qs}`).then((r) => r.json()),
  });

  const rows = data?.data ?? [];

  const { data: locsRes } = useQuery<{ data: LocationRow[] }>({
    queryKey: ["admin-locations", assignContractId],
    queryFn: () =>
      fetch(`/api/admin/catalogs/locations?contractId=${assignContractId}`).then((r) => r.json()),
    enabled: !!assignContractId,
  });
  const contractLocations = locsRes?.data ?? [];

  const syncNafMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const suffix = dryRun ? "?dryRun=1" : "";
      const r = await fetch(`/api/admin/catalogs/locations/sync-naf${suffix}`, { method: "POST" });
      const json = await r.json();
      if (!r.ok || json.error) throw new Error(json.error?.message ?? `Error ${r.status}`);
      return json.data as { positionsCreated: number; positionsUpdated: number; dryRun: boolean };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-positions"] });
      toast.success(
        `${data.dryRun ? "Simulación" : "Sync"}: ${data.positionsCreated} puestos nuevos, ${data.positionsUpdated} actualizados`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: (body: { contractId: string; positionIds: string[]; locationId: string | null }) =>
      fetch("/api/admin/catalogs/positions/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok || json.error) throw new Error(json.error?.message ?? "Error");
        return json.data;
      }),
    onSuccess: (res: { updated: number }) => {
      toast.success(`${res.updated} puesto(s) asignado(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin-positions"] });
      qc.invalidateQueries({ queryKey: ["admin-locations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedContractId = selectedRows[0]?.contract.id;
  const sameContract = selectedRows.every((r) => r.contract.id === selectedContractId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Puestos desde Operaciones (.6). La <strong>zona</strong> es un atributo del puesto; la{" "}
        <strong>ubicación</strong> se crea manualmente y agrupa varios puestos.
      </p>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar puesto, contrato, cliente…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="h-10 rounded-md border px-2 text-sm" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
          <option value="ALL">Todas las zonas</option>
          <option value="NONE">Sin zona</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
          Solo sin ubicación
        </label>
        <Button type="button" variant="outline" size="sm" disabled={syncNafMutation.isPending} onClick={() => syncNafMutation.mutate(true)}>
          <RefreshCw className={`h-4 w-4 ${syncNafMutation.isPending ? "animate-spin" : ""}`} />
          Simular sync
        </Button>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            disabled={syncNafMutation.isPending}
            onClick={() => {
              if (!window.confirm("¿Importar puestos desde Operaciones (.6)?")) return;
              syncNafMutation.mutate(false);
            }}
          >
            Traer de Operaciones (.6)
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {!readOnly && selected.size > 0 && sameContract && selectedContractId && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-3">
          <span className="text-sm">{selected.size} puesto(s) · {selectedRows[0]?.contract.client}</span>
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={assignContractId || selectedContractId}
            onChange={(e) => { setAssignContractId(e.target.value); setAssignLocationId(""); }}
          >
            <option value={selectedContractId}>Contrato seleccionado</option>
          </select>
          <select
            className="h-9 min-w-[180px] rounded-md border px-2 text-sm"
            value={assignLocationId}
            onChange={(e) => setAssignLocationId(e.target.value)}
          >
            <option value="">Ubicación destino…</option>
            {contractLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={!assignLocationId || assignMutation.isPending}
            onClick={() =>
              assignMutation.mutate({
                contractId: selectedContractId,
                positionIds: [...selected],
                locationId: assignLocationId,
              })
            }
          >
            Asignar a ubicación
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={assignMutation.isPending}
            onClick={() =>
              assignMutation.mutate({
                contractId: selectedContractId,
                positionIds: [...selected],
                locationId: null,
              })
            }
          >
            Quitar ubicación
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                {!readOnly && <th className="w-10 px-3 py-2" />}
                <th className="px-3 py-2 font-semibold text-slate-600">Puesto</th>
                <th className="px-3 py-2 font-semibold text-slate-600">Zona</th>
                <th className="px-3 py-2 font-semibold text-slate-600">Ubicación</th>
                <th className="px-3 py-2 font-semibold text-slate-600">Contrato</th>
                <th className="px-3 py-2 font-semibold text-slate-600">Empresa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  {!readOnly && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            return next;
                          });
                          setAssignContractId(r.contract.id);
                        }}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                  <td className="px-3 py-2">
                    {r.zone ? <Badge variant="secondary">{r.zone.name}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.location?.name ?? <span className="text-amber-700">Sin asignar</span>}</td>
                  <td className="px-3 py-2 text-slate-600">{r.contract.client}<br /><span className="text-xs">{r.contract.licitacionNo}</span></td>
                  <td className="px-3 py-2 text-slate-600">{companyDisplayName(r.contract.company, companyRows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-center text-slate-400">Sin puestos</p>}
        </div>
      )}
    </div>
  );
}
