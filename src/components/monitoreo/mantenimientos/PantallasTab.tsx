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


type AlarmCode = { id: string; alarmNumber: number; finca: string; zona: string; motorizado: string; bodycam: string | null; isActive: boolean };
type Pantalla = { id: string; alarmCodeId: string; finca: string; zona: string; pantalla: number | null; camara: number | null; zonaExterna: string | null; pantalla2: number | null; camara2: number | null; alarmCode?: AlarmCode };

export function PantallasTab() {
  const qc = useQueryClient();
  const { data: codes } = useQuery<{ data: AlarmCode[] }>({
    queryKey: ["monitoreo-alarm-codes"],
    queryFn: () => fetch("/api/monitoreo/alarm-codes").then((r) => parseJson(r)),
  });
  const { data, isLoading } = useQuery<{ data: Pantalla[] }>({
    queryKey: ["monitoreo-pantallas"],
    queryFn: () => fetch("/api/monitoreo/pantallas").then((r) => parseJson(r)),
  });

  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Pantalla | null>(null);
  const [form, setForm] = useState({ alarmCodeId: "", finca: "", zona: "", pantalla: "", camara: "", zonaExterna: "", pantalla2: "", camara2: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        alarmCodeId: form.alarmCodeId,
        finca: form.finca,
        zona: form.zona,
        pantalla: form.pantalla ? Number(form.pantalla) : null,
        camara: form.camara ? Number(form.camara) : null,
        zonaExterna: form.zonaExterna || null,
        pantalla2: form.pantalla2 ? Number(form.pantalla2) : null,
        camara2: form.camara2 ? Number(form.camara2) : null,
      };
      const url = edit ? `/api/monitoreo/pantallas/${edit.id}` : "/api/monitoreo/pantallas";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["monitoreo-pantallas"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/monitoreo/pantallas/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["monitoreo-pantallas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const codeOptions = codes?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} pantallas`} onAdd={() => { setEdit(null); setForm({ alarmCodeId: "", finca: "", zona: "", pantalla: "", camara: "", zonaExterna: "", pantalla2: "", camara2: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          tableId="monitoreo-pantallas"
          headers={["Código", "Finca", "Zona", "Pant.", "Cam.", "Zona ext.", "2ª Pant.", "2ª Cam.", ""]}
          rows={rows.map((r) => [
            r.alarmCode?.alarmNumber ?? "—",
            r.finca,
            r.zona,
            r.pantalla ?? "—",
            r.camara ?? "—",
            r.zonaExterna ?? "—",
            r.pantalla2 ?? "—",
            r.camara2 ?? "—",
            <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ alarmCodeId: "", finca: r.finca, zona: r.zona, pantalla: String(r.pantalla ?? ""), camara: String(r.camara ?? ""), zonaExterna: r.zonaExterna ?? "", pantalla2: String(r.pantalla2 ?? ""), camara2: String(r.camara2 ?? "") }); setShow(true); }} onDelete={() => del.mutate(r.id)} />,
          ])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar pantalla" : "Nueva pantalla"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          {!edit && (
            <Field label="Código de alarma">
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.alarmCodeId} onChange={(e) => {
                const c = codeOptions.find((x) => x.id === e.target.value);
                setForm({ ...form, alarmCodeId: e.target.value, finca: c?.finca ?? "", zona: c?.zona ?? "" });
              }}>
                <option value="">Seleccionar...</option>
                {codeOptions.filter((c) => !rows.some((p) => p.alarmCode?.alarmNumber === c.alarmNumber) || edit).map((c) => (
                  <option key={c.id} value={c.id}>{c.alarmNumber} — {c.finca} / {c.zona}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Pantalla"><Input type="number" value={form.pantalla} onChange={(e) => setForm({ ...form, pantalla: e.target.value })} /></Field>
          <Field label="Cámara"><Input type="number" value={form.camara} onChange={(e) => setForm({ ...form, camara: e.target.value })} /></Field>
          <Field label="Zona externa"><Input value={form.zonaExterna} onChange={(e) => setForm({ ...form, zonaExterna: e.target.value })} /></Field>
          <Field label="2ª Pantalla"><Input type="number" value={form.pantalla2} onChange={(e) => setForm({ ...form, pantalla2: e.target.value })} /></Field>
          <Field label="2ª Cámara"><Input type="number" value={form.camara2} onChange={(e) => setForm({ ...form, camara2: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Puestos ───────────────────────────────────────────────────────────────────

type Puesto = { id: string; name: string; isActive: boolean; sortOrder: number };

