"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Copy, Shield } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { isPlatformAdmin } from "@/lib/permissions/check";
import {
  RolePermissionMatrix,
  emptyPermissionMap,
} from "@/components/admin/RolePermissionMatrix";
import type { PermissionKey, PermissionLevelId } from "@/lib/permissions/registry";
import { allPermissionKeys } from "@/lib/permissions/registry";

interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: { permissionKey: string; level: PermissionLevelId }[];
}

interface RoleDetail extends RoleRow {
  permissionMap: Record<string, PermissionLevelId>;
}

async function parseJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  if (!text.trim()) throw new Error(`Error ${r.status}`);
  const j = JSON.parse(text) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error((j as { error?: { message?: string } }).error?.message ?? `Error ${r.status}`);
  return j;
}

export default function RolesPage() {
  const { data: session, status, update: refreshSession } = useSession();
  const queryClient = useQueryClient();
  const canManage =
    status === "authenticated" && session ? isPlatformAdmin(session) : false;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permMap, setPermMap] = useState(emptyPermissionMap);

  const { data, isLoading, refetch } = useQuery<{ data: RoleRow[] }>({
    queryKey: ["roles"],
    queryFn: () => fetch("/api/admin/roles", { credentials: "same-origin" }).then((r) =>
      parseJson(r)
    ),
    enabled: status === "authenticated" && canManage,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions = allPermissionKeys().map((key) => ({
        permissionKey: key,
        level: permMap[key] ?? "none",
      }));
      const body = { name, description: description || undefined, permissions };
      const url = editingId ? `/api/admin/roles/${editingId}` : "/api/admin/roles";
      const r = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson(r);
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      if (editingId && session?.user.roleId === editingId) {
        await refreshSession();
      }
      toast.success(editingId ? "Rol actualizado" : "Rol creado");
      setShowModal(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
      return parseJson(r);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rol eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const r = await fetch(`/api/admin/roles/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      return parseJson(r);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rol duplicado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openEdit(id: string) {
    const r = await fetch(`/api/admin/roles/${id}`);
    const res = await parseJson<{ data: RoleDetail }>(r);
    setEditingId(id);
    setName(res.data.name);
    setDescription(res.data.description ?? "");
    setPermMap({ ...emptyPermissionMap(), ...res.data.permissionMap });
    setShowModal(true);
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setDescription("");
    setPermMap(emptyPermissionMap());
    setShowModal(true);
  }

  const roles = data?.data ?? [];

  if (status === "loading") {
    return (
      <>
        <Topbar title="Roles y permisos" />
        <div className="p-12 text-center text-slate-400">Cargando…</div>
      </>
    );
  }

  if (!canManage) {
    return (
      <>
        <Topbar title="Roles y permisos" />
        <Card className="m-6">
          <CardContent className="p-8 text-center text-slate-600">
            No tiene permiso para gestionar roles.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Topbar title="Roles y permisos" />
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Roles</h2>
            <p className="text-sm text-slate-500">
              Defina qué módulos y pantallas puede ver o editar cada rol.
            </p>
          </div>
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nuevo rol
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400">Cargando roles…</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold">Código</th>
                    <th className="text-left px-4 py-3 font-semibold">Usuarios</th>
                    <th className="text-left px-4 py-3 font-semibold">Permisos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roles.map((role) => (
                    <tr key={role.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Sistema
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{role.code}</td>
                      <td className="px-4 py-3">{role.userCount}</td>
                      <td className="px-4 py-3 text-slate-500">{role.permissions.length} pantallas</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(role.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Duplicar"
                            onClick={() => {
                              const n = prompt("Nombre del nuevo rol:", `${role.name} (copia)`);
                              if (n?.trim()) duplicateMutation.mutate({ id: role.id, newName: n.trim() });
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {!role.isSystem && role.userCount === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => {
                                if (confirm(`¿Eliminar rol "${role.name}"?`)) {
                                  deleteMutation.mutate(role.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-slate-400 flex items-center gap-1">
          <Shield className="h-3.5 w-3.5" />
          Al añadir pantallas nuevas, registrarlas en{" "}
          <code className="text-slate-600">src/lib/permissions/registry.ts</code> (ver docs/PERMISSIONS.md).
        </p>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nombre</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <RolePermissionMatrix
              value={permMap}
              onChange={(key, level) =>
                setPermMap((prev) => ({ ...prev, [key]: level }))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
