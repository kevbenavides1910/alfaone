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
import type { FingerShiftRow } from "@/modules/finger-system/services/finger-shifts";

export function FingerShiftsPanel() {
  const queryClient = useQueryClient();
  const { companyCode } = useFingerCompany();
  const [showCreate, setShowCreate] = useState(false);

  const listQuery = useQuery<{ data: FingerShiftRow[] }>({
    queryKey: ["finger-shifts", companyCode],
    queryFn: async () => {
      const res = await fetch(fingerApiUrl("/api/finger-system/shifts", companyCode), {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar turnos");
      return json;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finger-system/shifts/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message ?? "Error al eliminar");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-shifts"] }),
  });

  const shifts = listQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Horarios de trabajo</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Turnos para cálculo de asistencia. Tolerancias alineadas con ATTPARAM (10 min tarde, 5 min
            salida, 420 min jornada).
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "Cancelar" : "Nuevo turno"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <FingerCompanyFilterHint />

        {showCreate ? (
          <CreateShiftForm
            companyCode={companyCode}
            onSuccess={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["finger-shifts"] });
            }}
          />
        ) : null}

        {listQuery.isError ? (
          <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
        ) : null}

        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-3 py-2 text-left font-medium">Empresa</th>
                <th className="px-3 py-2 text-left font-medium">Horario</th>
                <th className="px-3 py-2 text-left font-medium">Tolerancias</th>
                <th className="px-3 py-2 text-left font-medium">Jornada mín.</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {s.name}
                      {s.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.company ?? "Global"}</td>
                  <td className="px-3 py-2 font-mono">
                    {s.startTime} – {s.endTime}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    +{s.lateGraceMinutes}m tarde / −{s.earlyLeaveGraceMinutes}m salida
                  </td>
                  <td className="px-3 py-2">{Math.round(s.minWorkMinutes / 60)}h</td>
                  <td className="px-3 py-2">
                    {s.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!s.isDefault ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm(`¿Eliminar turno ${s.name}?`)) deleteMutation.mutate(s.id);
                        }}
                      >
                        Eliminar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {shifts.length === 0 && !listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Sin turnos configurados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateShiftForm({
  onSuccess,
  companyCode,
}: {
  onSuccess: () => void;
  companyCode: string | null;
}) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [lateGrace, setLateGrace] = useState("10");
  const [earlyGrace, setEarlyGrace] = useState("5");
  const [minWork, setMinWork] = useState("420");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/shifts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          startTime,
          endTime,
          company: companyCode ?? undefined,
          lateGraceMinutes: Number.parseInt(lateGrace, 10) || 10,
          earlyLeaveGraceMinutes: Number.parseInt(earlyGrace, 10) || 5,
          minWorkMinutes: Number.parseInt(minWork, 10) || 420,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al crear");
      return json.data;
    },
    onSuccess: () => onSuccess(),
  });

  return (
    <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
      <p className="text-sm font-medium">Nuevo turno</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre" value={name} onChange={setName} />
        <Field label="Entrada (HH:mm)" value={startTime} onChange={setStartTime} />
        <Field label="Salida (HH:mm)" value={endTime} onChange={setEndTime} />
        <Field label="Tolerancia tarde (min)" value={lateGrace} onChange={setLateGrace} />
        <Field label="Tolerancia salida (min)" value={earlyGrace} onChange={setEarlyGrace} />
        <Field label="Jornada mínima (min)" value={minWork} onChange={setMinWork} />
      </div>
      <Button size="sm" disabled={!name.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
        {createMutation.isPending ? "Guardando…" : "Guardar turno"}
      </Button>
      {createMutation.isError ? (
        <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
