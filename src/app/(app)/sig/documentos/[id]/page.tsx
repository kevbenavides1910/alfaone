"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, Pencil, Upload } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { formatDate } from "@/lib/utils/format";

const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  SUPERSEDED: "Anterior",
  OBSOLETE: "Obsoleto",
};

interface DocDetail {
  id: string;
  code: string;
  title: string;
  status: string;
  revisionIntervalDays: number | null;
  documentType: { id: string; name: string };
  process: { id: string; name: string } | null;
  currentVersion: {
    id: string;
    versionLabel: string;
    revisionDate: string;
    effectiveFrom: string;
    effectiveUntil: string | null;
    status: string;
    fileName: string;
    downloadUrl: string;
    approvedBy: { name: string } | null;
    approvedAt: string | null;
    assignedApprover: { id: string; name: string; email: string } | null;
  } | null;
  versions: {
    id: string;
    versionNumber: number;
    versionLabel: string;
    revisionDate: string;
    status: string;
    fileName: string;
    downloadUrl: string;
    uploadedBy: { name: string };
    approvedBy: { name: string } | null;
  }[];
}

export default function SigDocumentoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canUpload = hasPermission(session, "sig.documentos", "edit");
  const canSameVersion = hasPermission(session, "sig.documentos", "admin");
  const canEditMetadata =
    hasPermission(session, "sig.biblioteca", "edit") ||
    hasPermission(session, "sig.documentos", "edit");

  const { data: approversData } = useQuery({
    queryKey: ["sig-aprobadores"],
    queryFn: async () => {
      const r = await fetch("/api/sig/aprobadores", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar aprobadores");
      return r.json() as Promise<{ data: { id: string; name: string; email: string }[] }>;
    },
    enabled: canUpload,
  });

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

  const { data: companiesData } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const r = await fetch("/api/companies", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar empresas");
      return r.json() as Promise<{ data: { code: string; name: string }[] }>;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sig-document", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/documents/${id}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Documento no encontrado");
      return r.json() as Promise<{ data: DocDetail }>;
    },
  });

  const doc = data?.data;
  const approvers = approversData?.data ?? [];
  const types = typesData?.data ?? [];
  const processes = processesData?.data ?? [];
  const companies = companiesData?.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [metadataForm, setMetadataForm] = useState({
    title: "",
    documentTypeId: "",
    processId: "",
    company: "",
    revisionIntervalDays: "" as string | number,
  });
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [versionForm, setVersionForm] = useState({
    versionLabel: "",
    revisionDate: today,
    effectiveFrom: today,
    effectiveUntil: "",
    changeSummary: "",
    assignedApproverId: "",
  });
  const [sameVersionForm, setSameVersionForm] = useState({
    revisionDate: today,
    effectiveFrom: today,
    effectiveUntil: "",
    changeSummary: "",
  });
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [msg, setMsg] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sig-document", id] });
    queryClient.invalidateQueries({ queryKey: ["sig-documents"] });
  };

  useEffect(() => {
    if (doc) {
      setMetadataForm({
        title: doc.title,
        documentTypeId: doc.documentType?.id ?? "",
        processId: doc.process?.id ?? "",
        company: (doc as unknown as { company?: string | null }).company ?? "",
        revisionIntervalDays: doc.revisionIntervalDays ?? "",
      });
    }
  }, [doc]);

  const newVersionMutation = useMutation({
    mutationFn: async () => {
      if (!newVersionFile) throw new Error("Seleccione archivo");
      if (!versionForm.assignedApproverId) throw new Error("Seleccione el aprobador");
      const fd = new FormData();
      fd.append("file", newVersionFile);
      fd.append("mode", "new_version");
      Object.entries(versionForm).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      const r = await fetch(`/api/sig/documents/${id}/versions`, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error");
    },
    onSuccess: () => {
      setMsg("Nueva versión enviada a aprobación");
      invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const metadataMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/sig/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: metadataForm.title,
          documentTypeId: metadataForm.documentTypeId || undefined,
          processId: metadataForm.processId || undefined,
          company: metadataForm.company || undefined,
          revisionIntervalDays:
            typeof metadataForm.revisionIntervalDays === "number"
              ? metadataForm.revisionIntervalDays
              : metadataForm.revisionIntervalDays
                ? Number(metadataForm.revisionIntervalDays)
                : undefined,
        }),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error");
    },
    onSuccess: () => {
      setMsg("Metadatos actualizados");
      setIsEditingMetadata(false);
      invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const sameVersionMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("mode", "same_version");
      Object.entries(sameVersionForm).forEach(([k, v]) => fd.append(k, v));
      const r = await fetch(`/api/sig/documents/${id}/versions`, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error");
    },
    onSuccess: () => {
      setMsg("Vigencia actualizada sin cambiar versión");
      invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const versionId = doc?.currentVersion?.id;
      if (!versionId) throw new Error("Sin versión pendiente");
      const r = await fetch(`/api/sig/documents/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, notes: approveNotes }),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al aprobar");
    },
    onSuccess: () => {
      setMsg("Documento aprobado");
      invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const versionId = doc?.currentVersion?.id;
      if (!versionId) throw new Error("Sin versión pendiente");
      const r = await fetch(`/api/sig/documents/${id}/approve`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, rejectionNote: rejectNote }),
        credentials: "same-origin",
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al rechazar");
    },
    onSuccess: () => {
      setMsg("Versión rechazada");
      invalidate();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="SIG — Documento" />
        <p className="p-4 text-muted-foreground">Cargando…</p>
      </>
    );
  }

  if (!doc) {
    return (
      <>
        <Topbar title="SIG — Documento" />
        <p className="p-4 text-red-600">Documento no encontrado</p>
      </>
    );
  }

  const pending = doc.currentVersion?.status === "PENDING_APPROVAL";
  const isAssignedApprover =
    pending &&
    doc.currentVersion?.assignedApprover?.id === session?.user?.id;
  const canApprove =
    hasPermission(session, "sig.aprobaciones", "edit") && isAssignedApprover;

  return (
    <>
      <Topbar title={`SIG — ${doc.code}`} />
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {msg && <p className="text-sm text-teal-800 bg-teal-50 p-2 rounded">{msg}</p>}

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                {doc.title}
                <Badge>{STATUS_LABELS[doc.status] ?? doc.status}</Badge>
              </div>
              {canEditMetadata && !isEditingMetadata && (
                <Button size="sm" onClick={() => setIsEditingMetadata(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Editar metadatos
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Código:</strong> {doc.code}
            </p>
            {isEditingMetadata ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input
                    value={metadataForm.title}
                    onChange={(e) => setMetadataForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Tipo documental</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={metadataForm.documentTypeId}
                      onChange={(e) => setMetadataForm((f) => ({ ...f, documentTypeId: e.target.value }))}
                    >
                      <option value="">Sin tipo</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Proceso</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={metadataForm.processId}
                      onChange={(e) => setMetadataForm((f) => ({ ...f, processId: e.target.value }))}
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Empresa</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3 text-sm"
                      value={metadataForm.company}
                      onChange={(e) => setMetadataForm((f) => ({ ...f, company: e.target.value }))}
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
                    <Label className="text-xs">Intervalo revisión (días)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={metadataForm.revisionIntervalDays}
                      onChange={(e) => setMetadataForm((f) => ({ ...f, revisionIntervalDays: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => metadataMutation.mutate()}
                    disabled={metadataMutation.isPending}
                  >
                    {metadataMutation.isPending ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingMetadata(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  <strong>Tipo:</strong> {doc.documentType.name}
                </p>
                {doc.process && (
                  <p>
                    <strong>Proceso:</strong> {doc.process.name}
                  </p>
                )}
              </>
            )}
            {doc.currentVersion && (
              <>
                <p>
                  <strong>Versión vigente:</strong> {doc.currentVersion.versionLabel} —{" "}
                  {doc.currentVersion.fileName}
                </p>
                <p>
                  <strong>Última revisión:</strong> {formatDate(doc.currentVersion.revisionDate)}
                </p>
                <p>
                  <strong>Vigencia:</strong> {formatDate(doc.currentVersion.effectiveFrom)}
                  {doc.currentVersion.effectiveUntil
                    ? ` → ${formatDate(doc.currentVersion.effectiveUntil)}`
                    : " (sin fin)"}
                </p>
                {doc.revisionIntervalDays && (
                  <p>
                    <strong>Próxima revisión estimada:</strong>{" "}
                    {formatDate(
                      new Date(
                        new Date(doc.currentVersion.revisionDate).getTime() +
                          doc.revisionIntervalDays * 86400000
                      ).toISOString()
                    )}
                  </p>
                )}
                {pending && doc.currentVersion.assignedApprover && (
                  <p>
                    <strong>Aprobador asignado:</strong> {doc.currentVersion.assignedApprover.name}
                  </p>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.currentVersion.downloadUrl} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4 mr-1" />
                    Descargar
                  </a>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {pending && !isAssignedApprover && doc.currentVersion?.assignedApprover && (
          <p className="text-sm text-muted-foreground bg-muted/40 border rounded p-3">
            Pendiente de aprobación por {doc.currentVersion.assignedApprover.name}.
          </p>
        )}

        {pending && canApprove && (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="text-base">Aprobación pendiente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-16"
                placeholder="Notas de aprobación (opcional)"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                  Aprobar
                </Button>
              </div>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-16"
                placeholder="Motivo de rechazo"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={!rejectNote.trim() || rejectMutation.isPending}
              >
                Rechazar
              </Button>
            </CardContent>
          </Card>
        )}

        {canUpload && doc.status !== "OBSOLETE" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Nueva versión (archivo nuevo)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Etiqueta versión</Label>
                  <Input
                    placeholder="Auto si vacío"
                    value={versionForm.versionLabel}
                    onChange={(e) => setVersionForm((f) => ({ ...f, versionLabel: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Fecha revisión</Label>
                  <Input
                    type="date"
                    value={versionForm.revisionDate}
                    onChange={(e) => setVersionForm((f) => ({ ...f, revisionDate: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label>Enviar aprobación a *</Label>
                <select
                  className="w-full h-10 rounded-md border px-3 text-sm"
                  value={versionForm.assignedApproverId}
                  onChange={(e) =>
                    setVersionForm((f) => ({ ...f, assignedApproverId: e.target.value }))
                  }
                >
                  <option value="">Seleccionar aprobador…</option>
                  {approvers.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.email})
                    </option>
                  ))}
                </select>
              </div>
              <Input type="file" onChange={(e) => setNewVersionFile(e.target.files?.[0] ?? null)} />
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-16"
                placeholder="Resumen de cambios"
                value={versionForm.changeSummary}
                onChange={(e) => setVersionForm((f) => ({ ...f, changeSummary: e.target.value }))}
              />
              <Button
                onClick={() => newVersionMutation.mutate()}
                disabled={
                  !newVersionFile || !versionForm.assignedApproverId || newVersionMutation.isPending
                }
              >
                Subir nueva versión
              </Button>
            </CardContent>
          </Card>
        )}

        {canSameVersion && doc.currentVersion?.status === "APPROVED" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actualizar vigencia (misma versión)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Nueva fecha de revisión</Label>
                  <Input
                    type="date"
                    value={sameVersionForm.revisionDate}
                    onChange={(e) =>
                      setSameVersionForm((f) => ({ ...f, revisionDate: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Vigencia hasta</Label>
                  <Input
                    type="date"
                    value={sameVersionForm.effectiveUntil}
                    onChange={(e) =>
                      setSameVersionForm((f) => ({ ...f, effectiveUntil: e.target.value }))
                    }
                  />
                </div>
              </div>
              <Button onClick={() => sameVersionMutation.mutate()} disabled={sameVersionMutation.isPending}>
                Guardar sin cambiar versión
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de versiones</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2">Ver.</th>
                  <th className="px-3 py-2">Revisión</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Subido por</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {doc.versions.map((v) => (
                  <tr key={v.id} className="border-b">
                    <td className="px-3 py-2">{v.versionLabel}</td>
                    <td className="px-3 py-2">{formatDate(v.revisionDate)}</td>
                    <td className="px-3 py-2">{STATUS_LABELS[v.status] ?? v.status}</td>
                    <td className="px-3 py-2">{v.uploadedBy.name}</td>
                    <td className="px-3 py-2">
                      <a href={v.downloadUrl} className="text-teal-700 hover:underline text-xs">
                        Descargar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
