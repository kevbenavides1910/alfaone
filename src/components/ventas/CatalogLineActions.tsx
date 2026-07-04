"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogSection } from "@/modules/ventas";

export type NewFieldDef = {
  key: string;
  label: string;
  type?: "text" | "number";
  placeholder?: string;
};

type CatalogAddRowProps = {
  section: CatalogSection;
  fields: NewFieldDef[];
  canEdit?: boolean;
  allowAdd?: boolean;
  onAdd: (item: Record<string, string | number>) => Promise<void>;
};

export function CatalogAddRow({ fields, canEdit, allowAdd = true, onAdd }: CatalogAddRowProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""]))
  );
  const [saving, setSaving] = useState(false);

  if (!canEdit || !allowAdd) return null;

  async function submit() {
    const item: Record<string, string | number> = {};
    for (const f of fields) {
      const raw = draft[f.key]?.trim() ?? "";
      if (!raw && !["grupo", "tipo", "categoria"].includes(f.key)) return;
      item[f.key] = f.type === "number" ? Number(raw) || 0 : raw || f.placeholder || "";
    }
    if (fields.some((f) => f.key === "nombre" || f.key === "descripcion") && !item.nombre && !item.descripcion) {
      return;
    }
    setSaving(true);
    try {
      await onAdd(item);
      setDraft(Object.fromEntries(fields.map((f) => [f.key, ""])));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="pt-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar línea
        </Button>
      </div>
    );
  }

  return (
    <div className="pt-3 flex flex-wrap items-end gap-2 border-t mt-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1 min-w-[120px]">
          <label className="text-xs text-muted-foreground">{f.label}</label>
          <Input
            type={f.type === "number" ? "number" : "text"}
            placeholder={f.placeholder}
            value={draft[f.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
      ))}
      <Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>
        {saving ? "Guardando…" : "Guardar línea"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}

type CatalogDeleteButtonProps = {
  canEdit?: boolean;
  allowDelete?: boolean;
  onDelete: () => Promise<void>;
};

export function CatalogDeleteButton({ canEdit, allowDelete = true, onDelete }: CatalogDeleteButtonProps) {
  const [busy, setBusy] = useState(false);
  if (!canEdit || !allowDelete) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onDelete().finally(() => setBusy(false));
      }}
      aria-label="Eliminar línea"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

export function catalogRowFlags(
  section: CatalogSection,
  codigo: string,
  meta: Record<CatalogSection, { modificados: string[]; agregados: string[]; excluidos: string[] }>
) {
  const m = meta[section];
  return {
    modified: m.modificados.includes(codigo),
    added: m.agregados.includes(codigo),
  };
}

export const CATALOG_ADD_FIELDS: Partial<Record<CatalogSection, NewFieldDef[]>> = {
  salarios: [
    { key: "descripcion", label: "Descripción", type: "text" },
    { key: "valor", label: "Salario año base", type: "number" },
  ],
  cargasSociales: [
    { key: "nombre", label: "Concepto", type: "text" },
    { key: "grupo", label: "Grupo", type: "text", placeholder: "OTROS" },
    { key: "porcentaje", label: "%", type: "number" },
  ],
  pagosExtras: [
    { key: "nombre", label: "Concepto", type: "text" },
    { key: "tipo", label: "Tipo", type: "text", placeholder: "MONTO" },
    { key: "valor", label: "Valor", type: "number" },
  ],
  insumos: [
    { key: "nombre", label: "Ítem", type: "text" },
    { key: "categoria", label: "Categoría", type: "text", placeholder: "GENERAL" },
    { key: "costoUnitario", label: "Costo", type: "number" },
  ],
  gastosAdmin: [
    { key: "nombre", label: "Concepto", type: "text" },
    { key: "montoMensual", label: "Monto/mes", type: "number" },
  ],
  indices: [
    { key: "nombre", label: "Nombre", type: "text" },
    { key: "valor", label: "Valor", type: "number" },
  ],
};

export const CATALOG_ALLOW_ADD: Partial<Record<CatalogSection, boolean>> = {
  salarios: true,
  jornadas: false,
  cargasSociales: true,
  pagosExtras: true,
  insumos: true,
  gastosAdmin: true,
  indices: true,
};
