"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCompanies } from "@/lib/hooks/use-companies";

export default function SigNuevoDocumentoPage() {
  const router = useRouter();
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.data ?? [];

  const { data: typesData } = useQuery({
    queryKey: ["sig-tipos"],
    queryFn: async () => {
      const r = await fetch("/api/sig/tipos-documento", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar tipos");
      return r.json() as Promise<{ data: { id: string; code: string; name: string }[] }>;
    },
  });

  const { data: processesData } = useQuery({
    queryKey: ["sig-procesos"],
    queryFn: async () => {
      const r = await fetch("/api/sig/procesos", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar procesos");
      return r.json() as Promise<{ data: { id: string; code: string; name: string }[] }>;
    },
  });

  const { data: approversData } = useQuery({
    queryKey: ["sig-aprobadores"],
    queryFn: async () => {
      const r = await fetch("/api/sig/aprobadores", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar aprobadores");
      return r.json() as Promise<{ data: { id: string; name: string; email: string }[] }>;
    },
  });

  const types = typesData?.data ?? [];
  const processes = processesData?.data ?? [];
  const approvers = approversData?.data ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    code: "",
    title: "",
    documentTypeId: "",
    processId: "",
    company: "",
    versionLabel: "1",
    revisionDate: today,
    effectiveFrom: today,
    effectiveUntil: "",
    revisionIntervalDays: "365",
    changeSummary: "",
    assignedApproverId: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Seleccione un archivo");
      if (!form.assignedApproverId) throw new Error("Seleccione el aprobador");
      const fd = new FormData();
      fd.append("file", file);
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      const r = await fetch("/api/sig/documents", { method: "POST", body: fd, credentials: "same-origin" });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al subir");
      return json.data as { id: string };
    },
    onSuccess: (data) => {
      router.push(`/sig/documentos/${data.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <>
      <Topbar title="SIG — Nuevo documento" />
      <div className="p-4 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Código del documento *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="F-RH-30"
                />
              </div>
              <div>
                <Label>Versión inicial</Label>
                <Input
                  value={form.versionLabel}
                  onChange={(e) => setForm((f) => ({ ...f, versionLabel: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tipo documental *</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.documentTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, documentTypeId: e.target.value }))}
                >
                  <option value="">Seleccionar…</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Proceso</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={form.processId}
                  onChange={(e) => setForm((f) => ({ ...f, processId: e.target.value }))}
                >
                  <option value="">Sin proceso</option>
                  {processes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Fecha de revisión *</Label>
                <Input
                  type="date"
                  value={form.revisionDate}
                  onChange={(e) => setForm((f) => ({ ...f, revisionDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Vigencia desde *</Label>
                <Input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
              </div>
              <div>
                <Label>Vigencia hasta</Label>
                <Input
                  type="date"
                  value={form.effectiveUntil}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveUntil: e.target.value }))}
                />
              </div>
              <div>
                <Label>Intervalo revisión (días)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.revisionIntervalDays}
                  onChange={(e) => setForm((f) => ({ ...f, revisionIntervalDays: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Empresa</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              >
                <option value="">Todas / corporativo</option>
                {companies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Enviar aprobación a *</Label>
              <select
                className="w-full h-10 rounded-md border px-3 text-sm"
                value={form.assignedApproverId}
                onChange={(e) => setForm((f) => ({ ...f, assignedApproverId: e.target.value }))}
              >
                <option value="">Seleccionar aprobador…</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Solo el usuario seleccionado verá esta solicitud en Aprobaciones pendientes.
              </p>
            </div>

            <div>
              <Label>Resumen de cambios</Label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-20"
                value={form.changeSummary}
                onChange={(e) => setForm((f) => ({ ...f, changeSummary: e.target.value }))}
                rows={3}
              />
            </div>

            <div>
              <Label>Archivo * (PDF, Word, Excel, imágenes — máx. 50 MB)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.txt,.csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              disabled={
                uploadMutation.isPending ||
                !form.code ||
                !form.title ||
                !form.documentTypeId ||
                !form.assignedApproverId
              }
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending ? "Subiendo…" : "Subir y enviar a aprobación"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
