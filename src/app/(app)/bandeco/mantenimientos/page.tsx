"use client";

import { Suspense, useState } from "react";
import { useQueryTab } from "@/lib/hooks/use-query-tab";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";
import { AlarmCodesTab } from "@/components/bandeco/mantenimientos/AlarmCodesTab";
import { PantallasTab } from "@/components/bandeco/mantenimientos/PantallasTab";
import { PuestosTab } from "@/components/bandeco/mantenimientos/PuestosTab";
import { CamarasTab } from "@/components/bandeco/mantenimientos/CamarasTab";
import { AperturasTab } from "@/components/bandeco/mantenimientos/AperturasTab";
import { PilasTab } from "@/components/bandeco/mantenimientos/PilasTab";

const TABS = [
  { id: "codigos", label: "Códigos de alarma" },
  { id: "pantallas", label: "Pantallas" },
  { id: "puestos", label: "Puestos" },
  { id: "camaras", label: "Cámaras" },
  { id: "aperturas", label: "Cuentas apertura" },
  { id: "pilas", label: "Pilas por finca" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTabParam(v: string | null): TabId {
  if (v && TABS.some((t) => t.id === v)) return v as TabId;
  return "codigos";
}

async function parseJson(r: Response) {
  const json = await r.json();
  if (!r.ok || json.error) throw new Error(json.error?.message ?? `Error ${r.status}`);
  return json;
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
