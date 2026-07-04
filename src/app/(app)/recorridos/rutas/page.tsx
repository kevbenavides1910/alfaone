"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronRight, Trash2, Search, RefreshCw, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { RecorridosPageHeader } from "@/components/recorridos/RecorridosPageHeader";

type RouteRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  pointsCount: number;
  assignmentsCount: number;
  contract: { licitacionNo: string; client: string } | null;
  location: { name: string } | null;
  position: { name: string } | null;
};

const emptyForm = { code: "", name: "", description: "", isActive: true };

export default function RecorridosRutasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ data: RouteRow[]; error?: { message: string } }>({
    queryKey: ["patrol-routes"],
    queryFn: async () => {
      const r = await fetch("/api/admin/patrol/routes");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al cargar rutas");
      return json;
    },
  });

  const allRows = data?.data ?? [];
  const q = search.toLowerCase().trim();
  const filtered = q
    ? allRows.filter((r) =>
        [r.name, r.code, r.description, r.contract?.licitacionNo, r.contract?.client, r.location?.name, r.position?.name]
          .some((v) => v?.toLowerCase().includes(q))
      )
    : allRows;
  const rows = showInactive ? filtered : filtered.filter((r) => r.isActive);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/patrol/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Error al crear");
      }
      return res.json();
    },
    onSuccess: (j) => {
      toast.success("Ruta creada");
      setOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["patrol-routes"] });
      if (j?.data?.id) window.location.href = `/recorridos/rutas/${j.data.id}`;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/patrol/routes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
    },
    onSuccess: () => {
      toast.success("Ruta eliminada");
      qc.invalidateQueries({ queryKey: ["patrol-routes"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      <RecorridosPageHeader
        icon={Route}
        title="Rutas de recorrido"
        description={
          isLoading
            ? "Defina rutas y puntos NFC con ventanas horarias para la app móvil."
            : `${rows.length} de ${allRows.length} ruta${allRows.length !== 1 ? "s" : ""} visibles · puntos NFC por ruta`
        }
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva ruta
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código, puesto, ubicación o contrato…"
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-input h-4 w-4 accent-primary"
            />
            Mostrar inactivas
          </label>
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching} title="Actualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Cargando rutas…</div>
          ) : isError ? (
            <div className="p-12 text-center text-red-600">{(error as Error)?.message ?? "Error al cargar."}</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              {q ? "Sin resultados para ese filtro." : "No hay rutas registradas. Cree la primera con «Nueva ruta»."}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Código</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Puesto / Ubicación</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Puntos</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-slate-700">{r.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.name}</div>
                      {r.contract ? (
                        <div className="text-xs text-slate-400">
                          {r.contract.licitacionNo} · {r.contract.client}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{r.position?.name ?? "—"}</div>
                      {r.location?.name ? (
                        <div className="text-xs text-slate-400">{r.location.name}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.pointsCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.isActive ? "success" : "secondary"}>
                        {r.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/recorridos/rutas/${r.id}`}>
                          Gestionar
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)} title="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva ruta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Código</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Crear y configurar puntos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
