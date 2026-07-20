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


type Pila = { id: string; finca: string; desmane: string | null; paneo: string | null; zonaMotorizado: string | null; observaciones: string | null };

export function PilasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Pila[] }>({
    queryKey: ["monitoreo-pilas"],
    queryFn: () => fetch("/api/monitoreo/pilas-fincas").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Pila | null>(null);
  const [form, setForm] = useState({ finca: "", desmane: "", paneo: "", zonaMotorizado: "", observaciones: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = { finca: form.finca, desmane: form.desmane || null, paneo: form.paneo || null, zonaMotorizado: form.zonaMotorizado || null, observaciones: form.observaciones || null };
      const url = edit ? `/api/monitoreo/pilas-fincas/${edit.id}` : "/api/monitoreo/pilas-fincas";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["monitoreo-pilas"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/monitoreo/pilas-fincas/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["monitoreo-pilas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} fincas`} onAdd={() => { setEdit(null); setForm({ finca: "", desmane: "", paneo: "", zonaMotorizado: "", observaciones: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Finca", "Desmane", "Paneo", "Zona", "Observaciones", ""]}
          rows={rows.map((r) => [r.finca, r.desmane ?? "—", r.paneo ?? "—", r.zonaMotorizado ?? "—", r.observaciones ?? "—", <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ finca: r.finca, desmane: r.desmane ?? "", paneo: r.paneo ?? "", zonaMotorizado: r.zonaMotorizado ?? "", observaciones: r.observaciones ?? "" }); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar finca" : "Nueva finca"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          <Field label="Finca"><Input value={form.finca} onChange={(e) => setForm({ ...form, finca: e.target.value })} disabled={!!edit} /></Field>
          <Field label="Desmane %"><Input value={form.desmane} onChange={(e) => setForm({ ...form, desmane: e.target.value })} /></Field>
          <Field label="Paneo %"><Input value={form.paneo} onChange={(e) => setForm({ ...form, paneo: e.target.value })} /></Field>
          <Field label="Zona / Motorizado"><Input value={form.zonaMotorizado} onChange={(e) => setForm({ ...form, zonaMotorizado: e.target.value })} /></Field>
          <Field label="Observaciones" className="md:col-span-2"><Input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
