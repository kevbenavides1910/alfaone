"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, BookOpen, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { RecorridosPageHeader } from "@/components/recorridos/RecorridosPageHeader";
import { formatDateTime } from "@/lib/utils/format";

type BitacoraEntry = {
  id: string;
  imei: string;
  employeeCode: string;
  description: string;
  routeCode: string | null;
  incidentAt: string;
  imagePath: string | null;
  source: string;
  isLinked: boolean;
  linkedOmissionKey: string | null;
  justification: {
    id: string;
    routeCode: string;
    pointLabel: string;
    fecha: string;
  } | null;
};

type OmissionOption = {
  omissionKey: string;
  fecha: string;
  deviceId: string;
  routeId: string;
  routePointId: string;
  routeCode: string;
  routeName: string;
  pointLabel: string;
  nfcTagCode: string;
  imei: string;
  employeeCode: string;
};

function todayIsoCostaRica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function incidentDateCr(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export default function RecorridosBitacoraPage() {
  const qc = useQueryClient();
  const [desde, setDesde] = useState(todayIsoCostaRica());
  const [hasta, setHasta] = useState(todayIsoCostaRica());
  const [imei, setImei] = useState("");
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<BitacoraEntry | null>(null);
  const [selectedOmissionKey, setSelectedOmissionKey] = useState("");

  const queryKey = useMemo(
    () => ["patrol-bitacora", desde, hasta, imei.trim(), unlinkedOnly],
    [desde, hasta, imei, unlinkedOnly],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{ data: BitacoraEntry[]; error?: { message: string } }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ desde, hasta });
      if (imei.trim()) params.set("imei", imei.trim());
      if (unlinkedOnly) params.set("unlinkedOnly", "1");
      const r = await fetch(`/api/admin/patrol/bitacora?${params}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message || "Error al consultar bitácora");
      return json;
    },
    enabled: Boolean(desde && hasta),
  });

  const linkFecha = selectedEntry ? incidentDateCr(selectedEntry.incidentAt) : "";

  const { data: omissionsData } = useQuery<{ data: OmissionOption[] }>({
    queryKey: ["patrol-omissions-link", linkFecha, selectedEntry?.imei],
    queryFn: () => {
      const params = new URLSearchParams({ fecha: linkFecha });
      if (selectedEntry?.imei) params.set("imei", selectedEntry.imei);
      return fetch(`/api/admin/patrol/justifications/link?${params}`).then((r) => r.json());
    },
    enabled: linkOpen && Boolean(linkFecha),
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      const omission = omissionsData?.data?.find((o) => o.omissionKey === selectedOmissionKey);
      if (!selectedEntry || !omission) throw new Error("Seleccione una omisión");

      const res = await fetch("/api/admin/patrol/justifications/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bitacoraEntryId: selectedEntry.id,
          omissionKey: omission.omissionKey,
          fecha: omission.fecha,
          deviceId: omission.deviceId,
          routeId: omission.routeId,
          routePointId: omission.routePointId,
          routeCode: omission.routeCode,
          pointLabel: omission.pointLabel,
          nfcTagCode: omission.nfcTagCode,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "No se pudo ligar");
      }
    },
    onSuccess: () => {
      toast.success("Bitácora ligada a la omisión");
      setLinkOpen(false);
      setSelectedEntry(null);
      setSelectedOmissionKey("");
      qc.invalidateQueries({ queryKey: ["patrol-bitacora"] });
      qc.invalidateQueries({ queryKey: ["patrol-marks-compliance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = data?.data ?? [];
  const omissionOptions = omissionsData?.data ?? [];

  function openLink(entry: BitacoraEntry) {
    setSelectedEntry(entry);
    setSelectedOmissionKey("");
    setLinkOpen(true);
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      <RecorridosPageHeader
        icon={BookOpen}
        title="Bitácora digital"
        description="Justificaciones enviadas desde la app Alfa One. Líguelas a omisiones de marca en un clic."
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Desde</Label>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Hasta</Label>
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-slate-500">IMEI (opcional)</Label>
              <Input value={imei} onChange={(e) => setImei(e.target.value)} placeholder="000000000000001" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unlinkedOnly}
                onChange={(e) => setUnlinkedOnly(e.target.checked)}
                className="rounded border-input h-4 w-4 accent-primary"
              />
              Solo sin ligar a omisión
            </label>
            <Button onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Consultando…" : "Consultar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-3 p-4">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400">Cargando entradas…</div>
            ) : isError ? (
              <div className="py-12 text-center text-red-600">{(error as Error)?.message ?? "Error al cargar."}</div>
            ) : entries.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No hay entradas en el periodo seleccionado.
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="rounded-md border px-3 py-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium">
                        {formatDateTime(entry.incidentAt)} · IMEI {entry.imei}
                      </p>
                      <p className="text-muted-foreground">
                        Empleado {entry.employeeCode}
                        {entry.routeCode ? ` · Ruta ${entry.routeCode}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{entry.description}</p>
                      {entry.imagePath ? (
                        <a
                          href={entry.imagePath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline inline-block mt-1"
                        >
                          Ver foto adjunta
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {entry.isLinked ? (
                        <Badge variant="success">Ligada</Badge>
                      ) : (
                        <Badge variant="secondary">Sin ligar</Badge>
                      )}
                      {!entry.isLinked ? (
                        <Button size="sm" variant="outline" onClick={() => openLink(entry)}>
                          <Link2 className="h-3 w-3 mr-1" />
                          Ligar a omisión
                        </Button>
                      ) : entry.justification ? (
                        <p className="text-xs text-muted-foreground text-right">
                          {entry.justification.fecha} · {entry.justification.routeCode} /{" "}
                          {entry.justification.pointLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ligar bitácora a omisión</DialogTitle>
          </DialogHeader>
          {selectedEntry ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">{selectedEntry.description}</p>
              <div>
                <Label>Omisión del mismo día ({linkFecha})</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
                  value={selectedOmissionKey}
                  onChange={(e) => setSelectedOmissionKey(e.target.value)}
                >
                  <option value="">Seleccione omisión…</option>
                  {omissionOptions.map((o) => (
                    <option key={o.omissionKey} value={o.omissionKey}>
                      {o.routeCode} — {o.pointLabel} (tag {o.nfcTagCode})
                    </option>
                  ))}
                </select>
                {omissionOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    No hay omisiones pendientes de justificar para este IMEI en esa fecha.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => linkMutation.mutate()}
              disabled={!selectedOmissionKey || linkMutation.isPending}
            >
              Ligar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
