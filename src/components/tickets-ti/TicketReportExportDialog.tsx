"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarDateInput } from "@/components/ui/calendar-date-input";
import { toast } from "@/components/ui/toaster";
import { TICKET_EXPORT_STATUS_GROUPS, type TicketExportStatusGroupKey } from "@/modules/tickets-ti/business/report-status-groups";

type Person = { id: string; name: string; email: string };

const GROUP_KEYS = Object.keys(TICKET_EXPORT_STATUS_GROUPS) as TicketExportStatusGroupKey[];

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TicketReportExportDialog() {
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(todayIso);
  const [filterType, setFilterType] = useState<"technician" | "user">("user");
  const [personId, setPersonId] = useState("");
  const [statusGroups, setStatusGroups] = useState<TicketExportStatusGroupKey[]>([
    "ABIERTO",
    "PROCESO",
    "CERRADO",
  ]);
  const [exporting, setExporting] = useState(false);

  const { data: peopleData } = useQuery<{ data: Person[] }>({
    queryKey: ["tickets-ti-export-people"],
    enabled: open,
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/technicians");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const people = peopleData?.data ?? [];

  function toggleStatus(group: TicketExportStatusGroupKey) {
    setStatusGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  }

  async function handleExport() {
    if (!dateFrom || !dateTo) {
      toast.error("Indique el rango de fechas");
      return;
    }
    if (statusGroups.length === 0) {
      toast.error("Seleccione al menos un estado");
      return;
    }

    setExporting(true);
    try {
      const qs = new URLSearchParams({
        dateFrom,
        dateTo,
        filterType,
        statusGroups: statusGroups.join(","),
      });
      if (personId) qs.set("personId", personId);

      const r = await fetch(`/api/tickets-ti/reports/export?${qs.toString()}`);
      if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "No se pudo generar el reporte");
      }

      const blob = await r.blob();
      const disposition = r.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `tickets_${dateFrom}_${dateTo}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`Reporte descargado (${filename})`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Extraer reportes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Extraer reportes</DialogTitle>
          <DialogDescription>
            Exporte tickets a Excel filtrando por fechas, persona y estado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Desde</Label>
              <CalendarDateInput value={dateFrom} onChange={setDateFrom} showPicker />
            </div>
            <div className="space-y-1.5">
              <Label>Hasta</Label>
              <CalendarDateInput value={dateTo} onChange={setDateTo} showPicker />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Filtrar por</Label>
            <select
              className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as "technician" | "user");
                setPersonId("");
              }}
            >
              <option value="user">Usuario (solicitante)</option>
              <option value="technician">Técnico asignado</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{filterType === "technician" ? "Técnico" : "Usuario"}</Label>
            <select
              className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm"
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
            >
              <option value="">Todos</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Estado del ticket</Label>
            <div className="flex flex-wrap gap-3">
              {GROUP_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={statusGroups.includes(key)}
                    onChange={() => toggleStatus(key)}
                  />
                  {TICKET_EXPORT_STATUS_GROUPS[key].label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={exporting}>
            Cancelar
          </Button>
          <Button type="button" className="gap-2" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Descargar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
