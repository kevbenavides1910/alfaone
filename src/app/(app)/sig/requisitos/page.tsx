"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Pencil, Upload, X } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { isStructuralRequirement } from "@/modules/sig/business/requirement-structure";

type Standard = {
  id: string;
  code: string;
  name: string;
  year: number | null;
  hasPdf?: boolean;
  pdfFileName?: string | null;
};

type RequirementRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  observations: string | null;
  isApplicable: boolean;
  trafficLight: "RED" | "YELLOW" | "GREEN" | "GRAY";
  openNcCount: number;
  lastRevisionAt: string | null;
  standard: Standard;
  _count: { processLinks: number; documentLinks: number; evidenceLinks: number; findingLinks: number };
};

type MatrixRow = {
  key: string;
  code: string;
  sharedTitle: string | null;
  items: RequirementRow[];
  trafficLight: RequirementRow["trafficLight"];
  processLinks: number;
  documentLinks: number;
  evidenceLinks: number;
  openNcCount: number;
  lastRevisionAt: string | null;
  depth: number;
  hasDocGap: boolean;
};

type DepthMode = "chapters" | "level2" | "all";
type AttentionFilter = "" | "noEvidence" | "openNc" | "noReview" | "excluded" | "docGap";

const LIGHT: Record<RequirementRow["trafficLight"], { label: string; className: string }> = {
  GREEN: { label: "Con evidencias", className: "bg-emerald-100 text-emerald-800" },
  YELLOW: { label: "Sin evidencias", className: "bg-amber-100 text-amber-800" },
  RED: { label: "NC abiertas", className: "bg-red-100 text-red-800" },
  GRAY: { label: "No aplicable", className: "bg-slate-100 text-slate-600" },
};

const LIGHT_RANK: Record<RequirementRow["trafficLight"], number> = {
  RED: 0,
  YELLOW: 1,
  GREEN: 2,
  GRAY: 3,
};

const GAP_RE =
  /no est[aá] en biblioteca|no aparecen|falta |faltan |aún no|no est[aá] cargad|no aparece|brecha|cargar o|ausente/i;

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CR", { year: "numeric", month: "short", day: "2-digit" });
}

function clip(text: string | null | undefined, max = 160) {
  const t = text?.trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function shortNorma(code: string) {
  return code.replace(/^ISO_/, "");
}

function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesCompatible(a: string, b: string) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (longer.includes(shorter) && shorter.length >= 12) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length > 3));
  const wb = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return false;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  return inter / Math.min(wa.size, wb.size) >= 0.55;
}

function clauseDepth(code: string) {
  return code.split(".").filter(Boolean).length;
}

function compareClauseCodes(a: string, b: string): number {
  const pa = a.split(/[.\-_/]/).map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  });
  const pb = b.split(/[.\-_/]/).map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  });
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? -1;
    const db = pb[i] ?? -1;
    if (da !== db) return da - db;
  }
  return a.localeCompare(b, "es");
}

function maxIso(dates: Array<string | null>) {
  let best: number | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t > best) best = t;
  }
  return best == null ? null : new Date(best).toISOString();
}

function hasDocGap(row: RequirementRow) {
  return GAP_RE.test(row.observations ?? "") || GAP_RE.test(row.description ?? "");
}

/** Integra solo si el código y el título son compatibles (Anexo SL real). */
function buildMatrixRows(rows: RequirementRow[]): MatrixRow[] {
  const byCode = new Map<string, RequirementRow[]>();
  for (const row of rows) {
    const key = row.code.trim();
    const list = byCode.get(key);
    if (list) list.push(row);
    else byCode.set(key, [row]);
  }

  const result: MatrixRow[] = [];
  for (const [code, items] of byCode) {
    const sorted = [...items].sort((a, b) => a.standard.code.localeCompare(b.standard.code, "es"));
    const clusters: RequirementRow[][] = [];
    for (const item of sorted) {
      const cluster = clusters.find((c) => titlesCompatible(c[0].title, item.title));
      if (cluster) cluster.push(item);
      else clusters.push([item]);
    }
    for (const cluster of clusters) {
      const trafficLight = cluster.reduce<RequirementRow["trafficLight"]>((worst, item) => {
        return LIGHT_RANK[item.trafficLight] < LIGHT_RANK[worst] ? item.trafficLight : worst;
      }, cluster[0]?.trafficLight ?? "GRAY");
      result.push({
        key: cluster.map((i) => i.id).join("+"),
        code,
        sharedTitle: cluster.length > 1 ? cluster[0].title : null,
        items: cluster,
        trafficLight,
        processLinks: cluster.reduce((n, i) => n + i._count.processLinks, 0),
        documentLinks: cluster.reduce((n, i) => n + i._count.documentLinks, 0),
        evidenceLinks: cluster.reduce((n, i) => n + i._count.evidenceLinks, 0),
        openNcCount: cluster.reduce((n, i) => n + i.openNcCount, 0),
        lastRevisionAt: maxIso(cluster.map((i) => i.lastRevisionAt)),
        depth: clauseDepth(code),
        hasDocGap: cluster.some(hasDocGap),
      });
    }
  }

  return result.sort((a, b) => {
    const byCode = compareClauseCodes(a.code, b.code);
    if (byCode !== 0) return byCode;
    return (a.items[0]?.standard.code ?? "").localeCompare(b.items[0]?.standard.code ?? "", "es");
  });
}

function coverageLabel(row: MatrixRow) {
  const parts = [
    `${row.processLinks} proc.`,
    `${row.documentLinks} docs`,
    `${row.evidenceLinks} evid.`,
    `${row.openNcCount} NC`,
  ];
  return parts.join(" · ");
}

const TH =
  "sticky top-14 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]";

export default function SigRequisitosPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [standardId, setStandardId] = useState("");
  const [applicableOnly, setApplicableOnly] = useState(true);
  const [depthMode, setDepthMode] = useState<DepthMode>("level2");
  const [attention, setAttention] = useState<AttentionFilter>("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState<{ standardId: string; label: string } | null>(null);
  const [editRow, setEditRow] = useState<RequirementRow | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    observations: "",
    isApplicable: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: standards = [] } = useQuery({
    queryKey: ["sig-standards"],
    queryFn: async () => {
      const r = await fetch("/api/sig/requirements?standards=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando normas");
      const json = await r.json();
      return (Array.isArray(json.data) ? json.data : []) as Standard[];
    },
  });

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["sig-requirements", q, standardId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (standardId) params.set("standardId", standardId);
      const r = await fetch(`/api/sig/requirements?${params}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error cargando requisitos");
      const json = await r.json();
      return (Array.isArray(json.data) ? json.data : []) as RequirementRow[];
    },
  });

  const normaStandards = useMemo(
    () => standards.filter((s) => s.code === "ISO_9001" || s.code === "ISO_18788"),
    [standards]
  );

  const stats = useMemo(() => {
    const applicable = rows.filter((r) => r.isApplicable && !isStructuralRequirement(r));
    return {
      total: rows.length,
      applicable: applicable.length,
      green: applicable.filter((r) => r.trafficLight === "GREEN").length,
      yellow: applicable.filter((r) => r.trafficLight === "YELLOW").length,
      red: applicable.filter((r) => r.trafficLight === "RED").length,
      excluded: rows.filter((r) => !r.isApplicable || isStructuralRequirement(r)).length,
      docGaps: rows.filter((r) => r.isApplicable && !isStructuralRequirement(r) && hasDocGap(r)).length,
      noReview: applicable.filter((r) => !r.lastRevisionAt).length,
    };
  }, [rows]);

  const matrixRows = useMemo(() => {
    let list = rows;
    if (applicableOnly && attention !== "excluded") {
      list = list.filter((r) => r.isApplicable && !isStructuralRequirement(r));
    }
    if (attention === "noEvidence") {
      list = list.filter((r) => r.isApplicable && !isStructuralRequirement(r) && r.trafficLight === "YELLOW");
    } else if (attention === "openNc") {
      list = list.filter(
        (r) => (r.openNcCount > 0 || r.trafficLight === "RED") && !isStructuralRequirement(r)
      );
    } else if (attention === "noReview") {
      list = list.filter((r) => r.isApplicable && !isStructuralRequirement(r) && !r.lastRevisionAt);
    } else if (attention === "excluded") {
      list = list.filter((r) => !r.isApplicable || isStructuralRequirement(r));
    } else if (attention === "docGap") {
      list = list.filter((r) => !isStructuralRequirement(r) && hasDocGap(r));
    }

    const built = buildMatrixRows(list);
    const maxDepth = depthMode === "chapters" ? 1 : depthMode === "level2" ? 2 : 99;

    return built.filter((row) => {
      if (row.depth <= maxDepth) return true;
      for (const prefix of expanded) {
        if (row.code === prefix || row.code.startsWith(`${prefix}.`)) return true;
      }
      return false;
    });
  }, [rows, applicableOnly, attention, depthMode, expanded]);

  function toggleExpand(code: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function openPdfViewer(std: Standard) {
    setPdfError(null);
    if (!std.hasPdf) {
      setPdfError(`Primero suba el PDF oficial de ${shortNorma(std.code)}.`);
      return;
    }
    setPdfViewer({ standardId: std.id, label: shortNorma(std.code) });
  }

  async function onUploadPdf(std: Standard, file: File | null) {
    if (!file) return;
    setUploadingId(std.id);
    setPdfError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const r = await fetch(`/api/sig/standards/${std.id}/pdf`, { method: "POST", body });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo subir el PDF");
      await qc.invalidateQueries({ queryKey: ["sig-standards"] });
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Error subiendo PDF");
    } finally {
      setUploadingId(null);
      const input = uploadRefs.current[std.id];
      if (input) input.value = "";
    }
  }

  function startEdit(item: RequirementRow) {
    setEditRow(item);
    setEditForm({
      description: item.description ?? "",
      observations: item.observations ?? "",
      isApplicable: item.isApplicable,
    });
    setEditError(null);
  }

  async function saveEdit() {
    if (!editRow) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const r = await fetch(`/api/sig/requirements/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editForm.description.trim() || null,
          observations: editForm.observations.trim() || null,
          isApplicable: editForm.isApplicable,
          touchReviewed: true,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo guardar");
      await qc.invalidateQueries({ queryKey: ["sig-requirements"] });
      setEditRow(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingEdit(false);
    }
  }

  const canExpandMore = depthMode !== "all";

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title="Matriz de requisitos SIG" />

      <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
            {stats.applicable} aplicables
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-800 ring-1 ring-emerald-100">
            {stats.green} con evidencias
          </span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900 ring-1 ring-amber-100">
            {stats.yellow} sin evidencias
          </span>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-800 ring-1 ring-red-100">
            {stats.red} NC
          </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
              {stats.excluded} excl. / estructura
            </span>
          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-900 ring-1 ring-orange-100">
            {stats.docGaps} con brecha doc.
          </span>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-3 md:grid-cols-6">
            <div className="space-y-1 md:col-span-2">
              <Label>Buscar</Label>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Código, título u observación"
              />
            </div>
            <div className="space-y-1">
              <Label>Norma</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={standardId}
                onChange={(e) => setStandardId(e.target.value)}
              >
                <option value="">Todas (integradas)</option>
                {standards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nivel</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={depthMode}
                onChange={(e) => {
                  setDepthMode(e.target.value as DepthMode);
                  setExpanded(new Set());
                }}
              >
                  <option value="chapters">Solo títulos de capítulo (estructura)</option>
                  <option value="level2">Hasta 2.º nivel (4.1)</option>
                  <option value="all">Todo el detalle</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Atención</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={attention}
                  onChange={(e) => setAttention(e.target.value as AttentionFilter)}
                >
                  <option value="">Todas</option>
                  <option value="noEvidence">Sin evidencias</option>
                  <option value="openNc">NC abiertas</option>
                  <option value="noReview">Sin fecha de revisión</option>
                  <option value="docGap">Brecha de documento</option>
                  <option value="excluded">Exclusiones y estructura</option>
                </select>
              </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applicableOnly}
                  disabled={attention === "excluded"}
                  onChange={(e) => setApplicableOnly(e.target.checked)}
                />
                Solo aplicables
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-slate-700">PDF de las normas</span>
              {normaStandards.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={s.hasPdf ? "default" : "outline"}
                    disabled={!s.hasPdf}
                    onClick={() => openPdfViewer(s)}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    {shortNorma(s.code)}
                    {s.hasPdf ? "" : " (sin PDF)"}
                  </Button>
                  <input
                    ref={(el) => {
                      uploadRefs.current[s.id] = el;
                    }}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => void onUploadPdf(s, e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploadingId === s.id}
                    onClick={() => uploadRefs.current[s.id]?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingId === s.id ? "Subiendo…" : s.hasPdf ? "Reemplazar" : "Subir"}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!normaStandards.some((s) => s.hasPdf)}
                onClick={() => {
                  const first = normaStandards.find((s) => s.hasPdf);
                  if (first) openPdfViewer(first);
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Ver PDF
              </Button>
              <Link href="/sig" className="text-sm text-red-700 hover:underline">
                Ir a biblioteca
              </Link>
            </div>
            <p className="text-xs text-slate-500">
              El visor abre una norma a la vez (evita el bloqueo de ventanas). En cada fila puede abrir
              el PDF de esa norma. Las cláusulas solo se agrupan si el título es compatible; 8.5/8.7/10.x
              de 9001 y 18788 salen por separado.
            </p>
            {pdfError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pdfError}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        <Card className="overflow-visible">
          <CardContent className="overflow-visible p-0">
            <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className={TH}>Estado</th>
                  <th className={TH}>Código</th>
                  <th className={`${TH} min-w-[300px]`}>Requisito</th>
                  <th className={`${TH} min-w-[220px]`}>Observaciones</th>
                  <th className={`${TH} whitespace-nowrap`}>Cobertura</th>
                  <th className={`${TH} whitespace-nowrap`}>Últ. revisión</th>
                  <th className={TH}> </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      Cargando matriz...
                    </td>
                  </tr>
                )}
                {!isLoading && matrixRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      Sin requisitos con estos filtros.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  matrixRows.map((group) => {
                    const structural = group.items.every((i) => isStructuralRequirement(i));
                    const light = structural
                      ? { label: "Estructura", className: "bg-slate-100 text-slate-600" }
                      : LIGHT[group.trafficLight];
                    const primary = group.items[0];
                    const showExpand =
                      canExpandMore &&
                      group.depth === (depthMode === "chapters" ? 1 : 2) &&
                      rows.some(
                        (r) =>
                          r.code.startsWith(`${group.code}.`) &&
                          (!standardId || r.standard.id === primary.standard.id)
                      );
                    return (
                      <tr key={group.key} className="align-top hover:bg-slate-50">
                        <td className="border-t px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${light.className}`}>
                            {light.label}
                          </span>
                          {group.hasDocGap && (
                            <div className="mt-1 text-[11px] font-medium text-orange-700">Brecha doc.</div>
                          )}
                          {group.items.length > 1 && (
                            <div className="mt-1 space-y-0.5">
                              {group.items.map((item) => (
                                <div key={item.id} className="text-[11px] text-slate-500">
                                  {shortNorma(item.standard.code)}:{" "}
                                  {isStructuralRequirement(item)
                                    ? "Estructura"
                                    : LIGHT[item.trafficLight].label}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="border-t px-3 py-2 font-medium">
                          <div className="flex items-center gap-1">
                            {showExpand && (
                              <button
                                type="button"
                                className="rounded px-1 text-slate-500 hover:bg-slate-200"
                                onClick={() => toggleExpand(group.code)}
                                title={expanded.has(group.code) ? "Contraer" : "Expandir hijos"}
                              >
                                {expanded.has(group.code) ? "▾" : "▸"}
                              </button>
                            )}
                            <span className="text-red-700">{group.code}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {group.items.map((item) => (
                              <span
                                key={item.id}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                              >
                                {shortNorma(item.standard.code)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border-t px-3 py-2">
                          <div className="space-y-2">
                            {group.items.map((item) => {
                              const std = normaStandards.find((s) => s.id === item.standard.id);
                              return (
                                <div
                                  key={item.id}
                                  className="rounded-md border border-slate-200 bg-white px-2.5 py-2"
                                >
                                  <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                      {shortNorma(item.standard.code)}
                                    </span>
                                    <Link
                                      href={`/sig/requisitos/${item.id}`}
                                      className="text-sm font-medium text-slate-900 hover:text-red-700 hover:underline"
                                    >
                                      {item.title}
                                    </Link>
                                  </div>
                                  <p className="text-xs leading-relaxed text-slate-600" title={item.description ?? undefined}>
                                    {clip(item.description, 200)}
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 text-red-700 hover:underline"
                                      onClick={() => startEdit(item)}
                                    >
                                      <Pencil className="h-3 w-3" /> Editar
                                    </button>
                                    <Link
                                      href={`/sig/requisitos/${item.id}`}
                                      className="inline-flex items-center gap-1 text-slate-600 hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" /> Detalle
                                    </Link>
                                    {std?.hasPdf && (
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 text-slate-600 hover:underline"
                                        onClick={() => openPdfViewer(std)}
                                      >
                                        <FileText className="h-3 w-3" /> Ver en la norma
                                      </button>
                                    )}
                                    {hasDocGap(item) && (
                                      <Link href="/sig" className="text-orange-700 hover:underline">
                                        Ir a biblioteca
                                      </Link>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="border-t px-3 py-2">
                          <div className="space-y-2">
                            {group.items.map((item) => (
                              <div key={item.id} className="text-xs text-slate-600">
                                {group.items.length > 1 && (
                                  <div className="mb-0.5 font-medium text-slate-800">
                                    {shortNorma(item.standard.code)}
                                  </div>
                                )}
                                <p title={item.observations ?? undefined}>{clip(item.observations, 160)}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="border-t px-3 py-2 whitespace-nowrap text-xs text-slate-700">
                          <Link
                            href={`/sig/requisitos/${primary.id}`}
                            className={cn(
                              "hover:underline",
                              group.openNcCount > 0 ? "text-red-700 font-medium" : "text-slate-700"
                            )}
                          >
                            {coverageLabel(group)}
                          </Link>
                          {group.openNcCount > 0 && (
                            <div className="mt-1">
                              <Badge variant="danger">{group.openNcCount} NC</Badge>
                            </div>
                          )}
                        </td>
                        <td className="border-t px-3 py-2 whitespace-nowrap text-slate-600">
                          {formatDate(group.lastRevisionAt)}
                        </td>
                        <td className="border-t px-3 py-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(primary)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Editar {editRow ? `${shortNorma(editRow.standard.code)} ${editRow.code}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{editRow.title}</p>
              <div className="space-y-1">
                <Label>Requisito esperado</Label>
                <Textarea
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea
                  rows={5}
                  value={editForm.observations}
                  onChange={(e) => setEditForm((f) => ({ ...f, observations: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.isApplicable}
                  onChange={(e) => setEditForm((f) => ({ ...f, isApplicable: e.target.checked }))}
                />
                Requisito aplicable al alcance
              </label>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={savingEdit} onClick={() => void saveEdit()}>
              {savingEdit ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pdfViewer} onOpenChange={(open) => !open && setPdfViewer(null)}>
        <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Norma PDF
              <div className="flex gap-1">
                {normaStandards
                  .filter((s) => s.hasPdf)
                  .map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      size="sm"
                      variant={pdfViewer?.standardId === s.id ? "default" : "outline"}
                      onClick={() => setPdfViewer({ standardId: s.id, label: shortNorma(s.code) })}
                    >
                      {shortNorma(s.code)}
                    </Button>
                  ))}
              </div>
            </DialogTitle>
          </DialogHeader>
          {pdfViewer && (
            <iframe
              title={`PDF ${pdfViewer.label}`}
              src={`/api/sig/standards/${pdfViewer.standardId}/pdf?inline=1`}
              className="min-h-0 w-full flex-1 rounded-md border border-slate-200 bg-slate-50"
            />
          )}
          <DialogFooter>
            {pdfViewer && (
              <a
                href={`/api/sig/standards/${pdfViewer.standardId}/pdf?inline=0`}
                className="text-sm text-red-700 hover:underline"
                download
              >
                Descargar archivo
              </a>
            )}
            <Button type="button" variant="outline" onClick={() => setPdfViewer(null)}>
              <X className="mr-1 h-4 w-4" /> Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
