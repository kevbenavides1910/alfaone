"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import { cn } from "@/lib/utils/cn";

type CatalogRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { documents: number; children?: number };
};

type EditForm = {
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

function emptyEdit(): EditForm {
  return { code: "", name: "", description: "", sortOrder: "0", isActive: true };
}

function rowToEdit(row: CatalogRow): EditForm {
  return {
    code: row.code,
    name: row.name,
    description: row.description ?? "",
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
  };
}

function deleteBlockedReason(row: CatalogRow, kind: "process" | "type"): string | null {
  if (kind === "type" && row._count.documents > 0) {
    return `Tiene ${row._count.documents} documento(s) vinculado(s)`;
  }
  if (kind === "process" && (row._count.children ?? 0) > 0) {
    return "Tiene subprocesos vinculados";
  }
  return null;
}

function CatalogListItem({
  row,
  kind,
  canEdit,
  canDelete,
  editing,
  editForm,
  onStartEdit,
  onCancelEdit,
  onChange,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  row: CatalogRow;
  kind: "process" | "type";
  canEdit: boolean;
  canDelete: boolean;
  editing: boolean;
  editForm: EditForm;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChange: (patch: Partial<EditForm>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}) {
  const blockReason = deleteBlockedReason(row, kind);

  if (editing) {
    return (
      <li className="border rounded-md p-3 space-y-2 bg-muted/30">
        <div>
          <Label className="text-xs">Código</Label>
          <Input
            value={editForm.code}
            onChange={(e) => onChange({ code: e.target.value })}
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input
            value={editForm.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Descripción</Label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-16"
            value={editForm.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-24">
            <Label className="text-xs">Orden</Label>
            <Input
              type="number"
              value={editForm.sortOrder}
              onChange={(e) => onChange({ sortOrder: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(e) => onChange({ isActive: e.target.checked })}
            />
            Activo
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!editForm.code.trim() || !editForm.name.trim() || saving || deleting}
            onClick={onSave}
          >
            <Check className="h-4 w-4 mr-1" />
            Guardar
          </Button>
          <Button size="sm" variant="outline" disabled={saving || deleting} onClick={onCancelEdit}>
            <X className="h-4 w-4 mr-1" />
            Cancelar
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="destructive"
              disabled={!!blockReason || saving || deleting}
              title={blockReason ?? "Eliminar"}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar
            </Button>
          )}
        </div>
        {blockReason && canDelete && (
          <p className="text-xs text-muted-foreground">No se puede eliminar: {blockReason}</p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-2 border-b py-2">
      <div className="min-w-0">
        <span>
          <strong>{row.code}</strong> — {row.name}
          {!row.isActive && <span className="text-amber-700"> (inactivo)</span>}
        </span>
        {row.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-muted-foreground text-xs mr-1">{row._count.documents} docs</span>
        {canEdit && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onStartEdit} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            disabled={!!blockReason || deleting}
            title={blockReason ?? "Eliminar"}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

export default function SigProcesosPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canEditProcess = hasPermission(session, "sig.procesos", "edit");
  const canEditTypes = hasPermission(session, "sig.procesos", "admin");

  const { data: processesData, isLoading: loadingProcesses } = useQuery({
    queryKey: ["sig-procesos-all"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos?all=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error");
      return r.json() as Promise<{ data: CatalogRow[] }>;
    },
  });

  const { data: typesData, isLoading: loadingTypes } = useQuery({
    queryKey: ["sig-tipos-all"],
    queryFn: async () => {
      const r = await fetch("/api/sig/tipos-documento?all=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error");
      return r.json() as Promise<{ data: CatalogRow[] }>;
    },
  });

  const [processForm, setProcessForm] = useState({ code: "", name: "" });
  const [typeForm, setTypeForm] = useState({ code: "", name: "" });
  const [editingProcessId, setEditingProcessId] = useState<string | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [processEdit, setProcessEdit] = useState<EditForm>(emptyEdit());
  const [typeEdit, setTypeEdit] = useState<EditForm>(emptyEdit());
  const [error, setError] = useState("");

  const invalidateCatalogs = () => {
    queryClient.invalidateQueries({ queryKey: ["sig-procesos-all"] });
    queryClient.invalidateQueries({ queryKey: ["sig-procesos"] });
    queryClient.invalidateQueries({ queryKey: ["sig-tipos-all"] });
    queryClient.invalidateQueries({ queryKey: ["sig-tipos"] });
  };

  const createProcess = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sig/procesos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processForm),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al crear proceso");
    },
    onSuccess: () => {
      setProcessForm({ code: "", name: "" });
      setError("");
      invalidateCatalogs();
    },
    onError: (e: Error) => setError(e.message),
  });

  const createType = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/sig/tipos-documento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeForm),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al crear tipo");
    },
    onSuccess: () => {
      setTypeForm({ code: "", name: "" });
      setError("");
      invalidateCatalogs();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateProcess = useMutation({
    mutationFn: async (id: string) => {
      const sortOrder = Number(processEdit.sortOrder);
      const r = await fetch(`/api/sig/procesos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: processEdit.code,
          name: processEdit.name,
          description: processEdit.description.trim() || null,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
          isActive: processEdit.isActive,
        }),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al actualizar proceso");
    },
    onSuccess: () => {
      setEditingProcessId(null);
      setError("");
      invalidateCatalogs();
    },
    onError: (e: Error) => setError(e.message),
  });

  const updateType = useMutation({
    mutationFn: async (id: string) => {
      const sortOrder = Number(typeEdit.sortOrder);
      const r = await fetch(`/api/sig/tipos-documento/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: typeEdit.code,
          name: typeEdit.name,
          description: typeEdit.description.trim() || null,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
          isActive: typeEdit.isActive,
        }),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al actualizar tipo");
    },
    onSuccess: () => {
      setEditingTypeId(null);
      setError("");
      invalidateCatalogs();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteProcess = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/sig/procesos/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Error al eliminar proceso");
      }
    },
    onSuccess: () => {
      setEditingProcessId(null);
      setError("");
      invalidateCatalogs();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/sig/tipos-documento/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Error al eliminar tipo");
      }
    },
    onSuccess: () => {
      setEditingTypeId(null);
      setError("");
      invalidateCatalogs();
    },
    onError: (e: Error) => setError(e.message),
  });

  const confirmDelete = (label: string, id: string, kind: "process" | "type") => {
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    if (kind === "process") deleteProcess.mutate(id);
    else deleteType.mutate(id);
  };

  const processes = processesData?.data ?? [];
  const types = typesData?.data ?? [];
  const saving = updateProcess.isPending || updateType.isPending;
  const deleting = deleteProcess.isPending || deleteType.isPending;

  return (
    <>
      <Topbar title="SIG — Procesos y tipos documentales" />
      <div className="p-4 grid gap-6 lg:grid-cols-2 max-w-6xl mx-auto">
        {error && (
          <p className="lg:col-span-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procesos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className={cn("text-sm space-y-1 max-h-80 overflow-y-auto", loadingProcesses && "opacity-60")}>
              {processes.map((p) => (
                <CatalogListItem
                  key={p.id}
                  row={p}
                  kind="process"
                  canEdit={canEditProcess}
                  canDelete={canEditProcess}
                  editing={editingProcessId === p.id}
                  editForm={processEdit}
                  onStartEdit={() => {
                    setEditingTypeId(null);
                    setEditingProcessId(p.id);
                    setProcessEdit(rowToEdit(p));
                    setError("");
                  }}
                  onCancelEdit={() => setEditingProcessId(null)}
                  onChange={(patch) => setProcessEdit((f) => ({ ...f, ...patch }))}
                  onSave={() => updateProcess.mutate(p.id)}
                  onDelete={() => confirmDelete(`el proceso ${p.code}`, p.id, "process")}
                  saving={saving}
                  deleting={deleting}
                />
              ))}
            </ul>
            {canEditProcess && (
              <div className="space-y-2 border-t pt-3">
                <Label>Nuevo proceso</Label>
                <Input
                  placeholder="Código"
                  value={processForm.code}
                  onChange={(e) => setProcessForm((f) => ({ ...f, code: e.target.value }))}
                />
                <Input
                  placeholder="Nombre"
                  value={processForm.name}
                  onChange={(e) => setProcessForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={!processForm.code || !processForm.name || createProcess.isPending}
                  onClick={() => createProcess.mutate()}
                >
                  Agregar proceso
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos documentales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className={cn("text-sm space-y-1 max-h-80 overflow-y-auto", loadingTypes && "opacity-60")}>
              {types.map((t) => (
                <CatalogListItem
                  key={t.id}
                  row={t}
                  kind="type"
                  canEdit={canEditTypes}
                  canDelete={canEditTypes}
                  editing={editingTypeId === t.id}
                  editForm={typeEdit}
                  onStartEdit={() => {
                    setEditingProcessId(null);
                    setEditingTypeId(t.id);
                    setTypeEdit(rowToEdit(t));
                    setError("");
                  }}
                  onCancelEdit={() => setEditingTypeId(null)}
                  onChange={(patch) => setTypeEdit((f) => ({ ...f, ...patch }))}
                  onSave={() => updateType.mutate(t.id)}
                  onDelete={() => confirmDelete(`el tipo ${t.code}`, t.id, "type")}
                  saving={saving}
                  deleting={deleting}
                />
              ))}
            </ul>
            {canEditTypes && (
              <div className="space-y-2 border-t pt-3">
                <Label>Nuevo tipo</Label>
                <Input
                  placeholder="Código"
                  value={typeForm.code}
                  onChange={(e) => setTypeForm((f) => ({ ...f, code: e.target.value }))}
                />
                <Input
                  placeholder="Nombre"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                />
                <Button
                  size="sm"
                  disabled={!typeForm.code || !typeForm.name || createType.isPending}
                  onClick={() => createType.mutate()}
                >
                  Agregar tipo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
