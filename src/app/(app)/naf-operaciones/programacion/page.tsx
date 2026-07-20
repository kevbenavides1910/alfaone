"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  DEFAULT_OP_FILTERS,
  OpFiltersBar,
  type OpFilterState,
} from "@/components/naf-operaciones/OpFiltersBar";
import { useOpFiltros } from "@/components/naf-operaciones/use-op-filtros";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import {
  OP_DIA_SEMANA_LABELS,
  type OpAssignmentRow,
  type OpRoleRow,
} from "@/modules/naf-operaciones/business/op-types";

type RolesData = {
  rows: OpRoleRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type AssignData = {
  rows: OpAssignmentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type CreateForm = {
  noCiaGrupo: string;
  noContrato: string;
  noUbicacion: string;
  noRol: string;
  semanaPgr: string;
  diaSemana: string;
  tipoJornada: string;
  horas: string;
  estado: string;
  perfil: string;
  inicio: string;
  fin: string;
  noCiaEmple: string;
  noEmple: string;
};

const emptyCreate = (cia = "01"): CreateForm => ({
  noCiaGrupo: cia,
  noContrato: "",
  noUbicacion: "",
  noRol: "",
  semanaPgr: "0",
  diaSemana: "1",
  tipoJornada: "N",
  horas: "8",
  estado: "A",
  perfil: "",
  inicio: "",
  fin: "",
  noCiaEmple: cia,
  noEmple: "",
});

export default function NafOperacionesProgramacionPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session ?? null, "nafOperaciones.programacion", "edit");
  const qc = useQueryClient();
  const [filters, setFilters] = useState<OpFilterState>(DEFAULT_OP_FILTERS);
  const [applied, setApplied] = useState<OpFilterState>(DEFAULT_OP_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<OpRoleRow | null>(null);
  const [mode, setMode] = useState<"crear" | "editar">("crear");
  const [writeMsg, setWriteMsg] = useState<string | null>(null);
  const [writeErr, setWriteErr] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate());
  const filtros = useOpFiltros({
    noCiaGrupo: createForm.noCiaGrupo || undefined,
    noContrato: createForm.noContrato || undefined,
  });
  const [editForm, setEditForm] = useState({
    tipoJornada: "N",
    horas: "",
    estado: "A",
    perfil: "",
    inicio: "",
    fin: "",
  });
  const [reasignar, setReasignar] = useState({
    noCiaNuevo: "",
    noEmpleNuevo: "",
    tipo: "N",
  });

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (applied.q.trim()) sp.set("q", applied.q.trim());
    if (applied.noCiaGrupo) sp.set("noCiaGrupo", applied.noCiaGrupo);
    if (applied.noContrato) sp.set("noContrato", applied.noContrato);
    if (applied.noUbicacion) sp.set("noUbicacion", applied.noUbicacion);
    if (applied.semanaPgr.trim() !== "") sp.set("semanaPgr", applied.semanaPgr.trim());
    if (applied.estado === "*") sp.set("estado", "*");
    else if (applied.estado) sp.set("estado", applied.estado);
    return sp.toString();
  }, [applied, page]);

  const rolesQuery = useQuery({
    queryKey: ["naf-operaciones", "roles", "programacion", queryParams],
    queryFn: async (): Promise<RolesData> => {
      const res = await fetch(`/api/naf-operaciones/roles?${queryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Error al listar roles");
      }
      return ((await res.json()) as { data: RolesData }).data;
    },
  });

  const assignmentsQuery = useQuery({
    queryKey: ["naf-operaciones", "asignaciones", selected?.noRol],
    enabled: selected != null && mode === "editar",
    queryFn: async (): Promise<AssignData> => {
      const sp = new URLSearchParams();
      sp.set("noRol", String(selected!.noRol));
      sp.set("pageSize", "20");
      const res = await fetch(`/api/naf-operaciones/contratos?${sp}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Error al listar asignaciones");
      }
      return ((await res.json()) as { data: AssignData }).data;
    },
  });

  const suggestRol = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/naf-operaciones/roles/next");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo sugerir NO_ROL");
      return json.data.noRol as number;
    },
    onSuccess: (noRol) => {
      setCreateForm((f) => ({ ...f, noRol: String(noRol) }));
      setWriteErr(null);
    },
    onError: (e: Error) => setWriteErr(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const f = createForm;
      if (!f.noCiaGrupo || !f.noContrato || !f.noUbicacion || !f.noRol || !f.diaSemana) {
        throw new Error("Complete cia, contrato, ubicación, nº rol y día");
      }
      const res = await fetch("/api/naf-operaciones/roles/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noCiaGrupo: f.noCiaGrupo,
          noContrato: f.noContrato,
          noUbicacion: f.noUbicacion,
          noRol: Number(f.noRol),
          semanaPgr: Number(f.semanaPgr || 0),
          diaSemana: f.diaSemana,
          tipoJornada: f.tipoJornada || null,
          horas: f.horas !== "" ? Number(f.horas) : null,
          estado: f.estado || "A",
          perfil: f.perfil || null,
          inicio: f.inicio || null,
          fin: f.fin || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo crear el rol");

      if (f.noEmple.trim()) {
        const asign = await fetch("/api/naf-operaciones/contratos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "asignar",
            noCia: f.noCiaEmple || f.noCiaGrupo,
            noEmple: f.noEmple.trim(),
            noRol: Number(f.noRol),
            noContrato: f.noContrato,
            noUbicacion: f.noUbicacion,
            tipo: "N",
          }),
        });
        const aj = await asign.json().catch(() => null);
        if (!asign.ok) throw new Error(aj?.error?.message ?? "Rol creado pero falló la asignación");
        return { message: `${json.data?.message ?? "ROL_CREADO"} + asignado` };
      }
      return json.data as { message: string | null };
    },
    onSuccess: (data) => {
      setWriteErr(null);
      setWriteMsg(data.message ?? "Rol creado en Oracle");
      qc.invalidateQueries({ queryKey: ["naf-operaciones"] });
    },
    onError: (e: Error) => {
      setWriteMsg(null);
      setWriteErr(e.message);
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Seleccione un rol");
      const res = await fetch("/api/naf-operaciones/roles/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noCiaGrupo: selected.noCiaGrupo,
          noContrato: selected.noContrato,
          noUbicacion: selected.noUbicacion,
          noRol: selected.noRol,
          semanaPgr: selected.semanaPgr,
          diaSemana: selected.diaSemana,
          tipoJornada: editForm.tipoJornada || null,
          horas: editForm.horas !== "" ? Number(editForm.horas) : null,
          estado: editForm.estado || null,
          perfil: editForm.perfil || null,
          inicio: editForm.inicio || null,
          fin: editForm.fin || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo guardar el rol");
      return json.data as { message: string | null };
    },
    onSuccess: (data) => {
      setWriteErr(null);
      setWriteMsg(data.message ?? "Rol actualizado");
      qc.invalidateQueries({ queryKey: ["naf-operaciones", "roles"] });
    },
    onError: (e: Error) => {
      setWriteMsg(null);
      setWriteErr(e.message);
    },
  });

  const reasignarMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Seleccione un rol");
      const res = await fetch("/api/naf-operaciones/contratos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reasignar",
          noRol: selected.noRol,
          noCiaNuevo: reasignar.noCiaNuevo,
          noEmpleNuevo: reasignar.noEmpleNuevo,
          noContrato: selected.noContrato,
          noUbicacion: selected.noUbicacion,
          tipo: reasignar.tipo || "N",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo reasignar");
      return json.data as { message: string | null };
    },
    onSuccess: (data) => {
      setWriteErr(null);
      setWriteMsg(data.message ?? "Rol reasignado");
      qc.invalidateQueries({ queryKey: ["naf-operaciones"] });
    },
    onError: (e: Error) => {
      setWriteMsg(null);
      setWriteErr(e.message);
    },
  });

  const selectRole = (row: OpRoleRow) => {
    setMode("editar");
    setSelected(row);
    setWriteMsg(null);
    setWriteErr(null);
    setEditForm({
      tipoJornada: row.tipoJornada ?? "N",
      horas: row.horas != null ? String(row.horas) : "",
      estado: row.estado ?? "A",
      perfil: row.perfil ?? "",
      inicio: row.inicio ?? "",
      fin: row.fin ?? "",
    });
    setReasignar({
      noCiaNuevo: row.noCia ?? row.noCiaGrupo,
      noEmpleNuevo: "",
      tipo: "N",
    });
  };

  const patchCreate = (partial: Partial<CreateForm>) =>
    setCreateForm((f) => ({ ...f, ...partial }));

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Programación OP"
        description="Crear roles nuevos, editar plantilla AROPMR y reasignar propietario (AROPPR)."
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Button
                type="button"
                className={mode === "crear" ? "bg-red-600 hover:bg-red-700" : ""}
                variant={mode === "crear" ? "default" : "outline"}
                onClick={() => {
                  setMode("crear");
                  setSelected(null);
                  setWriteMsg(null);
                  setWriteErr(null);
                  setCreateForm(
                    emptyCreate(filtros.data?.companies?.[0]?.noCiaGrupo ?? "01"),
                  );
                }}
              >
                + Crear rol
              </Button>
              <Button
                type="button"
                variant={mode === "editar" ? "default" : "outline"}
                className={mode === "editar" ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={() => setMode("editar")}
              >
                Editar / reasignar
              </Button>
            </div>
          ) : undefined
        }
      />

      {!canEdit ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Solo consulta: falta permiso de edición <code>nafOperaciones.programacion</code>.
        </p>
      ) : null}

      {writeMsg ? <p className="text-sm text-emerald-700">{writeMsg}</p> : null}
      {writeErr ? <p className="text-sm text-red-600">{writeErr}</p> : null}

      {mode === "crear" && canEdit ? (
        <div className="space-y-4 rounded-lg border-2 border-red-200 bg-white p-4">
          <h3 className="text-base font-semibold text-gray-900">Nuevo rol (AROPMR)</h3>
          <p className="text-xs text-gray-500">
            Completa la clave del rol. Opcionalmente asigna empleado al crear.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Cia grupo *
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={createForm.noCiaGrupo}
                onChange={(e) =>
                  patchCreate({
                    noCiaGrupo: e.target.value,
                    noCiaEmple: e.target.value,
                    noContrato: "",
                    noUbicacion: "",
                  })
                }
              >
                {(filtros.data?.companies ?? [{ noCiaGrupo: "01", nombreGrupo: null }]).map((c) => (
                  <option key={c.noCiaGrupo} value={c.noCiaGrupo}>
                    {c.noCiaGrupo}
                    {c.nombreGrupo ? ` — ${c.nombreGrupo}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Contrato *
              <Input
                list="op-cto-list"
                value={createForm.noContrato}
                onChange={(e) => patchCreate({ noContrato: e.target.value })}
                placeholder="Ej. 2017LA-…"
              />
              <datalist id="op-cto-list">
                {(filtros.data?.contratos ?? []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Ubicación * (máx. 5)
              <Input
                list="op-ubi-list"
                value={createForm.noUbicacion}
                maxLength={5}
                onChange={(e) => patchCreate({ noUbicacion: e.target.value })}
              />
              <datalist id="op-ubi-list">
                {(filtros.data?.ubicaciones ?? []).map((u) => (
                  <option key={u.noUbicacion} value={u.noUbicacion}>
                    {u.nombre ?? u.noUbicacion}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Nº rol *
              <div className="flex gap-2">
                <Input
                  value={createForm.noRol}
                  onChange={(e) => patchCreate({ noRol: e.target.value })}
                  placeholder="23508"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={suggestRol.isPending}
                  onClick={() => suggestRol.mutate()}
                >
                  Sugerir
                </Button>
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Día *
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={createForm.diaSemana}
                onChange={(e) => patchCreate({ diaSemana: e.target.value })}
              >
                {Object.entries(OP_DIA_SEMANA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k} — {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Semana PGR
              <Input
                value={createForm.semanaPgr}
                onChange={(e) => patchCreate({ semanaPgr: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Horas
              <Input
                value={createForm.horas}
                onChange={(e) => patchCreate({ horas: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Estado
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={createForm.estado}
                onChange={(e) => patchCreate({ estado: e.target.value })}
              >
                <option value="A">A activo</option>
                <option value="I">I inactivo</option>
                <option value="P">P pendiente</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Perfil
              <Input
                value={createForm.perfil}
                onChange={(e) => patchCreate({ perfil: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Empleado cia (opcional)
              <Input
                value={createForm.noCiaEmple}
                onChange={(e) => patchCreate({ noCiaEmple: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Nº empleado (opcional)
              <Input
                value={createForm.noEmple}
                onChange={(e) => patchCreate({ noEmple: e.target.value })}
                placeholder="Asignar al crear"
              />
            </label>
          </div>
          <Button
            type="button"
            className="bg-red-600 hover:bg-red-700"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creando…" : "Crear rol en Oracle"}
          </Button>
        </div>
      ) : null}

      {mode === "editar" ? (
        <>
          <OpFiltersBar
            value={filters}
            onChange={setFilters}
            onSearch={() => {
              setPage(1);
              setApplied(filters);
            }}
          />

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Rol</th>
                      <th className="px-3 py-2">Día</th>
                      <th className="px-3 py-2">Contrato / Ubi</th>
                      <th className="px-3 py-2">PGR</th>
                      <th className="px-3 py-2">Asignado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rolesQuery.data?.rows ?? []).map((row) => {
                      const key = `${row.noCiaGrupo}-${row.noContrato}-${row.noUbicacion}-${row.noRol}-${row.semanaPgr}-${row.diaSemana}`;
                      const active =
                        selected &&
                        selected.noRol === row.noRol &&
                        selected.diaSemana === row.diaSemana &&
                        selected.semanaPgr === row.semanaPgr &&
                        selected.noUbicacion === row.noUbicacion;
                      return (
                        <tr
                          key={key}
                          className={`cursor-pointer border-t border-gray-100 ${active ? "bg-red-50" : "hover:bg-gray-50"}`}
                          onClick={() => selectRole(row)}
                        >
                          <td className="px-3 py-2 font-mono">{row.noRol}</td>
                          <td className="px-3 py-2">
                            {OP_DIA_SEMANA_LABELS[row.diaSemana] ?? row.diaSemana}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="font-mono">{row.noContrato}</div>
                            <div className="text-gray-500">{row.noUbicacion}</div>
                          </td>
                          <td className="px-3 py-2 text-center">{row.semanaPgr}</td>
                          <td className="px-3 py-2 text-xs">
                            {row.nombreEmpleado ??
                              (row.noEmple ? `${row.noCia}-${row.noEmple}` : "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {rolesQuery.isLoading ? "Cargando…" : `${rolesQuery.data?.total ?? 0} roles`}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={rolesQuery.data != null && page >= rolesQuery.data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
              {!selected ? (
                <p className="text-sm text-gray-500">
                  Seleccione un rol de la lista, o use <strong>+ Crear rol</strong>.
                </p>
              ) : (
                <>
                  <div>
                    <h3 className="text-base font-semibold">
                      Rol {selected.noRol} ·{" "}
                      {OP_DIA_SEMANA_LABELS[selected.diaSemana] ?? selected.diaSemana}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selected.noCiaGrupo} / {selected.noContrato} / {selected.noUbicacion} / PGR{" "}
                      {selected.semanaPgr}
                    </p>
                    <Badge className="mt-2" variant="secondary">
                      {selected.estado ?? "—"}
                    </Badge>
                  </div>

                  <fieldset disabled={!canEdit} className="space-y-3">
                    <legend className="text-sm font-medium text-gray-800">
                      Actualizar plantilla
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Tipo jornada
                        <Input
                          value={editForm.tipoJornada}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, tipoJornada: e.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Horas
                        <Input
                          value={editForm.horas}
                          onChange={(e) => setEditForm((f) => ({ ...f, horas: e.target.value }))}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Estado
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={editForm.estado}
                          onChange={(e) => setEditForm((f) => ({ ...f, estado: e.target.value }))}
                        >
                          <option value="A">A</option>
                          <option value="I">I</option>
                          <option value="P">P</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Perfil
                        <Input
                          value={editForm.perfil}
                          onChange={(e) => setEditForm((f) => ({ ...f, perfil: e.target.value }))}
                        />
                      </label>
                    </div>
                    <Button
                      type="button"
                      className="bg-red-600 hover:bg-red-700"
                      disabled={upsertMutation.isPending}
                      onClick={() => upsertMutation.mutate()}
                    >
                      {upsertMutation.isPending ? "Guardando…" : "Guardar plantilla"}
                    </Button>
                  </fieldset>

                  <fieldset disabled={!canEdit} className="space-y-3 border-t border-gray-100 pt-4">
                    <legend className="text-sm font-medium text-gray-800">
                      Reasignar propietario
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Cia empleado
                        <Input
                          value={reasignar.noCiaNuevo}
                          onChange={(e) =>
                            setReasignar((r) => ({ ...r, noCiaNuevo: e.target.value }))
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">
                        Nº empleado
                        <Input
                          value={reasignar.noEmpleNuevo}
                          onChange={(e) =>
                            setReasignar((r) => ({ ...r, noEmpleNuevo: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={reasignarMutation.isPending || !reasignar.noEmpleNuevo.trim()}
                      onClick={() => reasignarMutation.mutate()}
                    >
                      {reasignarMutation.isPending ? "Reasignando…" : "Reasignar empleado"}
                    </Button>
                  </fieldset>

                  <div className="border-t border-gray-100 pt-4">
                    <h4 className="mb-2 text-sm font-medium">Propietarios semana (AROPPR)</h4>
                    <ul className="space-y-1 text-sm">
                      {(assignmentsQuery.data?.rows ?? []).map((a, idx) => (
                        <li
                          key={`${a.noCia}-${a.noEmple}-${idx}`}
                          className="flex justify-between gap-2"
                        >
                          {a.noCia && a.noEmple ? (
                            <Link
                              href={`/empleados-naf/${a.noCia}-${a.noEmple}`}
                              className="text-red-700 hover:underline"
                            >
                              {a.nombreEmpleado ?? `${a.noCia}-${a.noEmple}`}
                            </Link>
                          ) : (
                            <span>—</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </ModulePage>
  );
}
