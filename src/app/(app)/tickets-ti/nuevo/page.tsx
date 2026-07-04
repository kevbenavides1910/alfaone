"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import {
  TicketAttachmentPicker,
  uploadTicketFiles,
} from "@/components/tickets-ti/TicketAttachmentPicker";
import { TICKETS_ATTACHMENT_CONFIG } from "@/modules/tickets-ti/config/tickets.config.client";
import { ticketsTiBackPath } from "@/modules/tickets-ti/routes";
import { TICKET_CATEGORY_OTRO_CODE } from "@/modules/tickets-ti/business/category-codes";
import { useSession } from "next-auth/react";

type Catalogs = {
  categories: { code: string; name: string }[];
  priorities: { code: string; name: string }[];
  types: { code: string; name: string }[];
  technicians: { id: string; name: string; email: string }[];
};

export default function NuevoTicketPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const backHref = ticketsTiBackPath(session);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryDetail, setCategoryDetail] = useState("");
  const [priorityCode, setPriorityCode] = useState("MEDIA");
  const [typeCode, setTypeCode] = useState("SOLICITUD");
  const [technicianId, setTechnicianId] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const { data, isLoading } = useQuery<{ data: Catalogs }>({
    queryKey: ["tickets-ti-catalogs-create"],
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/catalogs?for=create");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const catalogs = data?.data;

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/tickets-ti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryCode,
          categoryDetail: categoryCode === TICKET_CATEGORY_OTRO_CODE ? categoryDetail : undefined,
          priorityCode,
          typeCode,
          technicianId: technicianId || undefined,
        }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      const row = json.data as { id: string; ticketNumber: string };
      if (files.length > 0) {
        await uploadTicketFiles(row.id, files);
      }
      return row;
    },
    onSuccess: (row) => {
      toast.success(`Ticket ${row.ticketNumber} creado`);
      router.push(`/tickets-ti/${row.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requiresCategoryDetail = categoryCode === TICKET_CATEGORY_OTRO_CODE;
  const canSubmit =
    title.trim() &&
    description.trim() &&
    categoryCode &&
    (!requiresCategoryDetail || categoryDetail.trim());

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2">
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-500">Cargando catálogos…</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="title">Título</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descripción</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[120px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Categoría</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                    value={categoryCode}
                    onChange={(e) => {
                      setCategoryCode(e.target.value);
                      if (e.target.value !== TICKET_CATEGORY_OTRO_CODE) setCategoryDetail("");
                    }}
                  >
                    <option value="">Seleccione…</option>
                    {catalogs?.categories.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  {requiresCategoryDetail && (
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="categoryDetail">
                        Detalle <span className="text-red-600">*</span>
                      </Label>
                      <Input
                        id="categoryDetail"
                        value={categoryDetail}
                        onChange={(e) => setCategoryDetail(e.target.value)}
                        maxLength={500}
                        placeholder="Indique el motivo o tipo de solicitud"
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridad</Label>
                  <select className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm" value={priorityCode} onChange={(e) => setPriorityCode(e.target.value)}>
                    {catalogs?.priorities.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm" value={typeCode} onChange={(e) => setTypeCode(e.target.value)}>
                    {catalogs?.types.map((t) => (
                      <option key={t.code} value={t.code}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Técnico</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                  >
                    <option value="">Sin preferencia / asignar después</option>
                    {catalogs?.technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <TicketAttachmentPicker
                files={files}
                onChange={setFiles}
                maxFiles={TICKETS_ATTACHMENT_CONFIG.maxFilesPerTicket}
                disabled={createMut.isPending}
              />

              <Button
                className="gap-2"
                disabled={createMut.isPending || !canSubmit}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Crear ticket
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
