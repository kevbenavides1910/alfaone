"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AlertCircle, CheckCircle2, Mail, Plus, Save, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { hasPermission } from "@/lib/permissions/check";
import { FeConfigChecklist, type FeReadiness } from "@/components/facturacion-electronica/FeConfigChecklist";
import { FeCorreoConfigCard } from "@/components/facturacion-electronica/FeCorreoConfigCard";
import { FeImapConfigCard } from "@/components/facturacion-electronica/FeImapConfigCard";
import { FeProveedoresConfianzaCard } from "@/components/facturacion-electronica/FeProveedoresConfianzaCard";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";
import { FeCatalogSearchPicker } from "@/components/facturacion-electronica/FeCatalogSearchPicker";
import { FeUbicacionCrSelects } from "@/components/facturacion-electronica/FeUbicacionCrSelects";
import { padUbicacionCode } from "@/modules/facturacion-electronica/catalogos/cr-ubicacion";

type FeConfigResponse = {
  configured: boolean;
  company: { code: string; name: string } | null;
  empresa: {
    nombreComercial: string;
    razonSocial: string;
    tipoIdentificacion?: "FISICA" | "JURIDICA" | "DIMEX" | "NITE" | "EXTRANJERO";
    cedulaJuridica: string;
    actividadEconomica?: string | null;
    proveedorSistemas?: string | null;
    exigirUbicacionReceptor?: boolean;
    ambiente: "STAGING" | "PRODUCCION";
    correoRemitente?: string | null;
    correoNombre?: string | null;
    telefono?: string | null;
    email?: string | null;
    direccionProvincia?: string | null;
    direccionCanton?: string | null;
    direccionDistrito?: string | null;
    direccionBarrio?: string | null;
    direccionOtras?: string | null;
    // Producción
    hasCertificado: boolean;
    hasAtvPassword?: boolean;
    certificadoFileName?: string | null;
    atvUsuario?: string | null;
    // Staging
    hasCertificadoStg?: boolean;
    hasAtvPasswordStg?: boolean;
    certificadoFileNameStg?: string | null;
    atvUsuarioStg?: string | null;
    mailProvider?: string | null;
    smtpHost?: string | null;
    smtpPort?: number | null;
    smtpSecure?: boolean | null;
    smtpUser?: string | null;
    hasSmtpPassword?: boolean;
    smtpFrom?: string | null;
    correoCopiaFija?: string | null;
    smtpConfigured?: boolean;
    imapEnabled?: boolean;
    imapHost?: string | null;
    imapPort?: number | null;
    imapSecure?: boolean | null;
    imapUser?: string | null;
    hasImapPassword?: boolean;
    imapFolder?: string | null;
    imapPuntoVentaId?: string | null;
    imapConfigured?: boolean;
    hasLogo?: boolean;
  } | null;
  sucursales: Array<{
    id: string;
    codigo: string;
    nombre: string;
    puntosVenta: Array<{
      id: string;
      codigo: string;
      nombre: string;
      consecutivos: Array<{ tipoComprobante: string; ultimoNumero: string | number }>;
    }>;
  }>;
  readiness: FeReadiness;
  smtpConfigured: boolean;
};

type EmpresaForm = {
  nombreComercial: string;
  razonSocial: string;
  tipoIdentificacion: "FISICA" | "JURIDICA" | "DIMEX" | "NITE" | "EXTRANJERO";
  cedulaJuridica: string;
  actividadEconomica: string;
  proveedorSistemas: string;
  exigirUbicacionReceptor: boolean;
  ambiente: "STAGING" | "PRODUCCION";
  // Producción
  atvUsuario: string;
  atvPassword: string;
  // Staging
  atvUsuarioStg: string;
  atvPasswordStg: string;
  correoRemitente: string;
  correoNombre: string;
  telefono: string;
  email: string;
  direccionProvincia: string;
  direccionCanton: string;
  direccionDistrito: string;
  direccionBarrio: string;
  direccionOtras: string;
};

const emptyEmpresa = (name = ""): EmpresaForm => ({
  nombreComercial: name,
  razonSocial: name,
  tipoIdentificacion: "JURIDICA",
  cedulaJuridica: "",
  actividadEconomica: "",
  proveedorSistemas: "",
  exigirUbicacionReceptor: true,
  ambiente: "STAGING",
  atvUsuario: "",
  atvPassword: "",
  atvUsuarioStg: "",
  atvPasswordStg: "",
  correoRemitente: "",
  correoNombre: "",
  telefono: "",
  email: "",
  direccionProvincia: "",
  direccionCanton: "",
  direccionDistrito: "",
  direccionBarrio: "",
  direccionOtras: "",
});

export default function FeConfiguracionPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const { companyCode, needsSelection } = useFeCompany();
  const canEdit = hasPermission(session, "facturacionElectronica.config", "edit");

  const [empresaForm, setEmpresaForm] = useState<EmpresaForm>(emptyEmpresa());
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [certFileStg, setCertFileStg] = useState<File | null>(null);
  const [certPasswordStg, setCertPasswordStg] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [actividadDesc, setActividadDesc] = useState("");
  const [sucursalForm, setSucursalForm] = useState({ codigo: "001", nombre: "Principal" });
  const [pvForms, setPvForms] = useState<Record<string, { codigo: string; nombre: string }>>({});

  const configQ = useQuery({
    queryKey: ["fe-config", companyCode],
    queryFn: async (): Promise<FeConfigResponse> => {
      const r = await fetch(feApiUrl("/api/fe/config", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar");
      return j.data;
    },
    enabled: hasPermission(session, "facturacionElectronica.facturas", "view") && Boolean(companyCode),
  });

  useEffect(() => {
    const d = configQ.data;
    if (!d) return;
    if (d.empresa) {
      setEmpresaForm({
        nombreComercial: d.empresa.nombreComercial,
        razonSocial: d.empresa.razonSocial,
        tipoIdentificacion: d.empresa.tipoIdentificacion ?? "JURIDICA",
        cedulaJuridica: d.empresa.cedulaJuridica,
        actividadEconomica: d.empresa.actividadEconomica ?? "",
        proveedorSistemas: d.empresa.proveedorSistemas ?? d.empresa.cedulaJuridica ?? "",
        exigirUbicacionReceptor: d.empresa.exigirUbicacionReceptor ?? true,
        ambiente: d.empresa.ambiente,
        atvUsuario: d.empresa.atvUsuario ?? d.empresa.cedulaJuridica ?? "",
        atvPassword: "",
        atvUsuarioStg: d.empresa.atvUsuarioStg ?? "",
        atvPasswordStg: "",
        correoRemitente: d.empresa.correoRemitente ?? "",
        correoNombre: d.empresa.correoNombre ?? "",
        telefono: d.empresa.telefono ?? "",
        email: d.empresa.email ?? "",
        direccionProvincia: d.empresa.direccionProvincia ?? "",
        direccionCanton: padUbicacionCode(d.empresa.direccionCanton),
        direccionDistrito: padUbicacionCode(d.empresa.direccionDistrito),
        direccionBarrio: d.empresa.direccionBarrio ?? "",
        direccionOtras: d.empresa.direccionOtras ?? "",
      });
    } else if (d.company) {
      setEmpresaForm(emptyEmpresa(d.company.name));
    }
  }, [configQ.data]);

  const saveEmpresa = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/config/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody(
            {
              ...empresaForm,
              atvPassword: empresaForm.atvPassword.trim() || undefined,
              atvPasswordStg: empresaForm.atvPasswordStg.trim() || undefined,
            },
            companyCode
          )
        ),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al guardar");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Datos del emisor guardados");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testAtv = useMutation({
    mutationFn: async (forAmbiente: "STAGING" | "PRODUCCION") => {
      const isStg = forAmbiente === "STAGING";
      const r = await fetch("/api/fe/config/atv/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody(
            {
              atvUsuario: (isStg ? empresaForm.atvUsuarioStg : empresaForm.atvUsuario).trim() || undefined,
              atvPassword: (isStg ? empresaForm.atvPasswordStg : empresaForm.atvPassword).trim() || undefined,
              forAmbiente,
            },
            companyCode
          )
        ),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "No se pudo obtener token de Hacienda");
      return j.data;
    },
    onSuccess: (data) => toast.success(`Token ${data?.ambiente ?? ""} exitoso`),
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadLogo = useMutation({
    mutationFn: async () => {
      if (!logoFile) throw new Error("Seleccione una imagen PNG o JPEG");
      const fd = new FormData();
      fd.append("file", logoFile);
      if (companyCode) fd.append("companyCode", companyCode);
      const r = await fetch("/api/fe/config/empresa/logo", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al subir logo");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Logo cargado");
      setLogoFile(null);
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearLogo = useMutation({
    mutationFn: async () => {
      const r = await fetch(feApiUrl("/api/fe/config/empresa/logo", companyCode), { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al quitar logo");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Logo eliminado");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadCert = useMutation({
    mutationFn: async () => {
      if (!certFile) throw new Error("Seleccione un archivo .p12");
      const fd = new FormData();
      fd.append("file", certFile);
      fd.append("password", certPassword);
      if (companyCode) fd.append("companyCode", companyCode);
      const r = await fetch("/api/fe/config/empresa/certificado", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al subir certificado");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Certificado producción cargado");
      setCertFile(null);
      setCertPassword("");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadCertStg = useMutation({
    mutationFn: async () => {
      if (!certFileStg) throw new Error("Seleccione un archivo .p12 para staging");
      const fd = new FormData();
      fd.append("file", certFileStg);
      fd.append("password", certPasswordStg);
      if (companyCode) fd.append("companyCode", companyCode);
      fd.append("forAmbiente", "STAGING");
      const r = await fetch("/api/fe/config/empresa/certificado", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al subir certificado staging");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Certificado staging (pruebas) cargado");
      setCertFileStg(null);
      setCertPasswordStg("");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSucursal = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/config/sucursales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody(sucursalForm, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al crear sucursal");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Sucursal creada");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPuntoVenta = useMutation({
    mutationFn: async ({ sucursalId, codigo, nombre }: { sucursalId: string; codigo: string; nombre: string }) => {
      const r = await fetch(`/api/fe/config/sucursales/${sucursalId}/puntos-venta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withFeCompanyBody({ codigo, nombre }, companyCode)),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al crear punto de venta");
      return j.data;
    },
    onSuccess: () => {
      toast.success("Punto de venta creado");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSucursal = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(feApiUrl(`/api/fe/config/sucursales/${id}`, companyCode), { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error?.message ?? "Error al eliminar");
      }
    },
    onSuccess: () => {
      toast.success("Sucursal eliminada");
      qc.invalidateQueries({ queryKey: ["fe-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readiness = useMemo(
    () =>
      configQ.data?.readiness ?? {
        emisor: false,
        certificado: false,
        atv: false,
        sucursal: false,
        puntoVenta: false,
        readyToEmit: false,
      },
    [configQ.data?.readiness]
  );

  if (needsSelection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seleccione empresa emisora</CardTitle>
          <CardDescription>
            Su usuario tiene acceso a todas las compañías. Use el selector en la barra superior para elegir
            la razón social que desea configurar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (configQ.isLoading) return <p className="text-sm text-muted-foreground">Cargando configuración…</p>;
  if (configQ.isError) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertCircle className="h-4 w-4" />
            Error al cargar
          </CardTitle>
          <CardDescription>{(configQ.error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const empresa = configQ.data?.empresa;
  const company = configQ.data?.company;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Configuración del emisor</h2>
          <p className="text-sm text-muted-foreground">
            Empresa ERP: <strong>{company?.code ?? companyCode ?? session?.user?.company ?? "—"}</strong>
            {company?.name ? ` · ${company.name}` : ""}
          </p>
        </div>
        {readiness.readyToEmit && (
          <Button asChild variant="outline" size="sm">
            <Link href="/facturacion-electronica/nueva">Emitir factura</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Progreso de configuración</CardTitle>
          <CardDescription>
            Complete los 5 pasos para poder emitir comprobantes electrónicos a Hacienda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeConfigChecklist readiness={readiness} />
          {readiness.readyToEmit ? (
            <div className="flex gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium">Listo para emitir</p>
                <p className="text-emerald-800">
                  El emisor está configurado. Puede crear facturas desde Comprobantes → Nueva factura.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Guarde los datos en cada sección. Use <strong>Staging</strong> para pruebas antes de pasar a
              Producción.
            </p>
          )}
        </CardContent>
      </Card>

      <Card id="paso-emisor">
        <CardHeader>
          <CardTitle className="text-base">1. Datos de la razón social</CardTitle>
          <CardDescription>Información que aparece en el XML y el PDF del comprobante.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre comercial">
            <Input
              value={empresaForm.nombreComercial}
              disabled={!canEdit}
              onChange={(e) => setEmpresaForm((f) => ({ ...f, nombreComercial: e.target.value }))}
            />
          </Field>
          <Field label="Razón social">
            <Input
              value={empresaForm.razonSocial}
              disabled={!canEdit}
              onChange={(e) => setEmpresaForm((f) => ({ ...f, razonSocial: e.target.value }))}
            />
          </Field>
          <Field label="Tipo identificación">
            <Select
              value={empresaForm.tipoIdentificacion}
              disabled={!canEdit}
              onValueChange={(v) =>
                setEmpresaForm((f) => ({
                  ...f,
                  tipoIdentificacion: v as EmpresaForm["tipoIdentificacion"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="JURIDICA">Jurídica</SelectItem>
                <SelectItem value="FISICA">Física</SelectItem>
                <SelectItem value="DIMEX">DIMEX</SelectItem>
                <SelectItem value="NITE">NITE</SelectItem>
                <SelectItem value="EXTRANJERO">Extranjero</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Identificación del emisor">
            <Input
              value={empresaForm.cedulaJuridica}
              disabled={!canEdit}
              placeholder="3101123456"
              onChange={(e) => setEmpresaForm((f) => ({ ...f, cedulaJuridica: e.target.value }))}
            />
          </Field>
          <Field label="Actividad económica (CIIU)" className="sm:col-span-2">
            {companyCode && configQ.data?.configured ? (
              <FeCatalogSearchPicker
                companyCode={companyCode}
                kind="actividad"
                value={empresaForm.actividadEconomica}
                selectedDescription={actividadDesc}
                identificacion={empresaForm.cedulaJuridica}
                onSelect={(item) => {
                  setEmpresaForm((f) => ({ ...f, actividadEconomica: item.codigo }));
                  setActividadDesc(item.descripcion);
                }}
              />
            ) : null}
            <Input
              value={empresaForm.actividadEconomica}
              disabled={!canEdit}
              placeholder="7020.0 o 702000"
              onChange={(e) => {
                setActividadDesc("");
                setEmpresaForm((f) => ({ ...f, actividadEconomica: e.target.value }));
              }}
            />
          </Field>
          <Field label="Proveedor de sistemas (cédula)">
            <Input
              value={empresaForm.proveedorSistemas}
              disabled={!canEdit}
              placeholder="Vacío = cédula del emisor (software propio)"
              onChange={(e) => setEmpresaForm((f) => ({ ...f, proveedorSistemas: e.target.value }))}
            />
          </Field>
          <Field label="Correo de contacto (XML)">
            <Input
              type="email"
              value={empresaForm.email}
              disabled={!canEdit}
              placeholder="facturacion@empresa.com"
              onChange={(e) => setEmpresaForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={empresaForm.telefono}
              disabled={!canEdit}
              placeholder="22223333"
              onChange={(e) => setEmpresaForm((f) => ({ ...f, telefono: e.target.value }))}
            />
          </Field>
          <Field label="Logo en PDF" className="sm:col-span-2">
            <p className="mb-2 text-xs text-muted-foreground">
              Aparece en la factura electrónica (PDF). PNG o JPEG, máx. 2 MB. Si no carga logo FE, se usa el de Marca del sistema.
            </p>
            {empresa?.hasLogo && companyCode ? (
              <img
                src={feApiUrl("/api/fe/config/empresa/logo", companyCode)}
                alt="Logo emisor"
                className="mb-2 h-16 w-auto max-w-[200px] rounded border bg-white object-contain p-1"
              />
            ) : null}
            {canEdit && configQ.data?.configured ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={!canEdit}
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadLogo.isPending || !logoFile}
                  onClick={() => uploadLogo.mutate()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {uploadLogo.isPending ? "Subiendo…" : "Subir logo"}
                </Button>
                {empresa?.hasLogo ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={clearLogo.isPending}
                    onClick={() => clearLogo.mutate()}
                  >
                    Quitar logo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Field>
          <FeUbicacionCrSelects
            required
            disabled={!canEdit}
            value={{
              provincia: empresaForm.direccionProvincia,
              canton: empresaForm.direccionCanton,
              distrito: empresaForm.direccionDistrito,
            }}
            onChange={(next) =>
              setEmpresaForm((f) => ({
                ...f,
                direccionProvincia: next.provincia,
                direccionCanton: next.canton,
                direccionDistrito: next.distrito,
              }))
            }
          />
          <Field label="Barrio">
            <Input
              value={empresaForm.direccionBarrio}
              disabled={!canEdit}
              placeholder="Opcional (v4.4)"
              maxLength={50}
              onChange={(e) => setEmpresaForm((f) => ({ ...f, direccionBarrio: e.target.value }))}
            />
          </Field>
          <Field label="Otras señas" className="sm:col-span-2">
            <Input
              value={empresaForm.direccionOtras}
              disabled={!canEdit}
              placeholder="100 m norte de…"
              onChange={(e) => setEmpresaForm((f) => ({ ...f, direccionOtras: e.target.value }))}
            />
          </Field>
          <Field label="Ambiente Hacienda">
            <Select
              value={empresaForm.ambiente}
              disabled={!canEdit}
              onValueChange={(v) =>
                setEmpresaForm((f) => ({ ...f, ambiente: v as EmpresaForm["ambiente"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAGING">Staging (pruebas ATV)</SelectItem>
                <SelectItem value="PRODUCCION">Producción</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Validación receptor" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={empresaForm.exigirUbicacionReceptor}
                disabled={!canEdit}
                onChange={(e) =>
                  setEmpresaForm((f) => ({ ...f, exigirUbicacionReceptor: e.target.checked }))
                }
              />
              Exigir provincia, cantón y distrito del receptor al emitir (recomendado v4.4)
            </label>
          </Field>
          {canEdit && (
            <div className="sm:col-span-2">
              <Button onClick={() => saveEmpresa.mutate()} disabled={saveEmpresa.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Guardar emisor
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="paso-atv">
        <CardHeader>
          <CardTitle className="text-base">2. Credenciales ATV (Hacienda)</CardTitle>
          <CardDescription>
            Configure las credenciales para cada ambiente. Staging usa el portal{" "}
            <strong>Tribu / TicoFactura</strong> (Mi perfil → Credenciales pruebas); Producción usa el portal{" "}
            <strong>ATV Hacienda</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Staging */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-4">
            <p className="text-sm font-medium text-amber-900">Staging (pruebas ATV / Tribu)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Usuario ATV Staging">
                <Input
                  value={empresaForm.atvUsuarioStg}
                  disabled={!canEdit}
                  placeholder="cpf-…@stag.comprobanteselectronicos.go.cr"
                  onChange={(e) => setEmpresaForm((f) => ({ ...f, atvUsuarioStg: e.target.value }))}
                />
                {empresa?.atvUsuarioStg && (
                  <p className="mt-1 text-xs text-muted-foreground">Guardado: {empresa.atvUsuarioStg}</p>
                )}
                {empresaForm.atvUsuarioStg.trim() && !empresaForm.atvUsuarioStg.includes("@") && (
                  <p className="mt-1 text-xs text-amber-700">
                    En Tribu pruebas debe ser el correo @stag.comprobanteselectronicos.go.cr
                  </p>
                )}
              </Field>
              <Field label="Contraseña ATV Staging">
                <Input
                  type="password"
                  value={empresaForm.atvPasswordStg}
                  disabled={!canEdit}
                  placeholder={empresa?.hasAtvPasswordStg ? "•••••• (vacío = no cambiar)" : "Contraseña Tribu pruebas"}
                  onChange={(e) => setEmpresaForm((f) => ({ ...f, atvPasswordStg: e.target.value }))}
                />
              </Field>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => saveEmpresa.mutate()} disabled={saveEmpresa.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar credenciales staging
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testAtv.mutate("STAGING")}
                  disabled={
                    testAtv.isPending ||
                    !empresaForm.atvUsuarioStg.trim() ||
                    (!empresaForm.atvPasswordStg.trim() && !empresa?.hasAtvPasswordStg)
                  }
                >
                  {testAtv.isPending ? "Probando…" : "Probar token Staging"}
                </Button>
              </div>
            )}
          </div>

          {/* Producción */}
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-4">
            <p className="text-sm font-medium text-blue-900">Producción (ATV Hacienda)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Usuario ATV Producción">
                <Input
                  value={empresaForm.atvUsuario}
                  disabled={!canEdit}
                  placeholder="cpf-…@prod.comprobanteselectronicos.go.cr o cédula"
                  onChange={(e) => setEmpresaForm((f) => ({ ...f, atvUsuario: e.target.value }))}
                />
                {empresa?.atvUsuario && (
                  <p className="mt-1 text-xs text-muted-foreground">Guardado: {empresa.atvUsuario}</p>
                )}
              </Field>
              <Field label="Contraseña ATV Producción">
                <Input
                  type="password"
                  value={empresaForm.atvPassword}
                  disabled={!canEdit}
                  placeholder={empresa?.hasAtvPassword ? "•••••• (vacío = no cambiar)" : "Contraseña ATV Hacienda"}
                  onChange={(e) => setEmpresaForm((f) => ({ ...f, atvPassword: e.target.value }))}
                />
              </Field>
            </div>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => saveEmpresa.mutate()} disabled={saveEmpresa.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar credenciales producción
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testAtv.mutate("PRODUCCION")}
                  disabled={
                    testAtv.isPending ||
                    !empresaForm.atvUsuario.trim() ||
                    (!empresaForm.atvPassword.trim() && !empresa?.hasAtvPassword)
                  }
                >
                  {testAtv.isPending ? "Probando…" : "Probar token Producción"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="paso-certificado">
        <CardHeader>
          <CardTitle className="text-base">3. Certificado digital (.p12)</CardTitle>
          <CardDescription>
            Suba el certificado para cada ambiente. Staging y Producción pueden usar el mismo archivo o certificados
            distintos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cert Staging */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-900">
              Staging —{" "}
              {empresa?.hasCertificadoStg
                ? `✓ ${empresa.certificadoFileNameStg ?? "certificado .p12 cargado"}`
                : "Sin certificado staging"}
            </p>
            {canEdit && configQ.data?.configured && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Archivo .p12 / .pfx (staging)">
                  <Input type="file" accept=".p12,.pfx" onChange={(e) => setCertFileStg(e.target.files?.[0] ?? null)} />
                </Field>
                <Field label="Contraseña del certificado">
                  <Input type="password" value={certPasswordStg} onChange={(e) => setCertPasswordStg(e.target.value)} />
                </Field>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={uploadCertStg.isPending || !certFileStg || !certPasswordStg}
                  onClick={() => uploadCertStg.mutate()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Subir cert. staging
                </Button>
              </div>
            )}
          </div>

          {/* Cert Producción */}
          <div className="rounded-md border border-blue-200 bg-blue-50 p-4 space-y-3">
            <p className="text-sm font-medium text-blue-900">
              Producción —{" "}
              {empresa?.hasCertificado
                ? `✓ ${empresa.certificadoFileName ?? "certificado .p12 cargado"}`
                : "Sin certificado producción"}
            </p>
            {canEdit && configQ.data?.configured && (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Archivo .p12 / .pfx (producción)">
                  <Input type="file" accept=".p12,.pfx" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
                </Field>
                <Field label="Contraseña del certificado">
                  <Input type="password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} />
                </Field>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={uploadCert.isPending || !certFile || !certPassword}
                  onClick={() => uploadCert.mutate()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Subir cert. producción
                </Button>
              </div>
            )}
          </div>

          {!configQ.data?.configured && (
            <p className="text-sm text-amber-600">Guarde primero los datos del emisor (paso 1).</p>
          )}
        </CardContent>
      </Card>

      <Card id="paso-sucursales">
        <CardHeader>
          <CardTitle className="text-base">4. Sucursales y puntos de venta</CardTitle>
          <CardDescription>
            Códigos numéricos usados en la clave y consecutivo Hacienda (sucursal 3 dígitos, terminal 5 dígitos).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {(configQ.data?.sucursales ?? []).map((s) => (
            <div key={s.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-medium">
                  Sucursal <span className="font-mono">{s.codigo}</span> — {s.nombre}
                </p>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteSucursal.mutate(s.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <ul className="mb-3 space-y-1 text-sm">
                {s.puntosVenta.length === 0 ? (
                  <li className="text-muted-foreground">Sin puntos de venta — agregue al menos uno.</li>
                ) : (
                  s.puntosVenta.map((pv) => (
                    <li key={pv.id} className="text-muted-foreground">
                      Terminal <span className="font-mono">{pv.codigo}</span> — {pv.nombre}
                      {pv.consecutivos.length > 0 && (
                        <span className="ml-2 text-xs">
                          (últ. FE:{" "}
                          {String(
                            pv.consecutivos.find((c) => c.tipoComprobante === "FACTURA_ELECTRONICA")
                              ?.ultimoNumero ?? 0
                          )}
                          )
                        </span>
                      )}
                    </li>
                  ))
                )}
              </ul>
              {canEdit && configQ.data?.configured && (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Cód. terminal">
                    <Input
                      className="w-28"
                      value={pvForms[s.id]?.codigo ?? "00001"}
                      onChange={(e) =>
                        setPvForms((f) => ({
                          ...f,
                          [s.id]: { codigo: e.target.value.replace(/\D/g, ""), nombre: f[s.id]?.nombre ?? "Caja 1" },
                        }))
                      }
                    />
                  </Field>
                  <Field label="Nombre">
                    <Input
                      value={pvForms[s.id]?.nombre ?? "Caja 1"}
                      onChange={(e) =>
                        setPvForms((f) => ({
                          ...f,
                          [s.id]: { codigo: f[s.id]?.codigo ?? "00001", nombre: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      addPuntoVenta.mutate({
                        sucursalId: s.id,
                        codigo: pvForms[s.id]?.codigo ?? "00001",
                        nombre: pvForms[s.id]?.nombre ?? "Caja 1",
                      })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Punto de venta
                  </Button>
                </div>
              )}
            </div>
          ))}

          {canEdit && configQ.data?.configured && (
            <div className="flex flex-wrap items-end gap-2 border-t pt-4">
              <Field label="Cód. sucursal">
                <Input
                  className="w-28"
                  value={sucursalForm.codigo}
                  onChange={(e) =>
                    setSucursalForm((f) => ({ ...f, codigo: e.target.value.replace(/\D/g, "").slice(0, 3) }))
                  }
                />
              </Field>
              <Field label="Nombre sucursal">
                <Input
                  value={sucursalForm.nombre}
                  onChange={(e) => setSucursalForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </Field>
              <Button variant="outline" onClick={() => addSucursal.mutate()} disabled={addSucursal.isPending}>
                <Plus className="mr-2 h-4 w-4" />
                Agregar sucursal
              </Button>
            </div>
          )}
          {!configQ.data?.configured && (
            <p className="text-sm text-muted-foreground">Guarde el emisor (paso 1) para agregar sucursales.</p>
          )}
        </CardContent>
      </Card>

      {!configQ.data?.smtpConfigured && configQ.data?.configured && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Correo no configurado
            </CardTitle>
            <CardDescription>
              Complete la sección siguiente para enviar XML/PDF a clientes cuando un comprobante es aceptado.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <FeCorreoConfigCard
        canEdit={canEdit}
        configured={Boolean(configQ.data?.configured)}
        empresa={empresa}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["fe-config", companyCode] })}
      />

      <FeImapConfigCard
        canEdit={canEdit}
        configured={Boolean(configQ.data?.configured)}
        empresa={empresa}
        puntosVenta={configQ.data?.sucursales.flatMap((s) => s.puntosVenta) ?? []}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["fe-config", companyCode] })}
      />

      {configQ.data?.configured && <FeProveedoresConfianzaCard canEdit={canEdit} />}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
