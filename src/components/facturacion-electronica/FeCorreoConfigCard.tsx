"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Mail, Play, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import {
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";
import type { FE_MAIL_PROVIDERS } from "@/modules/facturacion-electronica/validators/correo.schema";

type MailProvider = (typeof FE_MAIL_PROVIDERS)[number];

type CorreoForm = {
  mailProvider: MailProvider;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  correoRemitente: string;
  correoNombre: string;
  correoCopiaFija: string;
};

type EmpresaCorreoSource = {
  mailProvider?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  hasSmtpPassword?: boolean;
  smtpFrom?: string | null;
  correoRemitente?: string | null;
  correoNombre?: string | null;
  correoCopiaFija?: string | null;
  smtpConfigured?: boolean;
};

const emptyCorreo = (): CorreoForm => ({
  mailProvider: "CUSTOM_SMTP",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "",
  correoRemitente: "",
  correoNombre: "",
  correoCopiaFija: "",
});

export function FeCorreoConfigCard({
  canEdit,
  configured,
  empresa,
  onSaved,
}: {
  canEdit: boolean;
  configured: boolean;
  empresa: EmpresaCorreoSource | null | undefined;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const { companyCode } = useFeCompany();
  const [form, setForm] = useState<CorreoForm>(emptyCorreo);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    const u = session?.user?.email?.trim();
    if (u) setTestTo((prev) => prev || u);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!empresa) {
      setForm(emptyCorreo());
      return;
    }
    setForm({
      mailProvider: ((empresa.mailProvider as MailProvider) || "CUSTOM_SMTP") as MailProvider,
      smtpHost: empresa.smtpHost ?? "",
      smtpPort: empresa.smtpPort != null ? String(empresa.smtpPort) : "587",
      smtpSecure: Boolean(empresa.smtpSecure),
      smtpUser: empresa.smtpUser ?? "",
      smtpPass: "",
      smtpFrom: empresa.smtpFrom ?? "",
      correoRemitente: empresa.correoRemitente ?? "",
      correoNombre: empresa.correoNombre ?? "",
      correoCopiaFija: empresa.correoCopiaFija ?? "",
    });
  }, [empresa]);

  const buildPayload = (includePass: boolean) => ({
    mailProvider: form.mailProvider,
    smtpHost: form.smtpHost.trim() || null,
    smtpPort: Number(form.smtpPort) || null,
    smtpSecure: form.smtpSecure,
    smtpUser: form.smtpUser.trim() || null,
    smtpFrom: form.smtpFrom.trim() || null,
    correoRemitente: form.correoRemitente.trim() || null,
    correoNombre: form.correoNombre.trim() || null,
    correoCopiaFija: form.correoCopiaFija.trim() || null,
    ...(includePass && form.smtpPass.trim() ? { smtpPass: form.smtpPass.trim() } : {}),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/config/correo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(buildPayload(true), companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar correo");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Configuración de correo guardada");
      setForm((f) => ({ ...f, smtpPass: "" }));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/config/correo/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody({ ...buildPayload(true), to: testTo.trim() }, companyCode)
        ),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar prueba");
      return j.data as { sentTo: string };
    },
    onSuccess: (data) => toast.success(`Correo de prueba enviado a ${data.sentTo}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card id="paso-correo">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Correo electrónico (SMTP)
        </CardTitle>
        <CardDescription>
          Servidor de salida para enviar XML y PDF de comprobantes aceptados. La configuración es por
          empresa emisora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configured && (
          <p className="text-sm text-amber-700">
            Guarde primero los datos del emisor (paso 1) antes de configurar el correo.
          </p>
        )}

        {empresa?.smtpConfigured && (
          <p className="text-sm text-emerald-700">Servidor SMTP configurado para esta empresa.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select
              value={form.mailProvider}
              disabled={!canEdit || !configured}
              onValueChange={(v) => setForm((f) => ({ ...f, mailProvider: v as MailProvider }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOM_SMTP">SMTP personalizado</SelectItem>
                <SelectItem value="OUTLOOK">Outlook (Office 365)</SelectItem>
                <SelectItem value="GMAIL">Gmail</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Correo remitente (From)</Label>
            <Input
              type="email"
              value={form.smtpFrom || form.correoRemitente}
              disabled={!canEdit || !configured}
              placeholder="facturacion@empresa.com"
              onChange={(e) => setForm((f) => ({ ...f, smtpFrom: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Host SMTP</Label>
            <Input
              value={form.smtpHost}
              disabled={!canEdit || !configured}
              placeholder="smtp.office365.com"
              onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Puerto</Label>
            <Input
              value={form.smtpPort}
              disabled={!canEdit || !configured}
              onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value.replace(/\D/g, "") }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Usuario SMTP</Label>
            <Input
              value={form.smtpUser}
              disabled={!canEdit || !configured}
              onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña SMTP</Label>
            <Input
              type="password"
              value={form.smtpPass}
              disabled={!canEdit || !configured}
              placeholder={empresa?.hasSmtpPassword ? "•••••• (vacío = no cambiar)" : "Contraseña o app password"}
              onChange={(e) => setForm((f) => ({ ...f, smtpPass: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Nombre visible del remitente</Label>
            <Input
              value={form.correoNombre}
              disabled={!canEdit || !configured}
              placeholder="Facturación electrónica"
              onChange={(e) => setForm((f) => ({ ...f, correoNombre: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Correo contacto (XML)</Label>
            <Input
              type="email"
              value={form.correoRemitente}
              disabled={!canEdit || !configured}
              onChange={(e) => setForm((f) => ({ ...f, correoRemitente: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>CC adicional (opcional)</Label>
            <Input
              value={form.correoCopiaFija}
              disabled={!canEdit || !configured}
              placeholder="copia1@empresa.com, copia2@empresa.com"
              onChange={(e) => setForm((f) => ({ ...f, correoCopiaFija: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Además del correo de contacto (XML) del emisor y del remitente SMTP, que siempre reciben copia.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="fe-smtp-secure"
              type="checkbox"
              checked={form.smtpSecure}
              disabled={!canEdit || !configured}
              onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
            />
            <Label htmlFor="fe-smtp-secure">Conexión segura (SSL/TLS directo, p. ej. puerto 465)</Label>
          </div>
        </div>

        {canEdit && configured && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Guardar correo
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-4">
          <div className="min-w-[220px] flex-1 space-y-2">
            <Label>Enviar prueba a</Label>
            <Input
              type="email"
              value={testTo}
              disabled={!canEdit || !configured}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!canEdit || !configured || !testTo.trim() || testM.isPending}
            onClick={() => testM.mutate()}
          >
            <Play className="mr-2 h-4 w-4" />
            Probar envío
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
