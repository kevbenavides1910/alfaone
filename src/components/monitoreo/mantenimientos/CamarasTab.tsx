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


type Camara = { id: string; pantallaNum: number; camaraNum: number; descripcion: string };

export function CamarasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Camara[] }>({
    queryKey: ["monitoreo-camaras"],
    queryFn: () => fetch("/api/monitoreo/camaras").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Camara | null>(null);
  const [form, setForm] = useState({ pantallaNum: "", camaraNum: "", descripcion: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = { pantallaNum: Number(form.pantallaNum), camaraNum: Number(form.camaraNum), descripcion: form.descripcion };
      const url = edit ? `/api/monitoreo/camaras/${edit.id}` : "/api/monitoreo/camaras";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["monitoreo-camaras"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/monitoreo/camaras/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["monitoreo-camaras"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} cámaras`} onAdd={() => { setEdit(null); setForm({ pantallaNum: "", camaraNum: "", descripcion: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          tableId="monitoreo-camaras"
          headers={["Pantalla #", "Cámara #", "Descripción", ""]}
          rows={rows.map((r) => [r.pantallaNum, r.camaraNum, r.descripcion, <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ pantallaNum: String(r.pantallaNum), camaraNum: String(r.camaraNum), descripcion: r.descripcion }); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar cámara" : "Nueva cámara"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          <Field label="Pantalla #"><Input type="number" value={form.pantallaNum} onChange={(e) => setForm({ ...form, pantallaNum: e.target.value })} disabled={!!edit} /></Field>
          <Field label="Cámara #"><Input type="number" value={form.camaraNum} onChange={(e) => setForm({ ...form, camaraNum: e.target.value })} disabled={!!edit} /></Field>
          <Field label="Descripción" className="md:col-span-2"><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Aperturas ─────────────────────────────────────────────────────────────────

type Apertura = { id: string; finca: string; cuentaNum: number; nombreCuenta: string };

