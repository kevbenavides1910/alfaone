"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  FileWarning,
  Upload,
  UserCircle,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils/format";

interface ImportResult {
  batchId: string;
  rowsProcessed: number;
  employeesUpserted: number;
  employeesCreated?: number;
  employeesUpdated?: number;
  employeesDeactivated?: number;
  placementsUpserted: number;
  rowsSkipped: number;
  errors: { row: number; message: string }[];
}

interface BatchRow {
  id: string;
  filename: string;
  rowsProcessed: number;
  employeesUpserted: number;
  employeesDeactivated?: number;
  placementsUpserted: number;
  rowsSkipped: number;
  errorsJson: { row: number; message: string }[] | null;
  createdAt: string;
  uploadedBy: { name: string; email: string };
}

export default function EmpleadosImportarPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data: batchesData, isLoading: batchesLoading } = useQuery({
    queryKey: ["empleados-import-batches"],
    queryFn: async () => {
      const res = await fetch("/api/empleados/import/batches");
      if (!res.ok) throw new Error("Error");
      return (await res.json()) as { data: BatchRow[] };
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/empleados/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al importar");
      return json.data as ImportResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-import-batches"] });
      if (data.errors.length === 0) {
        const deact =
          data.employeesDeactivated && data.employeesDeactivated > 0
            ? ` ${data.employeesDeactivated} dado(s) de baja (inactivo).`
            : "";
        toast.success(
          "Sincronización completada",
          `${data.employeesUpserted} empleado(s), ${data.placementsUpserted} asignación(es).${deact}`,
        );
      } else {
        toast.info(
          "Sincronización parcial",
          `${data.employeesUpserted} empleado(s); ${data.errors.length} error(es).`,
        );
      }
    },
    onError: (e: Error) => {
      toast.error("Error", e.message);
    },
  });

  function handleFileChange() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Formato inválido", "Seleccione un archivo CSV.");
      return;
    }
    setResult(null);
    importMutation.mutate(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  const batches = batchesData?.data ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Topbar title="Empleados · Importar" />
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-3xl mx-auto w-full">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/empleados">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver al directorio
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-indigo-600" />
              Carga masiva de empleados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Suba el reporte <strong>reporte_de_empleados_y_cuentas_bancarias</strong> en formato CSV
              (delimitador <code>;</code>). El archivo es la <strong>fuente de verdad</strong>: se cruza
              por <strong>cédula</strong>, actualiza datos existentes y da de baja (estado inactivo) a quienes
              ya no aparezcan en el archivo. La columna <strong>Compañía</strong> se vincula al catálogo de
              empresas por código planilla (01 Alfa, 02 Tango, 03 Monitoreo, 04 Bena, 05 Consorcio, 08 Desarrollos
              Constructivos, 09 Alfatronic, 10 Joben, 11 Benlo, 30 ACE).
            </p>

            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-slate-400 mb-3" />
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                disabled={importMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {importMutation.isPending ? "Importando…" : "Seleccionar CSV"}
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Columnas esperadas: Compañía, Contrato, Ubicación, Empleado, Nombre, Cédula, cuenta bancaria, etc.
              </p>
            </div>

            {result && (
              <div className="rounded-lg border bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="h-5 w-5" />
                  Resultado de la importación
                </div>
                <ul className="text-sm text-slate-700 space-y-1">
                  <li>Filas procesadas: {result.rowsProcessed}</li>
                  <li>Empleados sincronizados: {result.employeesUpserted}</li>
                  {(result.employeesCreated ?? 0) > 0 && (
                    <li>Nuevos: {result.employeesCreated}</li>
                  )}
                  {(result.employeesUpdated ?? 0) > 0 && (
                    <li>Actualizados: {result.employeesUpdated}</li>
                  )}
                  <li>Asignaciones (contrato/ubicación): {result.placementsUpserted}</li>
                  {(result.employeesDeactivated ?? 0) > 0 && (
                    <li className="text-amber-700">
                      Dados de baja (inactivos): {result.employeesDeactivated}
                    </li>
                  )}
                  {result.rowsSkipped > 0 && <li>Filas omitidas: {result.rowsSkipped}</li>}
                </ul>
                {result.errors.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1 text-amber-700 text-sm font-medium mb-1">
                      <FileWarning className="h-4 w-4" /> Errores ({result.errors.length})
                    </div>
                    <ul className="text-xs text-slate-600 max-h-40 overflow-y-auto space-y-0.5">
                      {result.errors.slice(0, 30).map((e, i) => (
                        <li key={i}>
                          Fila {e.row}: {e.message}
                        </li>
                      ))}
                      {result.errors.length > 30 && (
                        <li>… y {result.errors.length - 30} más</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de importaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {batchesLoading && <p className="text-sm text-slate-500">Cargando…</p>}
            {!batchesLoading && batches.length === 0 && (
              <p className="text-sm text-slate-500">Aún no hay importaciones registradas.</p>
            )}
            {batches.length > 0 && (
              <ul className="divide-y text-sm">
                {batches.map((b) => (
                  <li key={b.id} className="py-3 flex flex-wrap justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-800">{b.filename}</div>
                      <div className="text-xs text-slate-500">
                        {formatDate(b.createdAt)} · {b.uploadedBy.name}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 text-right">
                      {b.employeesUpserted} emp. · {b.placementsUpserted} asig.
                      {(b.employeesDeactivated ?? 0) > 0 && ` · ${b.employeesDeactivated} baja(s)`}
                      {b.rowsSkipped > 0 && ` · ${b.rowsSkipped} omit.`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
