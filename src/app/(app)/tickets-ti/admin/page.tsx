"use client";

import { useMemo, useState } from "react";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/auth/client-session";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";

type CatalogRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  slaMinutes?: number;
};

type TechnicianRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  sortOrder: number;
  isActive: boolean;
};

type UserOption = { id: string; name: string; email: string };

type Catalogs = {
  categories: CatalogRow[];
  priorities: CatalogRow[];
  statuses: CatalogRow[];
  types: CatalogRow[];
  closeReasons: CatalogRow[];
  technicians: TechnicianRow[];
  availableUsers: UserOption[];
};

const STANDARD_KINDS = [
  { kind: "category", label: "Categorías", key: "categories" as const },
  { kind: "priority", label: "Prioridades", key: "priorities" as const },
  { kind: "status", label: "Estados", key: "statuses" as const },
  { kind: "type", label: "Tipos", key: "types" as const },
  { kind: "closeReason", label: "Motivos de cierre", key: "closeReasons" as const },
];

export default function TicketsTiAdminPage() {
  const { data: session } = useSession();
  const canAdmin = hasPermission(session, "ticketsTi.admin", "admin");
  const qc = useQueryClient();

  const [selectedKind, setSelectedKind] = useState("category");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [slaMinutes, setSlaMinutes] = useState("480");
  const [newTechnicianUserId, setNewTechnicianUserId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Partial<CatalogRow>>>({});

  const { data, isLoading } = useQuery<{ data: Catalogs }>({
    queryKey: ["tickets-ti-catalogs-admin"],
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/catalogs");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const catalogs = data?.data;
  const isTechnicianTab = selectedKind === "technician";

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tickets-ti-catalogs-admin"] });

  const upsertMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        kind: selectedKind,
        code: code.trim().toUpperCase(),
        name: name.trim(),
      };
      if (selectedKind === "priority") body.slaMinutes = Number(slaMinutes);
      const r = await fetch("/api/tickets-ti/catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Ítem agregado");
      setCode("");
      setName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTechnicianMut = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch("/api/tickets-ti/catalogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Técnico agregado");
      setNewTechnicianUserId("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const r = await fetch("/api/tickets-ti/catalogs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (payload: { kind: string; id: string }) => {
      const r = await fetch("/api/tickets-ti/catalogs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json.data;
    },
    onSuccess: () => {
      toast.success("Ítem eliminado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function draftFor(row: CatalogRow): CatalogRow {
    return { ...row, ...drafts[row.id] };
  }

  function setDraft(id: string, patch: Partial<CatalogRow>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function saveRow(row: CatalogRow) {
    const d = draftFor(row);
    updateMut.mutate({
      kind: selectedKind,
      id: row.id,
      name: d.name,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      ...(selectedKind === "priority" ? { slaMinutes: d.slaMinutes } : {}),
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
  }

  function confirmDelete(kind: string, id: string, label: string) {
    if (!window.confirm(`¿Eliminar «${label}»? Esta acción no se puede deshacer.`)) return;
    deleteMut.mutate({ kind, id });
  }

  const activeMeta = STANDARD_KINDS.find((k) => k.kind === selectedKind);
  const standardRows = activeMeta ? (catalogs?.[activeMeta.key] ?? []) : [];
  const technicianRows = catalogs?.technicians ?? [];
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const standardColumnDefs = useMemo((): TableColumnFilterDef<CatalogRow>[] => {
    const cols: TableColumnFilterDef<CatalogRow>[] = [
      { key: "code", label: "Código", headerClassName: "px-3 py-2 font-medium", getValue: (r) => r.code },
      { key: "name", label: "Nombre", headerClassName: "px-3 py-2 font-medium", getValue: (r) => r.name },
      { key: "order", label: "Orden", headerClassName: "px-3 py-2 font-medium", getValue: (r) => String(r.sortOrder) },
    ];
    if (selectedKind === "priority") {
      cols.push({
        key: "sla",
        label: "SLA (min)",
        headerClassName: "px-3 py-2 font-medium",
        getValue: (r) => String(r.slaMinutes ?? ""),
      });
    }
    cols.push({
      key: "activo",
      label: "Activo",
      headerClassName: "px-3 py-2 font-medium",
      getValue: (r) => (r.isActive ? "Sí" : "No"),
    });
    if (canAdmin) {
      cols.push({
        key: "actions",
        label: "Acciones",
        headerClassName: "px-3 py-2 font-medium",
        filterable: false,
        getValue: () => "",
      });
    }
    return cols;
  }, [selectedKind, canAdmin]);
  const displayedStandardRows = filterRowsByColumnFilters(standardRows, columnFilters, standardColumnDefs);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
        <Link href="/tickets-ti">
          <ArrowLeft className="h-4 w-4" />
          Centro de Operaciones
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administración</h1>
        <p className="text-sm text-slate-500 mt-1">
          Edite catálogos, active o desactive ítems, agregue opciones y configure técnicos.
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-500">Cargando catálogos…</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Catálogos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {STANDARD_KINDS.map((k) => (
                <Button
                  key={k.kind}
                  type="button"
                  size="sm"
                  variant={selectedKind === k.kind ? "default" : "outline"}
                  onClick={() => setSelectedKind(k.kind)}
                >
                  {k.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant={isTechnicianTab ? "default" : "outline"}
                onClick={() => setSelectedKind("technician")}
              >
                Técnicos
              </Button>
            </div>

            {!isTechnicianTab ? (
              <>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table data-table-id="tickets-ti-admin-estandares" className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <TableColumnFilterHead
                      tableId="tickets-ti-admin-estandares"
                      defaultColumnWidths={{
                        code: 120,
                        name: 200,
                        order: 80,
                        sla: 90,
                        activo: 90,
                        actions: 90,
                      }}
                      columns={standardColumnDefs}
                      rows={standardRows}
                      filters={columnFilters}
                      onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                    />
                  </thead>
                  <tbody>
                    {displayedStandardRows.map((row) => {
                        const d = draftFor(row);
                        return (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                            <td className="px-3 py-2">
                              {canAdmin ? (
                                <Input
                                  className="h-8 min-w-[160px]"
                                  value={d.name}
                                  onChange={(e) => setDraft(row.id, { name: e.target.value })}
                                />
                              ) : (
                                row.name
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {canAdmin ? (
                                <Input
                                  className="h-8 w-16"
                                  type="number"
                                  value={d.sortOrder}
                                  onChange={(e) =>
                                    setDraft(row.id, { sortOrder: Number(e.target.value) || 0 })
                                  }
                                />
                              ) : (
                                row.sortOrder
                              )}
                            </td>
                            {selectedKind === "priority" && (
                              <td className="px-3 py-2">
                                {canAdmin ? (
                                  <Input
                                    className="h-8 w-20"
                                    type="number"
                                    value={d.slaMinutes ?? 480}
                                    onChange={(e) =>
                                      setDraft(row.id, { slaMinutes: Number(e.target.value) || 480 })
                                    }
                                  />
                                ) : (
                                  (row.slaMinutes ?? "—")
                                )}
                              </td>
                            )}
                            <td className="px-3 py-2">
                              {canAdmin ? (
                                <input
                                  type="checkbox"
                                  checked={d.isActive}
                                  onChange={(e) => setDraft(row.id, { isActive: e.target.checked })}
                                />
                              ) : d.isActive ? (
                                "Sí"
                              ) : (
                                "No"
                              )}
                            </td>
                            {canAdmin && (
                              <td className="px-3 py-2">
                                <div className="flex gap-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    disabled={updateMut.isPending}
                                    onClick={() => saveRow(row)}
                                    title="Guardar"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-600 hover:text-red-700"
                                    disabled={deleteMut.isPending}
                                    onClick={() => confirmDelete(selectedKind, row.id, row.name)}
                                    title="Eliminar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {canAdmin && (
                  <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-slate-100">
                    <div className="space-y-1.5">
                      <Label>Código (nuevo)</Label>
                      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EJ: RED" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nombre</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre visible" />
                    </div>
                    {selectedKind === "priority" && (
                      <div className="space-y-1.5">
                        <Label>SLA (minutos)</Label>
                        <Input value={slaMinutes} onChange={(e) => setSlaMinutes(e.target.value)} />
                      </div>
                    )}
                    <div className="sm:col-span-3">
                      <Button
                        className="gap-2"
                        disabled={upsertMut.isPending || !code.trim() || !name.trim()}
                        onClick={() => upsertMut.mutate()}
                      >
                        {upsertMut.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Agregar ítem
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Usuarios que aparecen como opción «Técnico» al crear un ticket.
                </p>
                <div className="overflow-x-auto rounded-md border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Nombre</th>
                        <th className="px-3 py-2 font-medium">Correo</th>
                        <th className="px-3 py-2 font-medium">Orden</th>
                        <th className="px-3 py-2 font-medium">Activo</th>
                        {canAdmin && <th className="px-3 py-2 font-medium">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {technicianRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2 text-slate-600">{row.email}</td>
                          <td className="px-3 py-2">
                            {canAdmin ? (
                              <Input
                                className="h-8 w-16"
                                type="number"
                                defaultValue={row.sortOrder}
                                onBlur={(e) => {
                                  const sortOrder = Number(e.target.value) || 0;
                                  if (sortOrder !== row.sortOrder) {
                                    updateMut.mutate({ kind: "technician", id: row.id, sortOrder });
                                  }
                                }}
                              />
                            ) : (
                              row.sortOrder
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {canAdmin ? (
                              <input
                                type="checkbox"
                                checked={row.isActive}
                                onChange={(e) =>
                                  updateMut.mutate({
                                    kind: "technician",
                                    id: row.id,
                                    isActive: e.target.checked,
                                  })
                                }
                              />
                            ) : row.isActive ? (
                              "Sí"
                            ) : (
                              "No"
                            )}
                          </td>
                          {canAdmin && (
                            <td className="px-3 py-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-red-600"
                                disabled={deleteMut.isPending}
                                onClick={() => confirmDelete("technician", row.id, row.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canAdmin && (
                  <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-slate-100">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                      <Label>Agregar usuario como técnico</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                        value={newTechnicianUserId}
                        onChange={(e) => setNewTechnicianUserId(e.target.value)}
                      >
                        <option value="">Seleccione usuario…</option>
                        {catalogs?.availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      className="gap-2"
                      disabled={addTechnicianMut.isPending || !newTechnicianUserId}
                      onClick={() => addTechnicianMut.mutate(newTechnicianUserId)}
                    >
                      {addTechnicianMut.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Agregar técnico
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
