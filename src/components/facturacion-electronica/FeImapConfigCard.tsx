"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Inbox, Play, RefreshCw, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { useFeCompany, withFeCompanyBody } from "@/components/facturacion-electronica/fe-company-context";

async function readFeApiResponse(r: Response) {
  const text = await r.text();
  try {
    return JSON.parse(text) as { data?: unknown; error?: { message?: string } };
  } catch {
    if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
      throw new Error(
        `El servidor respondió con una página HTML (${r.status}). Recargue la página e intente de nuevo; si persiste, contacte soporte.`
      );
    }
    throw new Error(`Respuesta inválida del servidor (${r.status})`);
  }
}

type ImapForm = {
  imapEnabled: boolean;
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  imapUser: string;
  imapPass: string;
  imapFolder: string;
  imapPuntoVentaId: string;
};

type EmpresaImapSource = {
  imapEnabled?: boolean;
  imapHost?: string | null;
  imapPort?: number | null;
  imapSecure?: boolean | null;
  imapUser?: string | null;
  hasImapPassword?: boolean;
  imapFolder?: string | null;
  imapPuntoVentaId?: string | null;
  imapConfigured?: boolean;
};

type PuntoVenta = { id: string; codigo: string; nombre: string };

export function FeImapConfigCard({
  canEdit,
  configured,
  empresa,
  puntosVenta,
  onSaved,
}: {
  canEdit: boolean;
  configured: boolean;
  empresa: EmpresaImapSource | null | undefined;
  puntosVenta: PuntoVenta[];
  onSaved: () => void;
}) {
  const { companyCode } = useFeCompany();
  const [form, setForm] = useState<ImapForm>({
    imapEnabled: false,
    imapHost: "",
    imapPort: "993",
    imapSecure: true,
    imapUser: "",
    imapPass: "",
    imapFolder: "INBOX",
    imapPuntoVentaId: "",
  });

  useEffect(() => {
    if (!empresa) return;
    setForm({
      imapEnabled: Boolean(empresa.imapEnabled),
      imapHost: empresa.imapHost ?? "",
      imapPort: empresa.imapPort != null ? String(empresa.imapPort) : "993",
      imapSecure: empresa.imapSecure ?? true,
      imapUser: empresa.imapUser ?? "",
      imapPass: "",
      imapFolder: empresa.imapFolder ?? "INBOX",
      imapPuntoVentaId: empresa.imapPuntoVentaId ?? "",
    });
  }, [empresa]);

  const saveM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/config/imap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody(
            {
              imapEnabled: form.imapEnabled,
              imapHost: form.imapHost.trim() || null,
              imapPort: Number(form.imapPort) || 993,
              imapSecure: form.imapSecure,
              imapUser: form.imapUser.trim() || null,
              imapPass: form.imapPass.trim() || undefined,
              imapFolder: form.imapFolder.trim() || "INBOX",
              imapPuntoVentaId: form.imapPuntoVentaId || null,
            },
            companyCode
          )
        ),
      });
      const j = await readFeApiResponse(r);
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar IMAP");
    },
    onSuccess: () => {
      toast.success("Buzón IMAP guardado");
      setForm((f) => ({ ...f, imapPass: "" }));
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testM = useMutation({
    mutationFn: async () => {
      const pass = form.imapPass.trim();
      if (!pass && !empresa?.hasImapPassword) {
        throw new Error("Indique la contraseña IMAP para probar");
      }
      const r = await fetch("/api/fe/config/imap/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody(
            {
              imapHost: form.imapHost,
              imapPort: Number(form.imapPort) || 993,
              imapSecure: form.imapSecure,
              imapUser: form.imapUser,
              imapPass: pass || "use-stored",
              imapFolder: form.imapFolder || "INBOX",
            },
            companyCode
          )
        ),
      });
      const j = await readFeApiResponse(r);
      if (!r.ok) throw new Error(j.error?.message ?? "Conexión IMAP fallida");
      return j.data as { messages: number; unseen: number };
    },
    onSuccess: (d) => toast.success(`IMAP OK — ${d.messages} mensajes (${d.unseen} sin leer)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const syncM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/config/imap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody({}, companyCode)),
      });
      const j = await readFeApiResponse(r);
      if (!r.ok) throw new Error(j.error?.message ?? "Sincronización fallida");
      return j.data as { queued?: boolean; processed?: number; skipped?: number; message?: string };
    },
    onSuccess: (d) => {
      if (d && typeof d === "object" && "queued" in d && d.queued) {
        toast.success("Sincronización iniciada en segundo plano. Revise Recibidos en unos momentos.");
      } else {
        const data = d as { processed?: number; skipped?: number; message?: string };
        toast.success(
          data.message ??
            `Sincronizado: ${data.processed ?? 0} nuevos, ${data.skipped ?? 0} omitidos`
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!configured) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="h-4 w-4" />
          Buzón IMAP — facturas de proveedores
        </CardTitle>
        <CardDescription>
          Un buzón por empresa. Solo importa correos con XML de Hacienda o PDF que contenga clave FE (506…).
          Use una carpeta dedicada (ej. FacturasProveedores) si es Gmail.
          Sincronización automática cada 2 minutos cuando IMAP está activo.
          {empresa?.imapConfigured ? " Configuración activa." : " Complete host, usuario y contraseña."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            id="imap-enabled"
            checked={form.imapEnabled}
            onChange={(e) => setForm((f) => ({ ...f, imapEnabled: e.target.checked }))}
            disabled={!canEdit}
            className="h-4 w-4"
          />
          <Label htmlFor="imap-enabled">Activar lectura IMAP</Label>
        </div>
        <div className="space-y-2">
          <Label>Servidor IMAP</Label>
          <Input
            value={form.imapHost}
            onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))}
            placeholder="imap.gmail.com"
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Puerto</Label>
          <Input
            value={form.imapPort}
            onChange={(e) => setForm((f) => ({ ...f, imapPort: e.target.value }))}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Usuario</Label>
          <Input
            value={form.imapUser}
            onChange={(e) => setForm((f) => ({ ...f, imapUser: e.target.value }))}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Contraseña {empresa?.hasImapPassword ? "(guardada)" : ""}</Label>
          <Input
            type="password"
            value={form.imapPass}
            onChange={(e) => setForm((f) => ({ ...f, imapPass: e.target.value }))}
            placeholder={empresa?.hasImapPassword ? "Dejar vacío para no cambiar" : ""}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Carpeta</Label>
          <Input
            value={form.imapFolder}
            onChange={(e) => setForm((f) => ({ ...f, imapFolder: e.target.value }))}
            disabled={!canEdit}
          />
        </div>
        <div className="space-y-2">
          <Label>Punto de venta (mensaje receptor)</Label>
          <Select
            value={form.imapPuntoVentaId}
            onValueChange={(v) => setForm((f) => ({ ...f, imapPuntoVentaId: v }))}
            disabled={!canEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione…" />
            </SelectTrigger>
            <SelectContent>
              {puntosVenta.map((pv) => (
                <SelectItem key={pv.id} value={pv.id}>
                  {pv.codigo} — {pv.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {canEdit && (
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Guardar IMAP
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => testM.mutate()} disabled={testM.isPending}>
              <Play className="mr-2 h-4 w-4" />
              Probar conexión
            </Button>
          )}
          {form.imapEnabled && (
            <Button variant="secondary" onClick={() => syncM.mutate()} disabled={syncM.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sincronizar ahora
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
