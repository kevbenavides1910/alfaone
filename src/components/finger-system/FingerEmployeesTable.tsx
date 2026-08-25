"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FingerCompanyFilterHint } from "@/components/finger-system/FingerCompanyFilterHint";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";
import type { FingerEmployeeLinkRow } from "@/modules/finger-system/services/finger-employees-list";

type ListResponse = {
  items: FingerEmployeeLinkRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function FingerEmployeesTable() {
  const queryClient = useQueryClient();
  const { companyCode } = useFingerCompany();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [companyCode]);

  const settingsQuery = useQuery({
    queryKey: ["finger-system-settings"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/settings", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error");
      return json.data as { attReadOnly: boolean };
    },
  });

  const listQuery = useQuery<{ data: ListResponse }>({
    queryKey: ["finger-employees", q, page, companyCode],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(fingerApiUrl(`/api/finger-system/employees?${qs}`, companyCode), {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar");
      return json;
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finger-system/employees/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push-att" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al enviar a ATT2016");
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-employees"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finger-system/employees/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message ?? "Error al eliminar");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-employees"] }),
  });

  const data = listQuery.data?.data;
  const attReadOnly = settingsQuery.data?.attReadOnly !== false;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Vínculos biométricos</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Enlaces locales entre RRHH y ATT2016. El push a ATT2016 requiere desactivar modo lectura.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancelar" : "Nuevo vínculo"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate ? (
          <CreateLinkForm
            attReadOnly={attReadOnly}
            onSuccess={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["finger-employees"] });
            }}
          />
        ) : null}

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar por código, nombre o badge…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-sm"
          />
          <FingerCompanyFilterHint />
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
            {listQuery.isFetching ? "Cargando…" : "Actualizar"}
          </Button>
        </div>

        {listQuery.isError ? (
          <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
        ) : null}

        {data ? (
          <>
            <p className="text-sm text-slate-500">
              {data.total} vínculo{data.total === 1 ? "" : "s"}
            </p>
            <div className="overflow-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Empleado</th>
                    <th className="px-3 py-2 text-left font-medium">Badge</th>
                    <th className="px-3 py-2 text-left font-medium">USERID</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                    <th className="px-3 py-2 text-left font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">
                        <div>{row.employee.nombre}</div>
                        <div className="text-xs text-slate-500">{row.employee.codigoEmpleado}</div>
                      </td>
                      <td className="px-3 py-2 font-mono">{row.badgeNumber ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">{row.attUserId ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.attUserId ? (
                          <Badge variant="secondary">En ATT2016</Badge>
                        ) : (
                          <Badge variant="outline">Solo local</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {!row.attUserId ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={attReadOnly || pushMutation.isPending}
                              title={
                                attReadOnly
                                  ? "Active escritura ATT2016 en configuración"
                                  : "Crear registro en USERINFO"
                              }
                              onClick={() => pushMutation.mutate(row.id)}
                            >
                              Push ATT
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (confirm("¿Eliminar este vínculo biométrico?")) {
                                deleteMutation.mutate(row.id);
                              }
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                        No hay vínculos. Importe desde ATT2016 o cree uno nuevo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {data.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  Página {data.page} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </>
        ) : listQuery.isLoading ? (
          <p className="text-sm text-slate-500">Cargando vínculos…</p>
        ) : null}

        {pushMutation.isError ? (
          <p className="text-sm text-red-600">{(pushMutation.error as Error).message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreateLinkForm({
  attReadOnly,
  onSuccess,
}: {
  attReadOnly: boolean;
  onSuccess: () => void;
}) {
  const [employeeCodigo, setEmployeeCodigo] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [pushToAtt, setPushToAtt] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/employees", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCodigo,
          badgeNumber: badgeNumber.trim() || undefined,
          pushToAtt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al crear vínculo");
      return json.data;
    },
    onSuccess: () => onSuccess(),
  });

  return (
    <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
      <p className="text-sm font-medium text-slate-900">Crear vínculo manual</p>
      <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="codigo">Código empleado RRHH</Label>
          <Input
            id="codigo"
            value={employeeCodigo}
            onChange={(e) => setEmployeeCodigo(e.target.value)}
            placeholder="Ej. 20508"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="badge">Badge biométrico (opcional)</Label>
          <Input
            id="badge"
            value={badgeNumber}
            onChange={(e) => setBadgeNumber(e.target.value)}
            placeholder="Por defecto = código RRHH"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={pushToAtt}
          disabled={attReadOnly}
          onChange={(e) => setPushToAtt(e.target.checked)}
        />
        Crear también en ATT2016 (USERID = MAX+1)
        {attReadOnly ? (
          <span className="text-xs text-amber-700">— requiere desactivar modo lectura</span>
        ) : null}
      </label>
      <Button
        size="sm"
        disabled={!employeeCodigo.trim() || createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        {createMutation.isPending ? "Guardando…" : "Guardar vínculo"}
      </Button>
      {createMutation.isError ? (
        <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}
