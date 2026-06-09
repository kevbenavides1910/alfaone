"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ClipboardList, Pencil, Trash2, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  billingRequirementSchema,
  type BillingRequirementInput,
} from "@/modules/presupuestos/validations/contract.schema";
import { formatDate } from "@/lib/utils/format";

interface Requirement {
  id: string;
  description: string;
  notes?: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  contractId: string;
  readOnly?: boolean;
}

export function BillingRequirementsTab({ contractId, readOnly }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Requirement | null>(null);

  const { data, isLoading } = useQuery<{ data: Requirement[] }>({
    queryKey: ["billing-requirements", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/billing-requirements`).then((r) => r.json()),
  });

  const requirements = data?.data ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BillingRequirementInput>({
    resolver: zodResolver(billingRequirementSchema),
    defaultValues: { description: "", notes: "" },
  });

  function openCreate() {
    setEditing(null);
    reset({ description: "", notes: "" });
    setOpen(true);
  }

  function openEdit(row: Requirement) {
    setEditing(row);
    reset({ description: row.description, notes: row.notes ?? "" });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditing(null);
    reset({ description: "", notes: "" });
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: BillingRequirementInput) => {
      const url = editing
        ? `/api/contracts/${contractId}/billing-requirements/${editing.id}`
        : `/api/contracts/${contractId}/billing-requirements`;
      const r = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-requirements", contractId] });
      toast.success(editing ? "Requisito actualizado" : "Requisito agregado");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/contracts/${contractId}/billing-requirements/${id}`, {
        method: "DELETE",
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al eliminar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-requirements", contractId] });
      toast.success("Requisito eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Cargando requisitos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-800">Requisitos de facturación</h3>
          <p className="text-sm text-slate-500">
            Documentos, aprobaciones u otros requisitos necesarios para facturar este contrato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={requirements.length === 0}
            onClick={() => {
              exportRowsToExcel({
                filename: `requisitos_facturacion_contrato_${contractId}`,
                sheetName: "Requisitos",
                rows: requirements.map((r, i) => ({
                  "#": i + 1,
                  Requisito: r.description,
                  Notas: r.notes ?? "",
                  "Registrado": formatDate(r.createdAt),
                })),
                columnWidths: [6, 40, 40, 16],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar a Excel ({requirements.length})
          </Button>
          {!readOnly && (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Agregar requisito
            </Button>
          )}
        </div>
      </div>

      {requirements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-400">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No hay requisitos de facturación registrados
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requirements.map((row, index) => (
            <Card key={row.id}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{row.description}</p>
                    {row.notes && (
                      <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{row.notes}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      Registrado: {formatDate(row.createdAt)}
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm("¿Eliminar este requisito de facturación?")) {
                          deleteMutation.mutate(row.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar requisito" : "Agregar requisito"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="description">Requisito *</Label>
              <Input
                id="description"
                placeholder="Ej. Orden de compra firmada, acta de recepción..."
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Detalles adicionales, plazos, contacto..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register("notes")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Guardar cambios" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
