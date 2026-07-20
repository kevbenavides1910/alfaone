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


type Apertura = { id: string; finca: string; cuentaNum: number; nombreCuenta: string };

export function AperturasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Apertura[] }>({
    queryKey: ["monitoreo-aperturas"],
    queryFn: () => fetch("/api/monitoreo/apertura-cuentas").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Apertura | null>(null);
  const [form, setForm] = useState({ finca: "", cuentaNum: "", nombreCuenta: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = { finca: form.finca, cuentaNum: Number(form.cuentaNum), nombreCuenta: form.nombreCuenta };
      const url = edit ? `/api/monitoreo/apertura-cuentas/${edit.id}` : "/api/monitoreo/apertura-cuentas";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["monitoreo-aperturas"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/monitoreo/apertura-cuentas/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["monitoreo-aperturas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} cuentas`} onAdd={() => { setEdit(null); setForm({ finca: "", cuentaNum: "", nombreCuenta: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Finca", "# Cuenta", "Nombre cuenta", ""]}
          rows={rows.map((r) => [r.finca, r.cuentaNum, r.nombreCuenta, <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ finca: r.finca, cuentaNum: String(r.cuentaNum), nombreCuenta: r.nombreCuenta }); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar cuenta" : "Nueva cuenta"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          <Field label="Finca"><Input value={form.finca} onChange={(e) => setForm({ ...form, finca: e.target.value })} /></Field>
          <Field label="# Cuenta (código)"><Input type="number" value={form.cuentaNum} onChange={(e) => setForm({ ...form, cuentaNum: e.target.value })} /></Field>
          <Field label="Nombre cuenta" className="md:col-span-2"><Input value={form.nombreCuenta} onChange={(e) => setForm({ ...form, nombreCuenta: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}
