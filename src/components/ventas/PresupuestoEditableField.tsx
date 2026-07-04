"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type Props = {
  label: string;
  value: string | number;
  modified?: boolean;
  canEdit?: boolean;
  type?: "text" | "number";
  step?: string;
  onSave: (value: string | number) => Promise<void>;
};

export function PresupuestoEditableField({
  label,
  value,
  modified,
  canEdit,
  type = "text",
  step,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const next = type === "number" ? Number(draft) : draft;
    if (next === value || (type === "number" && Number.isNaN(next))) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        modified && "border-amber-400/70 bg-amber-50/80 dark:bg-amber-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {modified && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Modificado
          </span>
        )}
      </div>
      {editing && canEdit ? (
        <div className="mt-1 flex gap-2">
          <Input
            type={type}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void commit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button
            type="button"
            className="text-xs text-primary font-medium shrink-0"
            disabled={saving}
            onClick={() => void commit()}
          >
            {saving ? "…" : "Guardar"}
          </button>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-medium">{value}</p>
          {canEdit && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => {
                setDraft(String(value));
                setEditing(true);
              }}
              aria-label={`Editar ${label}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type CellProps = {
  value: string | number;
  modified?: boolean;
  added?: boolean;
  canEdit?: boolean;
  align?: "left" | "right";
  onSave: (value: number) => Promise<void>;
};

export function PresupuestoEditableCell({ value, modified, added, canEdit, align = "right", onSave }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const next = Number(draft);
    if (Number.isNaN(next) || next === Number(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing && canEdit) {
    return (
      <td className={cn("px-2 py-1", align === "right" && "text-right")}>
        <Input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-7 text-sm w-28 ml-auto"
          autoFocus
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") setEditing(false);
          }}
          disabled={saving}
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        "px-2 py-1",
        align === "right" && "text-right",
        added && "bg-emerald-50/90 dark:bg-emerald-950/25 ring-1 ring-inset ring-emerald-400/60",
        !added && modified && "bg-amber-50/90 dark:bg-amber-950/25 ring-1 ring-inset ring-amber-300/60",
        canEdit && "cursor-pointer"
      )}
      title={
        added
          ? "Línea agregada en este presupuesto"
          : modified
            ? "Valor modificado respecto a la parametrización general"
            : undefined
      }
      onClick={() => {
        if (!canEdit) return;
        setDraft(String(value));
        setEditing(true);
      }}
    >
      {value}
    </td>
  );
}
