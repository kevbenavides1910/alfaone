"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, UserCircle, Pencil, Trash2, FileSpreadsheet, Loader2, Phone, Mail } from "lucide-react";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { formatBillingPeriodRange } from "@/lib/utils/format";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  clientContactSchema,
  type ClientContactInput,
} from "@/modules/presupuestos/validations/contract.schema";

interface ClientContact {
  id: string;
  name: string;
  jobTitle?: string | null;
  isBillingContact: boolean;
  isContractAdmin: boolean;
  phone: string;
  phone2?: string | null;
  email: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  contractId: string;
  readOnly?: boolean;
  ivaPct?: number;
  billingDay?: number;
  billingPeriodFromDay?: number;
  billingPeriodToDay?: number;
}

const emptyForm: ClientContactInput = {
  name: "",
  jobTitle: "",
  isBillingContact: false,
  isContractAdmin: false,
  phone: "",
  phone2: "",
  email: "",
};

export function ClientContactsTab({
  contractId,
  readOnly,
  ivaPct,
  billingDay,
  billingPeriodFromDay,
  billingPeriodToDay,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientContact | null>(null);

  const { data, isLoading } = useQuery<{ data: ClientContact[] }>({
    queryKey: ["client-contacts", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/client-contacts`).then((r) => r.json()),
  });

  const contacts = data?.data ?? [];

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientContactInput>({
    resolver: zodResolver(clientContactSchema),
    defaultValues: emptyForm,
  });

  function openCreate() {
    setEditing(null);
    reset(emptyForm);
    setOpen(true);
  }

  function openEdit(row: ClientContact) {
    setEditing(row);
    reset({
      name: row.name,
      jobTitle: row.jobTitle ?? "",
      isBillingContact: row.isBillingContact,
      isContractAdmin: row.isContractAdmin,
      phone: row.phone,
      phone2: row.phone2 ?? "",
      email: row.email,
    });
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditing(null);
    reset(emptyForm);
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: ClientContactInput) => {
      const url = editing
        ? `/api/contracts/${contractId}/client-contacts/${editing.id}`
        : `/api/contracts/${contractId}/client-contacts`;
      const r = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          phone2: payload.phone2?.trim() || undefined,
          jobTitle: payload.jobTitle?.trim() || undefined,
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al guardar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-contacts", contractId] });
      toast.success(editing ? "Contacto actualizado" : "Contacto agregado");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/contracts/${contractId}/client-contacts/${id}`, { method: "DELETE" });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al eliminar");
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-contacts", contractId] });
      toast.success("Contacto eliminado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Cargando contactos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-800">Contacto del cliente</h3>
          <p className="text-sm text-slate-500">
            Personas de contacto del cliente para facturación y administración del contrato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={contacts.length === 0}
            onClick={() => {
              exportRowsToExcel({
                filename: `contactos_cliente_contrato_${contractId}`,
                sheetName: "Contactos",
                rows: contacts.map((c) => ({
                  Nombre: c.name,
                  Puesto: c.jobTitle ?? "",
                  "Contacto facturación": c.isBillingContact ? "Sí" : "No",
                  "Administrador contrato": c.isContractAdmin ? "Sí" : "No",
                  Teléfono: c.phone,
                  "Teléfono 2": c.phone2 ?? "",
                  "Correo electrónico": c.email,
                })),
                columnWidths: [24, 20, 18, 22, 16, 16, 28],
              });
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar a Excel ({contacts.length})
          </Button>
          {!readOnly && (
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Agregar contacto
            </Button>
          )}
        </div>
      </div>

      {(ivaPct != null ||
        billingDay != null ||
        billingPeriodFromDay != null ||
        billingPeriodToDay != null) && (
        <Card className="rounded-none border-[#e0e0e0] shadow-none">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#525252] mb-3">
              Datos de facturación del contrato
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
              {ivaPct != null && (
                <div className="flex justify-between gap-4 border-b border-[#e0e0e0] pb-2 sm:border-b-0 sm:pb-0">
                  <span className="text-[#525252]">% IVA</span>
                  <span className="font-medium text-[#161616]">{Number(ivaPct)}%</span>
                </div>
              )}
              {billingDay != null && (
                <div className="flex justify-between gap-4 border-b border-[#e0e0e0] pb-2 sm:border-b-0 sm:pb-0">
                  <span className="text-[#525252]">Día de facturación</span>
                  <span className="font-medium text-[#161616]">Día {billingDay} de cada mes</span>
                </div>
              )}
              {(billingPeriodFromDay != null || billingPeriodToDay != null) && (
                <div className="flex justify-between gap-4 sm:col-span-2">
                  <span className="text-[#525252]">Periodo que se factura</span>
                  <span className="font-medium text-[#161616] text-right">
                    {formatBillingPeriodRange(billingPeriodFromDay, billingPeriodToDay)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-400">
            <UserCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No hay contactos del cliente registrados
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      {c.isBillingContact && (
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Facturación</Badge>
                      )}
                      {c.isContractAdmin && (
                        <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700">Admin. contrato</Badge>
                      )}
                    </div>
                    {c.jobTitle && (
                      <p className="text-sm text-slate-500 mt-0.5">{c.jobTitle}</p>
                    )}
                    <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {c.phone}
                        {c.phone2 && <span className="text-slate-400">· {c.phone2}</span>}
                      </p>
                      <p className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <a href={`mailto:${c.email}`} className="text-blue-600 hover:underline truncate">{c.email}</a>
                      </p>
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm("¿Eliminar este contacto?")) deleteMutation.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contacto" : "Agregar contacto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" {...register("name")} placeholder="Nombre completo" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="jobTitle">Puesto</Label>
              <Input id="jobTitle" {...register("jobTitle")} placeholder="Ej: Gerente administrativo" />
            </div>
            <div className="space-y-2">
              <Label>Rol del contacto</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded border-input" {...register("isBillingContact")} />
                Contacto para facturación
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded border-input" {...register("isContractAdmin")} />
                Administrador de contrato
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">Teléfono *</Label>
                <Input id="phone" {...register("phone")} placeholder="8888-8888" />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone2">Teléfono 2 (opcional)</Label>
                <Input id="phone2" {...register("phone2")} placeholder="2222-2222" />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input id="email" type="email" {...register("email")} placeholder="contacto@cliente.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
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
