"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";

type Settings = {
  signerName: string;
  signerTitle: string;
  companyLegalName: string;
  companyIdNumber: string;
  companyAddress: string;
  companyPhone: string;
  corporateGroupText: string;
  emailFixedCc: string | null;
  otpSubjectTemplate: string;
  otpBodyTemplate: string;
  documentSignaturePath: string | null;
};

const EMPTY: Settings = {
  signerName: "",
  signerTitle: "",
  companyLegalName: "",
  companyIdNumber: "",
  companyAddress: "",
  companyPhone: "",
  corporateGroupText: "",
  emailFixedCc: "",
  otpSubjectTemplate: "",
  otpBodyTemplate: "",
  documentSignaturePath: null,
};

export default function SolicitudesRrhhAjustesPage() {
  const { data: session } = useSession();
  const canView = hasPermission(session ?? null, "solicitudesRrhh.ajustes", "view");
  const canEdit = hasPermission(session ?? null, "solicitudesRrhh.ajustes", "edit");
  const [form, setForm] = useState<Settings>(EMPTY);
  const [sigBust, setSigBust] = useState(0);
  const sigRef = useRef<HTMLInputElement>(null);

  const q = useQuery({
    queryKey: ["hr-document-settings"],
    queryFn: async (): Promise<Settings> => {
      const r = await fetch("/api/solicitudes-rrhh/settings", { credentials: "same-origin" });
      const j = (await r.json()) as { data?: Settings; error?: { message?: string } };
      if (!r.ok || !j.data) throw new Error(j.error?.message ?? "Error al cargar ajustes");
      return j.data;
    },
    enabled: canView,
  });

  useEffect(() => {
    if (q.data) {
      setForm({
        ...q.data,
        emailFixedCc: q.data.emailFixedCc ?? "",
        documentSignaturePath: q.data.documentSignaturePath ?? null,
      });
    }
  }, [q.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/solicitudes-rrhh/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...form,
          emailFixedCc: form.emailFixedCc?.trim() ? form.emailFixedCc : null,
        }),
      });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar");
    },
    onSuccess: () => toast.success("Ajustes de solicitudes RRHH guardados"),
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadSig = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/solicitudes-rrhh/signature", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const j = (await r.json()) as {
        data?: { documentSignaturePath: string };
        error?: { message?: string };
      };
      if (!r.ok || !j.data) throw new Error(j.error?.message ?? "Error al subir firma");
      return j.data;
    },
    onSuccess: (data) => {
      setForm((f) => ({ ...f, documentSignaturePath: data.documentSignaturePath }));
      setSigBust((n) => n + 1);
      toast.success("Firma actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearSig = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/solicitudes-rrhh/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ clearDocumentSignature: true }),
      });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) throw new Error(j.error?.message ?? "Error al quitar firma");
    },
    onSuccess: () => {
      setForm((f) => ({ ...f, documentSignaturePath: null }));
      setSigBust((n) => n + 1);
      toast.success("Firma eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canView) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Sin permiso para ver estos ajustes.</p>
      </div>
    );
  }

  function field(
    key: keyof Settings,
    label: string,
    opts?: { multiline?: boolean; rows?: number; hint?: string },
  ) {
    const value = form[key] ?? "";
    return (
      <div className="space-y-2">
        <Label htmlFor={key}>{label}</Label>
        {opts?.multiline ? (
          <Textarea
            id={key}
            rows={opts.rows ?? 4}
            value={String(value)}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        ) : (
          <Input
            id={key}
            value={String(value)}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        )}
        {opts?.hint ? <p className="text-xs text-muted-foreground">{opts.hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Solicitudes RRHH — Ajustes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configura el membrete, firmante, firma y plantillas del correo OTP. El logo del PDF es el de
          marca de la plataforma (Grupo Alfa). Portal público:{" "}
          <a className="underline" href="/solicitudes-rrhh">
            /solicitudes-rrhh
          </a>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documento</CardTitle>
          <CardDescription>Datos impresos en carta FCL y carta de servicio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("companyLegalName", "Razón social")}
          {field("companyIdNumber", "Cédula jurídica")}
          {field("companyAddress", "Dirección")}
          {field("companyPhone", "Teléfono")}
          {field("signerName", "Nombre del firmante")}
          {field("signerTitle", "Cargo / departamento")}
          {field("corporateGroupText", "Texto grupo corporativo (carta FCL)", {
            multiline: true,
            rows: 5,
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firma de RRHH</CardTitle>
          <CardDescription>
            Imagen PNG/JPEG de la firma de la encargada (aparece sobre el nombre en los PDFs).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.documentSignaturePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/solicitudes-rrhh/signature?${sigBust}`}
              alt="Firma RRHH"
              className="max-h-24 border rounded bg-white p-2"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Sin firma configurada.</p>
          )}
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input
                ref={sigRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadSig.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => sigRef.current?.click()}
                disabled={uploadSig.isPending}
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                {uploadSig.isPending ? "Subiendo..." : "Subir firma"}
              </Button>
              {form.documentSignaturePath && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => clearSig.mutate()}
                  disabled={clearSig.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Quitar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Correo OTP</CardTitle>
          <CardDescription>
            Placeholders: {"{{codigo}}"}, {"{{tramite}}"}, {"{{nombre}}"}. El código se envía al
            correo registrado del empleado en NAF/RRHH.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("emailFixedCc", "CC fijo (opcional)", {
            hint: "Varias direcciones separadas por coma o punto y coma.",
          })}
          {field("otpSubjectTemplate", "Asunto")}
          {field("otpBodyTemplate", "Cuerpo (texto)", { multiline: true, rows: 6 })}
        </CardContent>
      </Card>

      {canEdit && (
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || q.isLoading}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Guardando..." : "Guardar"}
        </Button>
      )}
    </div>
  );
}
