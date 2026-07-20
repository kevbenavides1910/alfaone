"use client";

import { useState } from "react";
import { X } from "lucide-react";

export type FieldType = "string" | "number" | "date" | "boolean";
export interface ExtraField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
}
export interface AssetType {
  id: string;
  code: string;
  name: string;
  fields: ExtraField[];
  isActive: boolean;
  sortOrder: number;
}
export interface AssetPosition {
  id: string;
  name: string;
  phoneLine?: string | null;
  location: {
    id: string;
    name: string;
    contract: { id: string; licitacionNo: string; client: string };
    zone?: { id: string; name: string } | null;
  };
}
export interface AssetRow {
  id: string;
  typeId: string;
  code: string;
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  attributes: Record<string, unknown>;
  status: "IN_STOCK" | "ASSIGNED" | "PENDING_RETURN" | "RETIRED";
  currentPosition?: AssetPosition | null;
  acquisitionExpense?: { id: string; description: string; referenceNumber: string | null } | null;
  acquisitionDate?: string | null;
  notes?: string | null;
  type: AssetType;
  createdAt: string;
  updatedAt: string;
}
export interface MovementRow {
  id: string;
  assetId: string;
  type: "INTAKE" | "ISSUE" | "ASSIGN" | "RETURN";
  intakeReason?: string | null;
  issueReason?: string | null;
  notes?: string | null;
  createdAt: string;
  asset: { id: string; code: string; name: string | null; type: { name: string; code: string } };
  fromPosition?: AssetPosition | null;
  toPosition?: AssetPosition | null;
  expense?: { id: string; description: string; referenceNumber: string | null } | null;
}

export const STATUS_LABEL: Record<AssetRow["status"], string> = {
  IN_STOCK: "En stock",
  ASSIGNED: "Asignado",
  PENDING_RETURN: "Pendiente de devolución",
  RETIRED: "Baja",
};
export const STATUS_VARIANT: Record<AssetRow["status"], "success" | "warning" | "secondary" | "danger"> = {
  IN_STOCK: "success",
  ASSIGNED: "warning",
  PENDING_RETURN: "danger",
  RETIRED: "secondary",
};
export const MOVEMENT_LABEL: Record<MovementRow["type"], string> = {
  INTAKE: "Ingreso",
  ISSUE: "Baja",
  ASSIGN: "Asignación",
  RETURN: "Devolución",
};
export const MOVEMENT_BADGE: Record<MovementRow["type"], string> = {
  INTAKE: "bg-emerald-100 text-emerald-800",
  ISSUE: "bg-red-100 text-red-700",
  ASSIGN: "bg-slate-100 text-slate-700",
  RETURN: "bg-amber-100 text-amber-800",
};
export const INTAKE_REASON: Record<string, string> = {
  PURCHASE: "Compra",
  RETURN: "Devolución",
  INITIAL: "Inicial",
  OTHER: "Otro",
};
export const ISSUE_REASON: Record<string, string> = {
  LOST: "Pérdida",
  DAMAGED: "Dañado",
  DISPOSED: "Desechado",
  OTHER: "Otro",
};

export function describePosition(p?: AssetPosition | null) {
  if (!p) return "—";
  return `${p.location.contract.licitacionNo} · ${p.location.name} › ${p.name}`;
}

export function zoneName(p?: AssetPosition | null): string | null {
  return p?.location?.zone?.name ?? null;
}

export function matchesFilter(value: string | null | undefined, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  return (value ?? "").toString().toLowerCase().includes(f);
}

/** Input pequeño para colocar en una fila de filtros bajo el header de una tabla. */
export function ColumnFilterInput({
  value,
  onChange,
  placeholder = "Filtrar…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-7 text-xs border border-slate-200 rounded px-2 pr-6 bg-card focus:outline-none focus:border-red-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          title="Limpiar"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function ensureAttrs(a: unknown): Record<string, unknown> {
  if (a && typeof a === "object" && !Array.isArray(a)) return a as Record<string, unknown>;
  return {};
}

export function renderAttributes(asset: AssetRow): string {
  const fields = Array.isArray(asset.type.fields) ? asset.type.fields : [];
  const attrs = ensureAttrs(asset.attributes);
  const parts = fields
    .map((f) => {
      const v = attrs[f.key];
      if (v === undefined || v === null || v === "") return null;
      return `${f.label}: ${v}`;
    })
    .filter(Boolean) as string[];
  return parts.join(" · ");
}

