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


type Puesto = { id: string; name: string; isActive: boolean; sortOrder: number };

export function PuestosTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Puesto[] }>({
    queryKey: ["monitoreo-puestos"],
    queryFn: () => fetch("/api/monitoreo/puestos").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Puesto | null>(null);
  const [name, setName] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const url = edit ? `/api/monitoreo/puestos/${edit.id}` : "/api/monitoreo/puestos";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, isActive: true, sortOrder: edit?.sortOrder ?? 0 }) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["monitoreo-puestos"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/monitoreo/puestos/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["monitoreo-puestos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} puestos`} onAdd={() => { setEdit(null); setName(""); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          tableId="monitoreo-puestos"
          headers={["Puesto / Motorizado", ""]}
          rows={rows.map((r) => [r.name, <ActionButtons key={r.id} onEdit={() => { setEdit(r); setName(r.name); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar puesto" : "Nuevo puesto"} saving={save.isPending} onSave={() => save.mutate()}>
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Cámaras ───────────────────────────────────────────────────────────────────

type Camara = { id: string; pantallaNum: number; camaraNum: number; descripcion: string };

