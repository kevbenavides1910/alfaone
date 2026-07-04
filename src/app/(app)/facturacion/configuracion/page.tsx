"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Mail, Play, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";

type ConfigForm = {
  mailProvider: "CUSTOM_SMTP" | "OUTLOOK" | "GMAIL";
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  emailFixedCc: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  dueReminderDaysBefore: string;
  dueReminderSubjectTemplate: string;
  dueReminderBodyTemplate: string;
  autoDueReminderEnabled: boolean;
  autoCollectionEnabled: boolean;
  collectionEmailIntervalDays: string;
};

export default function FacturacionCobroConfigPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session, "facturacion.cxc", "edit");
  const [form, setForm] = useState<ConfigForm>({
    mailProvider: "CUSTOM_SMTP",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    emailFixedCc: "",
    emailSubjectTemplate: "",
    emailBodyTemplate: "",
    dueReminderDaysBefore: "7",
    dueReminderSubjectTemplate: "",
    dueReminderBodyTemplate: "",
    autoDueReminderEnabled: true,
    autoCollectionEnabled: true,
    collectionEmailIntervalDays: "7",
  });
  const [testTo, setTestTo] = useState("");

  const q = useQuery({
    queryKey: ["facturacion-cobro-settings"],
    queryFn: async (): Promise<Record<string, unknown>> => {
      const r = await fetch("/api/admin/facturacion/cobro-settings", { credentials: "same-origin" });
      const j = (await r.json()) as { data?: Record<string, unknown>; error?: { message?: string } };
      if (!r.ok || !j.data) throw new Error(j.error?.message ?? "Error al cargar ajustes");
      return j.data;
    },
    enabled: hasPermission(session, "facturacion.cxc", "view"),
  });

  useEffect(() => {
    const u = session?.user?.email?.trim();
    if (u) setTestTo((prev) => prev || u);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!q.data) return;
    const d = q.data;
    setForm({
      mailProvider: ((d.mailProvider as string) || "CUSTOM_SMTP") as ConfigForm["mailProvider"],
      smtpHost: (d.smtpHost as string) || "",
      smtpPort: d.smtpPort !== null && d.smtpPort !== undefined ? String(d.smtpPort) : "587",
      smtpSecure: Boolean(d.smtpSecure),
      smtpUser: (d.smtpUser as string) || "",
      smtpPass: "",
      smtpFrom: (d.smtpFrom as string) || "",
      emailFixedCc: (d.emailFixedCc as string) || "",
      emailSubjectTemplate: (d.emailSubjectTemplate as string) || "",
      emailBodyTemplate: (d.emailBodyTemplate as string) || "",
      dueReminderDaysBefore:
        d.dueReminderDaysBefore !== null && d.dueReminderDaysBefore !== undefined
          ? String(d.dueReminderDaysBefore)
          : "7",
      dueReminderSubjectTemplate: (d.dueReminderSubjectTemplate as string) || "",
      dueReminderBodyTemplate: (d.dueReminderBodyTemplate as string) || "",
      autoDueReminderEnabled: d.autoDueReminderEnabled !== false,
      autoCollectionEnabled: d.autoCollectionEnabled !== false,
      collectionEmailIntervalDays:
        d.collectionEmailIntervalDays !== null && d.collectionEmailIntervalDays !== undefined
          ? String(d.collectionEmailIntervalDays)
          : "7",
    });
  }, [q.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        mailProvider: form.mailProvider,
        smtpHost: form.smtpHost || null,
        smtpPort: Number(form.smtpPort || 0) || null,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser || null,
        smtpPass: form.smtpPass || undefined,
        smtpFrom: form.smtpFrom || null,
        emailFixedCc: form.emailFixedCc.trim() || null,
        emailSubjectTemplate: form.emailSubjectTemplate,
        emailBodyTemplate: form.emailBodyTemplate,
        dueReminderDaysBefore: Number(form.dueReminderDaysBefore || 7) || 7,
        dueReminderSubjectTemplate: form.dueReminderSubjectTemplate,
        dueReminderBodyTemplate: form.dueReminderBodyTemplate,
        autoDueReminderEnabled: form.autoDueReminderEnabled,
        autoCollectionEnabled: form.autoCollectionEnabled,
        collectionEmailIntervalDays: Number(form.collectionEmailIntervalDays || 7) || 7,
      };
      const r = await fetch("/api/admin/facturacion/cobro-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as { error?: { message?: string } };
      if (!r.ok) throw new Error(j.error?.message ?? "No se pudo guardar");
    },
    onSuccess: () => {
      toast.success("Configuración de correo de cobro actualizada");
      setForm((s) => ({ ...s, smtpPass: "" }));
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message || "Error al guardar"),
  });

  const testMutation = useMutation({
    mutationFn: async (templateType: "collection" | "due_reminder"): Promise<{ sentTo: string; cc: string | null }> => {
      const port = Number(form.smtpPort || 0) || null;
      const body: Record<string, unknown> = {
        to: testTo.trim(),
        templateType,
        mailProvider: form.mailProvider,
        smtpHost: form.smtpHost.trim() || null,
        smtpPort: port,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser.trim() || null,
        smtpFrom: form.smtpFrom.trim() || null,
        emailFixedCc: form.emailFixedCc,
        emailSubjectTemplate: form.emailSubjectTemplate,
        emailBodyTemplate: form.emailBodyTemplate,
        dueReminderSubjectTemplate: form.dueReminderSubjectTemplate,
        dueReminderBodyTemplate: form.dueReminderBodyTemplate,
      };
      if (form.smtpPass.trim()) body.smtpPass = form.smtpPass.trim();
      const r = await fetch("/api/admin/facturacion/cobro-settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as {
        data?: { sentTo?: string; cc?: string | null };
        error?: { message?: string };
      };
      if (!r.ok) throw new Error(j.error?.message ?? "Error al enviar prueba");
      return {
        sentTo: j.data?.sentTo ?? testTo.trim(),
        cc: j.data?.cc ?? null,
      };
    },
    onSuccess: (data) => {
      toast.success(
        data.cc
          ? `Prueba enviada a ${data.sentTo} (CC: ${data.cc})`
          : `Correo de prueba enviado a ${data.sentTo}`
      );
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo enviar"),
  });

  const runAutoMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/cron/facturacion-cobro-emails", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await r.json()) as {
        data?: {
          dueReminder?: { sent: number; skipped: number; failed: { message: string }[] };
          collection?: { sent: number; skipped: number; failed: { message: string }[] };
        };
        error?: { message?: string };
      };
      if (!r.ok) throw new Error(j.error?.message ?? "Error al ejecutar envío automático");
      return j.data!;
    },
    onSuccess: (data) => {
      const dr = data.dueReminder;
      const col = data.collection;
      toast.success(
        `Envío automático: ${dr?.sent ?? 0} recordatorio(s), ${col?.sent ?? 0} cobro(s).` +
          ((dr?.failed.length ?? 0) + (col?.failed.length ?? 0) > 0
            ? ` ${(dr?.failed.length ?? 0) + (col?.failed.length ?? 0)} error(es).`
            : "")
      );
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo ejecutar"),
  });

  const lastAutoRun = q.data?.lastAutoEmailRunAt as string | null | undefined;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Configuración de correo de cobro</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure SMTP u Outlook, plantillas de recordatorio por vencer y de cobro por vencimiento.
          El mismo CC fijo aplica a ambos tipos de correo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salida de correo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Proveedor</label>
              <select
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.mailProvider}
                onChange={(e) =>
                  setForm((s) => ({ ...s, mailProvider: e.target.value as ConfigForm["mailProvider"] }))
                }
                disabled={!canEdit}
              >
                <option value="CUSTOM_SMTP">SMTP personalizado</option>
                <option value="OUTLOOK">Outlook (smtp.office365.com)</option>
                <option value="GMAIL">Gmail (smtp.gmail.com)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Correo remitente (From)</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.smtpFrom}
                onChange={(e) => setForm((s) => ({ ...s, smtpFrom: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Host SMTP</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.smtpHost}
                onChange={(e) => setForm((s) => ({ ...s, smtpHost: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Puerto SMTP</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.smtpPort}
                onChange={(e) => setForm((s) => ({ ...s, smtpPort: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Usuario SMTP</label>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.smtpUser}
                onChange={(e) => setForm((s) => ({ ...s, smtpUser: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Contraseña SMTP</label>
              <input
                type="password"
                placeholder="Dejar en blanco para conservar"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.smtpPass}
                onChange={(e) => setForm((s) => ({ ...s, smtpPass: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.smtpSecure}
              onChange={(e) => setForm((s) => ({ ...s, smtpSecure: e.target.checked }))}
              disabled={!canEdit}
            />
            Usar conexión segura (SSL/TLS)
          </label>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Copia fija (CC)</label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm min-h-[4.5rem]"
              value={form.emailFixedCc}
              onChange={(e) => setForm((s) => ({ ...s, emailFixedCc: e.target.value }))}
              disabled={!canEdit}
              placeholder="ej. contabilidad@empresa.com; tesoreria@empresa.com"
            />
            <p className="text-xs text-slate-500">
              Se añade en copia en cada correo de cobro enviado desde Cuentas por cobrar. Varias direcciones:
              separar con coma o punto y coma.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-muted/50/80 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-800">Probar envío</p>
            <p className="text-xs text-slate-600">
              Elija el destino y pruebe cada plantilla. El asunto lleva el prefijo [Prueba] con datos de ejemplo.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium text-slate-700">Enviar prueba a</label>
                <input
                  type="email"
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  disabled={!canEdit}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-2 shrink-0"
                disabled={!canEdit || testMutation.isPending || !testTo.trim()}
                onClick={() => testMutation.mutate("due_reminder")}
              >
                <Mail className="h-4 w-4" />
                {testMutation.isPending ? "Enviando…" : "Probar por vencer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 shrink-0"
                disabled={!canEdit || testMutation.isPending || !testTo.trim()}
                onClick={() => testMutation.mutate("collection")}
              >
                <Mail className="h-4 w-4" />
                {testMutation.isPending ? "Enviando…" : "Probar cobro vencido"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envío automático</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-slate-600">
            El servidor ejecuta un job diario a las <strong>8:00 AM</strong> (hora local del VPS) mediante cron.
            También puede dispararlo manualmente para probar.
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.autoDueReminderEnabled}
              onChange={(e) => setForm((s) => ({ ...s, autoDueReminderEnabled: e.target.checked }))}
              disabled={!canEdit}
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Recordatorio por vencer automático</span>
              <span className="block text-slate-500 mt-0.5">
                Una vez al día, para facturas pendientes que vencen dentro de la ventana configurada abajo.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.autoCollectionEnabled}
              onChange={(e) => setForm((s) => ({ ...s, autoCollectionEnabled: e.target.checked }))}
              disabled={!canEdit}
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Cobro automático tras vencimiento</span>
              <span className="block text-slate-500 mt-0.5">
                Desde el día de vencimiento, reenvía el correo de cobro cada N días hasta registrar el pago.
              </span>
            </span>
          </label>

          <div className="space-y-1.5 max-w-xs">
            <label className="text-sm font-medium text-slate-700">
              Intervalo de cobro (días después del vencimiento)
            </label>
            <input
              type="number"
              min={1}
              max={90}
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.collectionEmailIntervalDays}
              onChange={(e) => setForm((s) => ({ ...s, collectionEmailIntervalDays: e.target.value }))}
              disabled={!canEdit || !form.autoCollectionEnabled}
            />
            <p className="text-xs text-slate-500">
              Ejemplo: con 7 días, se envía el día del vencimiento y luego cada 7 días mientras siga pendiente.
            </p>
          </div>

          {lastAutoRun && (
            <p className="text-xs text-slate-500">
              Última ejecución automática:{" "}
              {new Date(lastAutoRun).toLocaleString("es-CR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          )}

          {canEdit && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={runAutoMutation.isPending || q.isLoading}
              onClick={() => runAutoMutation.mutate()}
            >
              <Play className="h-4 w-4" />
              {runAutoMutation.isPending ? "Ejecutando…" : "Ejecutar envío automático ahora"}
            </Button>
          )}

          <p className="text-xs text-slate-500 border-t pt-3">
            En el VPS: <code className="text-xs bg-slate-100 px-1 rounded">0 8 * * * …/scripts/cron-facturacion-cobro-emails.sh</code>
            {" "}(requiere <code className="text-xs bg-slate-100 px-1 rounded">SYNTRA_CRON_SECRET</code> en el entorno).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recordatorio por vencer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5 max-w-xs">
            <label className="text-sm font-medium text-slate-700">Ventana de gestión (días antes)</label>
            <input
              type="number"
              min={1}
              max={90}
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.dueReminderDaysBefore}
              onChange={(e) => setForm((s) => ({ ...s, dueReminderDaysBefore: e.target.value }))}
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500">
              Ventana para el envío automático diario (8:00 AM) y para priorizar en Cuentas por cobrar.
              También puede enviar el recordatorio manualmente antes del vencimiento.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Asunto</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.dueReminderSubjectTemplate}
              onChange={(e) => setForm((s) => ({ ...s, dueReminderSubjectTemplate: e.target.value }))}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Cuerpo</label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm min-h-36"
              value={form.dueReminderBodyTemplate}
              onChange={(e) => setForm((s) => ({ ...s, dueReminderBodyTemplate: e.target.value }))}
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500">
              Variables:{" "}
              {`{{contacto_nombre}} {{cliente}} {{licitacion}} {{periodo}} {{numero_factura}} {{total}} {{fecha_vencimiento}} {{dias_hasta_vencimiento}}`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobro (factura vencida)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Asunto</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.emailSubjectTemplate}
              onChange={(e) => setForm((s) => ({ ...s, emailSubjectTemplate: e.target.value }))}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Cuerpo</label>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm min-h-36"
              value={form.emailBodyTemplate}
              onChange={(e) => setForm((s) => ({ ...s, emailBodyTemplate: e.target.value }))}
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500">
              Variables:{" "}
              {`{{contacto_nombre}} {{cliente}} {{licitacion}} {{periodo}} {{numero_factura}} {{total}} {{fecha_vencimiento}} {{dias_vencidos}} {{dias_hasta_vencimiento}}`}
            </p>
            <p className="text-xs text-slate-500">
              Manual desde Cuentas por cobrar cuando la factura ya venció; también se usa en el envío automático
              periódico según el intervalo configurado.
            </p>
          </div>
        </CardContent>
      </Card>

      {canEdit ? (
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || q.isLoading}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Guardando..." : "Guardar configuración"}
        </Button>
      ) : (
        <p className="text-sm text-slate-500">Solo lectura — requiere permiso de edición en cuentas por cobrar.</p>
      )}

      <p className="text-sm text-slate-500">
        Los correos manuales se envían desde{" "}
        <Link href="/facturacion/cuentas-por-cobrar" className="text-blue-600 hover:underline">
          Cuentas por cobrar
        </Link>{" "}
        al contacto marcado como facturación en el contrato.
      </p>
    </div>
  );
}
