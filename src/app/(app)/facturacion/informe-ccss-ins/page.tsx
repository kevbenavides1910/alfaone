"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileUp, Download, Search, Loader2, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";

type ContractOption = {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
};

type ProcessResult = {
  filename: string;
  pdfBase64: string;
  reportType: "ccss" | "ins";
  contract: { id: string; licitacionNo: string; client: string };
  stats: {
    pdfCedulasFound: number;
    contractEmployees: number;
    highlighted: number;
    notInContract: number;
  };
  highlightedEmployees: {
    cedulaDigits: string;
    nombre: string | null;
    pages: number[];
  }[];
};

const REPORT_TYPES = [
  { value: "auto", label: "Detectar automáticamente" },
  { value: "ccss", label: "CCSS — Caja (planilla)" },
  { value: "ins", label: "INS" },
] as const;

export default function InformeCcssInsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [contractSearch, setContractSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState<ContractOption | null>(null);
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]["value"]>("auto");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);

  const { data: contractsData, isFetching: loadingContracts } = useQuery<{ data: ContractOption[] }>({
    queryKey: ["contracts-informe-ccss", contractSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "20" });
      if (contractSearch.trim()) params.set("search", contractSearch.trim());
      const r = await fetch(`/api/contracts?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const contracts = contractsData?.data ?? [];

  const canProcess = Boolean(file && selectedContract && !processing);

  async function handleProcess() {
    if (!file || !selectedContract) return;
    setProcessing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("contractId", selectedContract.id);
      form.append("reportType", reportType);

      const r = await fetch("/api/facturacion/informe-ccss-ins", {
        method: "POST",
        body: form,
      });
      const contentType = r.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await r.text();
        throw new Error(
          r.status >= 500
            ? "Error del servidor al procesar el PDF. Si el problema continúa, contacte al administrador."
            : text.slice(0, 200) || `Error HTTP ${r.status}`,
        );
      }
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al procesar");

      setResult(json.data as ProcessResult);
      toast.success(
        `${json.data.stats.highlighted} empleado(s) resaltado(s) en el PDF (${json.data.reportType.toUpperCase()})`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al procesar el informe");
    } finally {
      setProcessing(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortedHighlighted = useMemo(
    () =>
      [...(result?.highlightedEmployees ?? [])].sort((a, b) =>
        (a.nombre ?? a.cedulaDigits).localeCompare(b.nombre ?? b.cedulaDigits),
      ),
    [result],
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Informe CCSS e INS</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Suba el PDF de la planilla CCSS (Caja) o del INS, seleccione el contrato y el sistema
          resaltará en amarillo las filas de empleados que pertenecen a ese contrato según Empleados
          NAF y asignaciones RRHH.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Archivo y contrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pdf-file">PDF del informe (CCSS o INS)</Label>
            <Input
              id="pdf-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            {file && (
              <p className="text-xs text-slate-500">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-type">Tipo de informe</Label>
            <select
              id="report-type"
              className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as typeof reportType)}
            >
              {REPORT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Contrato</Label>
            {selectedContract ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
                <div>
                  <div className="font-medium text-slate-800">{selectedContract.client}</div>
                  <div className="text-xs text-slate-600">{selectedContract.licitacionNo}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() => setSelectedContract(null)}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar por cliente o licitación…"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 divide-y">
                  {loadingContracts ? (
                    <div className="p-4 text-center text-sm text-slate-400">Buscando…</div>
                  ) : contracts.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-400">Sin resultados</div>
                  ) : (
                    contracts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                        onClick={() => {
                          setSelectedContract(c);
                          setResult(null);
                        }}
                      >
                        <div className="font-medium text-slate-800">{c.client}</div>
                        <div className="text-xs text-slate-500">{c.licitacionNo}</div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <Button
            type="button"
            className="gap-2"
            disabled={!canProcess}
            onClick={handleProcess}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Generar PDF resaltado
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Resultado ({result.reportType.toUpperCase()})
              </span>
              <Button type="button" size="sm" className="gap-1.5" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <StatBox label="Cédulas en PDF" value={result.stats.pdfCedulasFound} />
              <StatBox label="Empleados del contrato" value={result.stats.contractEmployees} />
              <StatBox label="Resaltados" value={result.stats.highlighted} highlight />
              <StatBox label="No del contrato" value={result.stats.notInContract} />
            </div>

            <p className="text-xs text-slate-500">
              Contrato: <strong>{result.contract.client}</strong> — {result.contract.licitacionNo}
            </p>

            {sortedHighlighted.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Cédula</th>
                      <th className="px-3 py-2 font-medium">Nombre (NAF/RRHH)</th>
                      <th className="px-3 py-2 font-medium">Pág.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHighlighted.map((row) => (
                      <tr key={row.cedulaDigits} className="border-t bg-yellow-50/80">
                        <td className="px-3 py-2 tabular-nums">{row.cedulaDigits}</td>
                        <td className="px-3 py-2">{row.nombre ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{row.pages.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Ningún empleado del contrato apareció en este PDF. Verifique el contrato seleccionado
                o que los empleados tengan contrato NAF / asignación RRHH vinculada.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-3",
        highlight ? "border-yellow-300 bg-yellow-50" : "border-slate-200 bg-white",
      )}
    >
      <div className={cn("text-2xl font-bold tabular-nums", highlight && "text-amber-800")}>
        {value}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
