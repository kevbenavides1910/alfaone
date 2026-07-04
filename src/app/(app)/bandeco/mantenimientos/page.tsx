"use client";

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryTab } from "@/lib/hooks/use-query-tab";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { id: "codigos", label: "Códigos de alarma" },
  { id: "pantallas", label: "Pantallas" },
  { id: "puestos", label: "Puestos" },
  { id: "camaras", label: "Cámaras" },
  { id: "aperturas", label: "Cuentas apertura" },
  { id: "pilas", label: "Pilas por finca" },
] as const;

type TabId = (typeof TABS)[number]["id"];

async function parseJson(r: Response) {
  const json = await r.json();
  if (!r.ok || json.error) throw new Error(json.error?.message ?? `Error ${r.status}`);
  return json;
}

function parseTabParam(v: string | null): TabId {
  if (v && TABS.some((t) => t.id === v)) return v as TabId;
  return "codigos";
}

function MantenimientosContent() {
  const tabFromUrl = parseTabParam(useQueryTab());
  const [tab, setTab] = useState<TabId>(tabFromUrl);
  const [importing, setImporting] = useState(false);

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/bandeco/import", { method: "POST", body: fd });
      const json = await parseJson(r);
      toast.success(
        `Importado: ${json.data.stats.alarmCodes} códigos, ${json.data.stats.pantallas} pantallas`,
      );
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Mantenimientos Bandeco</h1>
          <p className="text-sm text-slate-500">
            Bases de datos editables equivalentes a BASE_DATOS, PANTALLAS, PUESTOS, CAMARAS, APERTURAS y PILAS.
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept=".xlsm,.xlsx"
            className="hidden"
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" className="gap-2" asChild disabled={importing}>
            <span>
              <Upload className="h-4 w-4" />
              {importing ? "Importando..." : "Importar Excel"}
            </span>
          </Button>
        </label>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-slate-600 hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "codigos" && <AlarmCodesTab />}
      {tab === "pantallas" && <PantallasTab />}
      {tab === "puestos" && <PuestosTab />}
      {tab === "camaras" && <CamarasTab />}
      {tab === "aperturas" && <AperturasTab />}
      {tab === "pilas" && <PilasTab />}
    </div>
  );
}

export default function BandecoMantenimientosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <MantenimientosContent />
    </Suspense>
  );
}

// ── Códigos de alarma ─────────────────────────────────────────────────────────

type AlarmCode = {
  id: string;
  alarmNumber: number;
  finca: string;
  zona: string;
  motorizado: string;
  bodycam: string | null;
  grupoWsp: string | null;
  encargado: string | null;
  numeroEncargado: string | null;
  isActive: boolean;
};

function AlarmCodesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<AlarmCode | null>(null);
  const [form, setForm] = useState({
    alarmNumber: "",
    finca: "",
    zona: "",
    motorizado: "",
    bodycam: "",
    grupoWsp: "",
    encargado: "",
    numeroEncargado: "",
    isActive: true,
  });

  const { data, isLoading } = useQuery<{ data: AlarmCode[] }>({
    queryKey: ["bandeco-alarm-codes", q],
    queryFn: () =>
      fetch(`/api/bandeco/alarm-codes${q ? `?q=${encodeURIComponent(q)}` : ""}`).then((r) => parseJson(r)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        alarmNumber: Number(form.alarmNumber),
        finca: form.finca,
        zona: form.zona,
        motorizado: form.motorizado,
        bodycam: form.bodycam || null,
        grupoWsp: form.grupoWsp || null,
        encargado: form.encargado || null,
        numeroEncargado: form.numeroEncargado || null,
        isActive: form.isActive,
      };
      const url = edit ? `/api/bandeco/alarm-codes/${edit.id}` : "/api/bandeco/alarm-codes";
      const r = await fetch(url, {
        method: edit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return parseJson(r);
    },
    onSuccess: () => {
      toast.success(edit ? "Actualizado" : "Creado");
      qc.invalidateQueries({ queryKey: ["bandeco-alarm-codes"] });
      setShow(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/bandeco/alarm-codes/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["bandeco-alarm-codes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  function openAdd() {
    setEdit(null);
    setForm({ alarmNumber: "", finca: "", zona: "", motorizado: "", bodycam: "", grupoWsp: "", encargado: "", numeroEncargado: "", isActive: true });
    setShow(true);
  }

  function openEdit(row: AlarmCode) {
    setEdit(row);
    setForm({
      alarmNumber: String(row.alarmNumber),
      finca: row.finca,
      zona: row.zona,
      motorizado: row.motorizado,
      bodycam: row.bodycam ?? "",
      grupoWsp: row.grupoWsp ?? "",
      encargado: row.encargado ?? "",
      numeroEncargado: row.numeroEncargado ?? "",
      isActive: row.isActive,
    });
    setShow(true);
  }

  return (
    <CatalogShell
      title={`${rows.length} códigos`}
      onAdd={openAdd}
      search={q}
      onSearch={setQ}
      searchPlaceholder="Buscar por código, finca o zona..."
    >
      {isLoading ? (
        <Loading />
      ) : (
        <DataTable
          headers={["Código", "Finca", "Zona", "Motorizado", "Bodycam", "Grupo WSP", "Encargado", "Tel.", ""]}
          rows={rows.map((r) => [
            r.alarmNumber,
            r.finca,
            r.zona,
            r.motorizado,
            r.bodycam ?? "—",
            r.grupoWsp ?? "—",
            r.encargado ?? "—",
            r.numeroEncargado ?? "—",
            <ActionButtons key={r.id} onEdit={() => openEdit(r)} onDelete={() => del.mutate(r.id)} />,
          ])}
        />
      )}

      <FormDialog
        open={show}
        onOpenChange={setShow}
        title={edit ? "Editar código" : "Nuevo código"}
        saving={save.isPending}
        onSave={() => save.mutate()}
      >
        <FormGrid>
          <Field label="Número de alarma" disabled={!!edit}>
            <Input value={form.alarmNumber} onChange={(e) => setForm({ ...form, alarmNumber: e.target.value })} disabled={!!edit} type="number" />
          </Field>
          <Field label="Finca"><Input value={form.finca} onChange={(e) => setForm({ ...form, finca: e.target.value })} /></Field>
          <Field label="Zona"><Input value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })} /></Field>
          <Field label="Motorizado"><Input value={form.motorizado} onChange={(e) => setForm({ ...form, motorizado: e.target.value })} /></Field>
          <Field label="Bodycam"><Input value={form.bodycam} onChange={(e) => setForm({ ...form, bodycam: e.target.value })} /></Field>
          <Field label="Grupo WhatsApp"><Input value={form.grupoWsp} onChange={(e) => setForm({ ...form, grupoWsp: e.target.value })} /></Field>
          <Field label="Encargado"><Input value={form.encargado} onChange={(e) => setForm({ ...form, encargado: e.target.value })} /></Field>
          <Field label="Número encargado"><Input value={form.numeroEncargado} onChange={(e) => setForm({ ...form, numeroEncargado: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Pantallas ─────────────────────────────────────────────────────────────────

type Pantalla = {
  id: string;
  finca: string;
  zona: string;
  pantalla: number | null;
  camara: number | null;
  zonaExterna: string | null;
  pantalla2: number | null;
  camara2: number | null;
  alarmCode: { alarmNumber: number; finca: string; zona: string };
};

function PantallasTab() {
  const qc = useQueryClient();
  const { data: codes } = useQuery<{ data: AlarmCode[] }>({
    queryKey: ["bandeco-alarm-codes"],
    queryFn: () => fetch("/api/bandeco/alarm-codes").then((r) => parseJson(r)),
  });
  const { data, isLoading } = useQuery<{ data: Pantalla[] }>({
    queryKey: ["bandeco-pantallas"],
    queryFn: () => fetch("/api/bandeco/pantallas").then((r) => parseJson(r)),
  });

  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Pantalla | null>(null);
  const [form, setForm] = useState({ alarmCodeId: "", finca: "", zona: "", pantalla: "", camara: "", zonaExterna: "", pantalla2: "", camara2: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        alarmCodeId: form.alarmCodeId,
        finca: form.finca,
        zona: form.zona,
        pantalla: form.pantalla ? Number(form.pantalla) : null,
        camara: form.camara ? Number(form.camara) : null,
        zonaExterna: form.zonaExterna || null,
        pantalla2: form.pantalla2 ? Number(form.pantalla2) : null,
        camara2: form.camara2 ? Number(form.camara2) : null,
      };
      const url = edit ? `/api/bandeco/pantallas/${edit.id}` : "/api/bandeco/pantallas";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["bandeco-pantallas"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/bandeco/pantallas/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["bandeco-pantallas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];
  const codeOptions = codes?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} pantallas`} onAdd={() => { setEdit(null); setForm({ alarmCodeId: "", finca: "", zona: "", pantalla: "", camara: "", zonaExterna: "", pantalla2: "", camara2: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Código", "Finca", "Zona", "Pant.", "Cam.", "Zona ext.", "2ª Pant.", "2ª Cam.", ""]}
          rows={rows.map((r) => [
            r.alarmCode.alarmNumber,
            r.finca,
            r.zona,
            r.pantalla ?? "—",
            r.camara ?? "—",
            r.zonaExterna ?? "—",
            r.pantalla2 ?? "—",
            r.camara2 ?? "—",
            <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ alarmCodeId: "", finca: r.finca, zona: r.zona, pantalla: String(r.pantalla ?? ""), camara: String(r.camara ?? ""), zonaExterna: r.zonaExterna ?? "", pantalla2: String(r.pantalla2 ?? ""), camara2: String(r.camara2 ?? "") }); setShow(true); }} onDelete={() => del.mutate(r.id)} />,
          ])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar pantalla" : "Nueva pantalla"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          {!edit && (
            <Field label="Código de alarma">
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.alarmCodeId} onChange={(e) => {
                const c = codeOptions.find((x) => x.id === e.target.value);
                setForm({ ...form, alarmCodeId: e.target.value, finca: c?.finca ?? "", zona: c?.zona ?? "" });
              }}>
                <option value="">Seleccionar...</option>
                {codeOptions.filter((c) => !rows.some((p) => p.alarmCode.alarmNumber === c.alarmNumber) || edit).map((c) => (
                  <option key={c.id} value={c.id}>{c.alarmNumber} — {c.finca} / {c.zona}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Pantalla"><Input type="number" value={form.pantalla} onChange={(e) => setForm({ ...form, pantalla: e.target.value })} /></Field>
          <Field label="Cámara"><Input type="number" value={form.camara} onChange={(e) => setForm({ ...form, camara: e.target.value })} /></Field>
          <Field label="Zona externa"><Input value={form.zonaExterna} onChange={(e) => setForm({ ...form, zonaExterna: e.target.value })} /></Field>
          <Field label="2ª Pantalla"><Input type="number" value={form.pantalla2} onChange={(e) => setForm({ ...form, pantalla2: e.target.value })} /></Field>
          <Field label="2ª Cámara"><Input type="number" value={form.camara2} onChange={(e) => setForm({ ...form, camara2: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Puestos ───────────────────────────────────────────────────────────────────

type Puesto = { id: string; name: string; isActive: boolean; sortOrder: number };

function PuestosTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Puesto[] }>({
    queryKey: ["bandeco-puestos"],
    queryFn: () => fetch("/api/bandeco/puestos").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Puesto | null>(null);
  const [name, setName] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const url = edit ? `/api/bandeco/puestos/${edit.id}` : "/api/bandeco/puestos";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, isActive: true, sortOrder: edit?.sortOrder ?? 0 }) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["bandeco-puestos"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/bandeco/puestos/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["bandeco-puestos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} puestos`} onAdd={() => { setEdit(null); setName(""); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Puesto / Motorizado", ""]}
          rows={rows.map((r) => [r.name, <ActionButtons key={r.id} onEdit={() => { setEdit(r); setName(r.name); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar puesto" : "Nuevo puesto"} saving={save.isPending} onSave={() => save.mutate()}>
        <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Cámaras ───────────────────────────────────────────────────────────────────

type Camara = { id: string; pantallaNum: number; camaraNum: number; descripcion: string };

function CamarasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Camara[] }>({
    queryKey: ["bandeco-camaras"],
    queryFn: () => fetch("/api/bandeco/camaras").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Camara | null>(null);
  const [form, setForm] = useState({ pantallaNum: "", camaraNum: "", descripcion: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = { pantallaNum: Number(form.pantallaNum), camaraNum: Number(form.camaraNum), descripcion: form.descripcion };
      const url = edit ? `/api/bandeco/camaras/${edit.id}` : "/api/bandeco/camaras";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["bandeco-camaras"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/bandeco/camaras/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["bandeco-camaras"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} cámaras`} onAdd={() => { setEdit(null); setForm({ pantallaNum: "", camaraNum: "", descripcion: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Pantalla #", "Cámara #", "Descripción", ""]}
          rows={rows.map((r) => [r.pantallaNum, r.camaraNum, r.descripcion, <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ pantallaNum: String(r.pantallaNum), camaraNum: String(r.camaraNum), descripcion: r.descripcion }); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar cámara" : "Nueva cámara"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          <Field label="Pantalla #"><Input type="number" value={form.pantallaNum} onChange={(e) => setForm({ ...form, pantallaNum: e.target.value })} disabled={!!edit} /></Field>
          <Field label="Cámara #"><Input type="number" value={form.camaraNum} onChange={(e) => setForm({ ...form, camaraNum: e.target.value })} disabled={!!edit} /></Field>
          <Field label="Descripción" className="md:col-span-2"><Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Aperturas ─────────────────────────────────────────────────────────────────

type Apertura = { id: string; finca: string; cuentaNum: number; nombreCuenta: string };

function AperturasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Apertura[] }>({
    queryKey: ["bandeco-aperturas"],
    queryFn: () => fetch("/api/bandeco/apertura-cuentas").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Apertura | null>(null);
  const [form, setForm] = useState({ finca: "", cuentaNum: "", nombreCuenta: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = { finca: form.finca, cuentaNum: Number(form.cuentaNum), nombreCuenta: form.nombreCuenta };
      const url = edit ? `/api/bandeco/apertura-cuentas/${edit.id}` : "/api/bandeco/apertura-cuentas";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["bandeco-aperturas"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/bandeco/apertura-cuentas/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["bandeco-aperturas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} cuentas`} onAdd={() => { setEdit(null); setForm({ finca: "", cuentaNum: "", nombreCuenta: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Finca", "# Cuenta", "Nombre cuenta", ""]}
          rows={rows.map((r) => [r.finca, r.cuentaNum, r.nombreCuenta, <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ finca: r.finca, cuentaNum: String(r.cuentaNum), nombreCuenta: r.nombreCuenta }); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar cuenta" : "Nueva cuenta"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          <Field label="Finca"><Input value={form.finca} onChange={(e) => setForm({ ...form, finca: e.target.value })} /></Field>
          <Field label="# Cuenta (código)"><Input type="number" value={form.cuentaNum} onChange={(e) => setForm({ ...form, cuentaNum: e.target.value })} /></Field>
          <Field label="Nombre cuenta" className="md:col-span-2"><Input value={form.nombreCuenta} onChange={(e) => setForm({ ...form, nombreCuenta: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Pilas ─────────────────────────────────────────────────────────────────────

type Pila = { id: string; finca: string; desmane: string | null; paneo: string | null; zonaMotorizado: string | null; observaciones: string | null };

function PilasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Pila[] }>({
    queryKey: ["bandeco-pilas"],
    queryFn: () => fetch("/api/bandeco/pilas-fincas").then((r) => parseJson(r)),
  });
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Pila | null>(null);
  const [form, setForm] = useState({ finca: "", desmane: "", paneo: "", zonaMotorizado: "", observaciones: "" });

  const save = useMutation({
    mutationFn: async () => {
      const body = { finca: form.finca, desmane: form.desmane || null, paneo: form.paneo || null, zonaMotorizado: form.zonaMotorizado || null, observaciones: form.observaciones || null };
      const url = edit ? `/api/bandeco/pilas-fincas/${edit.id}` : "/api/bandeco/pilas-fincas";
      const r = await fetch(url, { method: edit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return parseJson(r);
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["bandeco-pilas"] }); setShow(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/bandeco/pilas-fincas/${id}`, { method: "DELETE" }).then((r) => parseJson(r)),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["bandeco-pilas"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <CatalogShell title={`${rows.length} fincas`} onAdd={() => { setEdit(null); setForm({ finca: "", desmane: "", paneo: "", zonaMotorizado: "", observaciones: "" }); setShow(true); }}>
      {isLoading ? <Loading /> : (
        <DataTable
          headers={["Finca", "Desmane", "Paneo", "Zona", "Observaciones", ""]}
          rows={rows.map((r) => [r.finca, r.desmane ?? "—", r.paneo ?? "—", r.zonaMotorizado ?? "—", r.observaciones ?? "—", <ActionButtons key={r.id} onEdit={() => { setEdit(r); setForm({ finca: r.finca, desmane: r.desmane ?? "", paneo: r.paneo ?? "", zonaMotorizado: r.zonaMotorizado ?? "", observaciones: r.observaciones ?? "" }); setShow(true); }} onDelete={() => del.mutate(r.id)} />])}
        />
      )}
      <FormDialog open={show} onOpenChange={setShow} title={edit ? "Editar finca" : "Nueva finca"} saving={save.isPending} onSave={() => save.mutate()}>
        <FormGrid>
          <Field label="Finca"><Input value={form.finca} onChange={(e) => setForm({ ...form, finca: e.target.value })} disabled={!!edit} /></Field>
          <Field label="Desmane %"><Input value={form.desmane} onChange={(e) => setForm({ ...form, desmane: e.target.value })} /></Field>
          <Field label="Paneo %"><Input value={form.paneo} onChange={(e) => setForm({ ...form, paneo: e.target.value })} /></Field>
          <Field label="Zona / Motorizado"><Input value={form.zonaMotorizado} onChange={(e) => setForm({ ...form, zonaMotorizado: e.target.value })} /></Field>
          <Field label="Observaciones" className="md:col-span-2"><Input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} /></Field>
        </FormGrid>
      </FormDialog>
    </CatalogShell>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function CatalogShell({
  title,
  onAdd,
  search,
  onSearch,
  searchPlaceholder,
  children,
}: {
  title: string;
  onAdd: () => void;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <span className="text-sm text-slate-500">{title}</span>
        <div className="flex gap-2">
          {onSearch && (
            <Input
              placeholder={searchPlaceholder}
              value={search ?? ""}
              onChange={(e) => onSearch(e.target.value)}
              className="w-56"
            />
          )}
          <Button size="sm" className="gap-1.5" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
      </Card>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number | React.ReactNode)[][] }) {
  if (rows.length === 0) return <p className="p-8 text-center text-slate-400">Sin registros.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-slate-50 text-left text-slate-600">
          {headers.map((h) => (
            <th key={h} className="px-4 py-2 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b hover:bg-slate-50/50">
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-2">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}

function FormDialog({ open, onOpenChange, title, saving, onSave, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; saving: boolean; onSave: () => void; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function Field({ label, children, className, disabled }: { label: string; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <div className={className}>
      <label className={cn("text-sm text-slate-600", disabled && "opacity-50")}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Loading() {
  return <p className="p-8 text-center text-slate-400">Cargando...</p>;
}
