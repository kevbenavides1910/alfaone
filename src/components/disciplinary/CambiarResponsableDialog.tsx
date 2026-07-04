"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface CambiarResponsableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apercibimiento: {
    id: string;
    numero: string;
    codigoEmpleado: string;
    nombreEmpleado: string;
  } | null;
}

type EmployeeResult = {
  codigoEmpleado: string;
  nombre: string | null;
  cedula: string | null;
  email: string | null;
  zona: string | null;
};

export function CambiarResponsableDialog({
  open,
  onOpenChange,
  apercibimiento,
}: CambiarResponsableDialogProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EmployeeResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (apercibimiento) {
      setSearch("");
      setSelected(null);
      setShowDropdown(false);
    }
  }, [apercibimiento]);

  const { data: searchResults, isFetching } = useQuery<EmployeeResult[]>({
    queryKey: ["disciplinary-employee-search", search],
    queryFn: () =>
      fetch(`/api/disciplinary/empleados/search?q=${encodeURIComponent(search)}&limit=10`).then((r) => r.json()).then((d) => d.data),
    enabled: search.trim().length >= 2,
  });

  const results = searchResults ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!apercibimiento || !selected) throw new Error("Seleccione un empleado");
      const res = await fetch(`/api/disciplinary/apercibimientos/${apercibimiento.id}/cambiar-responsable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoEmpleado: selected.codigoEmpleado }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al reasignar apercibimiento");
      return json;
    },
    onSuccess: (data) => {
      const msg = data.emailSent
        ? "Apercibimiento reasignado y correo enviado al nuevo empleado"
        : data.reason === "sin_correo"
          ? "Apercibimiento reasignado (el nuevo empleado no tiene correo registrado)"
          : "Apercibimiento reasignado (no se pudo enviar el correo)";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["disciplinary-list"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["disciplinary-detail"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!apercibimiento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasignar apercibimiento · {apercibimiento.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Empleado actual</label>
            <div className="text-sm text-slate-600 bg-muted px-3 py-2 rounded-md">
              <span className="font-mono">{apercibimiento.codigoEmpleado}</span>
              {" · "}
              {apercibimiento.nombreEmpleado}
            </div>
          </div>

          <div className="relative">
            <label className="text-sm font-medium block mb-1">Buscar nuevo empleado *</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelected(null);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Buscar por código, nombre o cédula…"
                className="pl-8"
              />
            </div>
            {isFetching && (
              <div className="text-xs text-slate-400 mt-1">Buscando…</div>
            )}
            {showDropdown && results.length > 0 && search.trim().length >= 2 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto"
              >
                {results.map((emp) => (
                  <button
                    key={emp.codigoEmpleado}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors border-b border-slate-100 last:border-0",
                      selected?.codigoEmpleado === emp.codigoEmpleado && "bg-amber-50"
                    )}
                    onClick={() => {
                      setSelected(emp);
                      setSearch(`${emp.codigoEmpleado} — ${emp.nombre ?? ""}`);
                      setShowDropdown(false);
                    }}
                  >
                    <div className="font-medium">
                      <span className="font-mono">{emp.codigoEmpleado}</span>
                      {" — "}
                      {emp.nombre ?? "(sin nombre)"}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {emp.cedula && <span>Cédula: {emp.cedula}</span>}
                      {emp.email && <span className="ml-2">Correo: {emp.email}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && search.trim().length >= 2 && results.length === 0 && !isFetching && (
              <div className="text-xs text-slate-400 mt-1">Sin resultados</div>
            )}
          </div>

          {selected && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
              <div className="font-medium">Empleado seleccionado</div>
              <div className="text-xs mt-0.5">
                <span className="font-mono">{selected.codigoEmpleado}</span>
                {" — "}
                {selected.nombre ?? "(sin nombre)"}
                {selected.email && <span className="ml-2">· {selected.email}</span>}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500">
            Se reasignará el apercibimiento al nuevo empleado y se reenviará el correo.
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selected || mutation.isPending}
          >
            {mutation.isPending ? "Guardando…" : "Reasignar y enviar correo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
