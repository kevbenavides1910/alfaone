"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";
import {
  TableColumnFilterHead,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { DataTable } from "@/components/monitoreo/mantenimientos/DataTable";
import { CatalogShell, Loading, ActionButtons, FormDialog, FormGrid, Field } from "@/components/monitoreo/mantenimientos/catalog-helpers";

async function parseJson(r: Response) {
  const json = await r.json();
  if (!r.ok || json.error) throw new Error(json.error?.message ?? `Error ${r.status}`);
  return json;
}


type AlarmCode = {
  id: string;
  alarmNumber: number;
  finca: string;
  zona: string;
  motorizado: string;
  bodycam: string | null;
  grupoWsp: string | null;
  encargado: string | null;
  numeroEncargado: string | null;
  isActive: boolean;
};

export function AlarmCodesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<AlarmCode | null>(null);
  const [form, setForm] = useState({
    alarmNumber: "",
    finca: "",
    zona: "",
    motorizado: "",
    bodycam: "",
    grupoWsp: "",
    encargado: "",
    numeroEncargado: "",
    isActive: true,
  });

  const { data, isLoading } = useQuery<{ data: AlarmCode[] }>({
    queryKey: ["monitoreo-alarm-codes", q],
    queryFn: () =>
      fetch(`/api/monitoreo/alarm-codes${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => parseJson(r)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        alarmNumber: Number(form.alarmNumber),
        finca: form.finca,
        zona: form.zona,
        motorizado: form.motorizado,
        bodycam: form.bodycam || null,
        grupoWsp: form.grupoWsp || null,
        encargado: form.encargado || null,
        numeroEncargado: form.numeroEncargado || null,
        isActive: form.isActive,
      };
      const url = edit ? `/api/monitoreo/alarm-codes/${edit.id}` : "/api/monitoreo/alarm-codes";
      const r = await fetch(url, {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson(r);
    },
    onSuccess: () => {
      toast.success(edit ? "Actualizado" : "Creado");
      qc.invalidateQueries({ queryKey: ["monitoreo-alarm-codes"] });
      setShow(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/monitoreo/alarm-codes/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["monitoreo-alarm-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  function openAdd() {
    setEdit(null);
    setForm({ alarmNumber: "", finca: "", zona: "", motorizado: "", bodycam: "", grupoWsp: "", encargado: "", numeroEncargado: "", isActive: true });
    setShow(true);
  }

  function openEdit(row: AlarmCode) {
    setEdit(row);
    setForm({
      alarmNumber: String(row.alarmNumber),
      finca: row.finca,
      zona: row.zona,
      motorizado: row.motorizado,
      bodycam: row.bodycam ?? "",
      grupoWsp: row.grupoWsp ?? "",
      encargado: row.encargado ?? "",
      numeroEncargado: row.numeroEncargado ?? "",
      isActive: row.isActive,
    });
    setShow(true);
  }

  return (
    <CatalogShell
      title={`${rows.length} códigos`}
      onAdd={openAdd}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Buscar por código, finca o zona..."
    >
      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          headers={["Código", "Finca", "Zona", "Motorizado", "Bodycam", "Grupo WSP", "Encargado", "Tel.", ""]}
          rows={rows.map((r) => [
            r.alarmNumber,
            r.finca,
            r.zona,
            r.motorizado,
            r.bodycam ?? "—",
            r.grupoWsp ?? "—",
            r.encargado ?? "—",
            r.numeroEncargado ?? "—",
            <ActionButtons key={r.id} onEdit={() => openEdit(r)} onDelete={() => del.mutate(r.id)} />,
          ])}
        />
      )}

      <FormDialog
        open={show}
        onOpenChange={setShow}
        title={edit ? "Editar código" : "Nuevo código"}
        saving={save.isPending}
        onSave={() => save.mutate()}
      >
        <FormGrid>
          <Field label="Número de alarma" disabled={!!edit}>
            <Input value={form.alarmNumber} onChange={(e) => setForm({ ...form, alarmNumber: e.target.value })} disabled={!!edit} type="number" />
          </Field>
          <Field label="Finca"><Input value={form.finca} onChange={(e) => setForm({ ...form, finca: e.target.value })} /></Field>
          <Field label="Zona"><Input value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })} /></Field>
          <Field label="Motorizado"><Input value={form.motorizado} onChange={(e) => setForm({ ...form, motorizado: e.target.value })} /></Field>
          <Field label="Bodycam"><Input value={form.bodycam} onChange={(e) => setForm({ ...form, bodycam: e.target.value })} /></Field>
          <Field label="Grupo WhatsApp"><Input value={form.grupoWsp} onChange={(e) => setForm({ ...form, grupoWsp: e.target.value })} /></Field>
          <Field label="Encargado"><Input value={form.encargado} onChange={(e) => setForm({ ...form, encargado: e.target.value })} /></Field>
          <Field label="Número encargado"><Input value={form.numeroEncargado} onChange={(e) => setForm({ ...form, numeroEncargado: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Pantallas ─────────────────────────────────────────────────────────────────

type Pantalla = {
  id: string;
  finca: string;
  zona: string;
  pantalla: number | null;
  camara: number | null;
  zonaExterna: string | null;
  pantalla2: number | null;
  camara2: number | null;
  alarmCode: { alarmNumber: number; finca: string; zona: string };
};

