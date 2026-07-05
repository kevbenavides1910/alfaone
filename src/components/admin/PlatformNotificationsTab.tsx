"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Mail, Server, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";

interface PlatformSettings {
  notificationEmail: string | null;
  smtpHost:   string | null;
  smtpPort:   number | null;
  smtpSecure: boolean | null;
  smtpUser:   string | null;
  smtpPass:   string | null;
  smtpFrom:   string | null;
}

const EMPTY: PlatformSettings = {
  notificationEmail: "",
  smtpHost:   "",
  smtpPort:   587,
  smtpSecure: false,
  smtpUser:   "",
  smtpPass:   "",
  smtpFrom:   "",
};

export function PlatformNotificationsTab({ readOnly }: { readOnly?: boolean }) {
  const qc = useQueryClient();
  const [form, setForm]       = useState<PlatformSettings>(EMPTY);
  const [showPass, setShowPass] = useState(false);

  const { data, isLoading } = useQuery<{ data: PlatformSettings }>({
    queryKey: ["admin-platform-settings"],
    queryFn: () => fetch("/api/admin/platform-settings").then(r => r.json()),
  });

  useEffect(() => {
    if (data?.data) setForm({ ...EMPTY, ...data.data });
  }, [data]);

  function set<K extends keyof PlatformSettings>(key: K, val: PlatformSettings[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  const saveMutation = useMutation({
    mutationFn: (payload: PlatformSettings) =>
      fetch("/api/admin/platform-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          notificationEmail: payload.notificationEmail?.trim() || null,
          smtpHost:  payload.smtpHost?.trim()  || null,
          smtpUser:  payload.smtpUser?.trim()  || null,
          smtpFrom:  payload.smtpFrom?.trim()  || null,
          smtpPort:  payload.smtpPort          || null,
        }),
      }).then(r => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error.message ?? "Error al guardar"); return; }
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["admin-platform-settings"] });
    },
    onError: () => toast.error("Error al guardar"),
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <p className="text-sm text-slate-500">
        Configure el correo receptor de notificaciones generales y el servidor SMTP que usa la plataforma
        para enviar correos de restablecimiento de contraseña y alertas del sistema.
      </p>

      {/* Correo de notificaciones */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-slate-800">Correo de notificaciones</h3>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">
            Dirección receptora de alertas y avisos del sistema
          </label>
          <Input
            type="email"
            placeholder="notificaciones@empresa.com"
            value={form.notificationEmail ?? ""}
            onChange={e => set("notificationEmail", e.target.value || null)}
            disabled={readOnly}
          />
          <p className="text-xs text-slate-400">
            Este correo recibirá alertas internas del sistema (errores, reportes automáticos, etc.).
          </p>
        </div>
      </section>

      <div className="border-t" />

      {/* SMTP */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-red-500" />
          <h3 className="text-sm font-semibold text-slate-800">Servidor SMTP de plataforma</h3>
        </div>
        <p className="text-xs text-slate-400">
          Se usa para enviar correos de restablecimiento de contraseña. Si no se configura, esa función quedará
          deshabilitada.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Host SMTP</label>
            <Input
              placeholder="mail.empresa.com"
              value={form.smtpHost ?? ""}
              onChange={e => set("smtpHost", e.target.value || null)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Puerto</label>
            <Input
              type="number"
              placeholder="587"
              value={form.smtpPort ?? ""}
              onChange={e => set("smtpPort", parseInt(e.target.value) || null)}
              disabled={readOnly}
              className="text-center"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Usuario SMTP</label>
            <Input
              placeholder="usuario@empresa.com"
              value={form.smtpUser ?? ""}
              onChange={e => set("smtpUser", e.target.value || null)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Contraseña SMTP</label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={form.smtpPass ?? ""}
                onChange={e => set("smtpPass", e.target.value || null)}
                disabled={readOnly}
                className="pr-9"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-600">Dirección remitente (From)</label>
          <Input
            placeholder={`"${typeof window !== 'undefined' ? 'Alfa One' : 'Alfa One'}" <noreply@empresa.com>`}
            value={form.smtpFrom ?? ""}
            onChange={e => set("smtpFrom", e.target.value || null)}
            disabled={readOnly}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="smtp-secure"
            checked={form.smtpSecure ?? false}
            onChange={e => set("smtpSecure", e.target.checked)}
            disabled={readOnly}
            className="w-4 h-4 rounded border-slate-300 text-red-600"
          />
          <label htmlFor="smtp-secure" className="text-xs text-slate-600">
            SSL implícito (puerto 465). Desmarcar para STARTTLS (puerto 587, recomendado).
          </label>
        </div>
      </section>

      {!readOnly && (
        <div className="pt-2">
          <Button
            className="gap-2"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              : <><Save className="h-4 w-4" /> Guardar configuración</>
            }
          </Button>
        </div>
      )}
    </div>
  );
}
