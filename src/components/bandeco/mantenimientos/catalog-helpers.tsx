"use client";

/**
 * Componentes de UI compartidos por los tabs de mantenimiento Bandeco.
 * Shell, loading, botones de acción, diálogo de formulario y primitivas de layout.
 */
import React from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ── CatalogShell ───────────────────────────────────────────────────────────────

export function CatalogShell({
  title,
  onAdd,
  search,
  onSearch,
  searchPlaceholder = "Buscar...",
  children,
}: {
  title?: string;
  onAdd?: () => void;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title && <span className="text-sm text-slate-500">{title}</span>}
        <div className="flex items-center gap-2 ml-auto">
          {onSearch !== undefined && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search ?? ""}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 text-sm w-48"
              />
            </div>
          )}
          {onAdd && (
            <Button size="sm" onClick={onAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nuevo
            </Button>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
      </Card>
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────────

export function Loading() {
  return (
    <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>
  );
}

// ── ActionButtons ──────────────────────────────────────────────────────────────

export function ActionButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Editar">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onDelete}
        title="Eliminar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── FormDialog ────────────────────────────────────────────────────────────────

export function FormDialog({
  open,
  onOpenChange,
  title,
  saving,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  saving?: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── FormGrid ──────────────────────────────────────────────────────────────────

export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

// ── Field ─────────────────────────────────────────────────────────────────────

export function Field({
  label,
  disabled,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ""}`}>
      <label className={`text-sm font-medium ${disabled ? "text-slate-400" : ""}`}>{label}</label>
      {children}
    </div>
  );
}
