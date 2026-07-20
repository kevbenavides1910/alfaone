"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useOpFiltros } from "./use-op-filtros";

export type OpFilterState = {
  q: string;
  noCiaGrupo: string;
  noContrato: string;
  noUbicacion: string;
  semanaPgr: string;
  estado: string;
};

type Props = {
  value: OpFilterState;
  onChange: (next: OpFilterState) => void;
  onSearch: () => void;
  showSemanaPgr?: boolean;
  showEstado?: boolean;
  showQ?: boolean;
  extra?: ReactNode;
};

export const DEFAULT_OP_FILTERS: OpFilterState = {
  q: "",
  noCiaGrupo: "",
  noContrato: "",
  noUbicacion: "",
  semanaPgr: "",
  estado: "A",
};

export function OpFiltersBar({
  value,
  onChange,
  onSearch,
  showSemanaPgr = true,
  showEstado = true,
  showQ = true,
  extra,
}: Props) {
  const filtros = useOpFiltros({
    noCiaGrupo: value.noCiaGrupo || undefined,
    noContrato: value.noContrato || undefined,
  });

  const patch = (partial: Partial<OpFilterState>) => onChange({ ...value, ...partial });

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
      {showQ ? (
        <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Nombre / buscar
          <Input
            value={value.q}
            placeholder="Nombre empleado, rol, contrato…"
            onChange={(e) => patch({ q: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
        </label>
      ) : null}

      <label className="flex min-w-[120px] flex-col gap-1 text-xs font-medium text-gray-600">
        Cia grupo
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value.noCiaGrupo}
          onChange={(e) =>
            patch({ noCiaGrupo: e.target.value, noContrato: "", noUbicacion: "" })
          }
        >
          <option value="">Todas</option>
          {(filtros.data?.companies ?? []).map((c) => (
            <option key={c.noCiaGrupo} value={c.noCiaGrupo}>
              {c.noCiaGrupo}
              {c.nombreGrupo ? ` — ${c.nombreGrupo}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-gray-600">
        Contrato
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value.noContrato}
          onChange={(e) => patch({ noContrato: e.target.value, noUbicacion: "" })}
        >
          <option value="">Todos</option>
          {(filtros.data?.contratos ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-gray-600">
        Ubicación
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={value.noUbicacion}
          onChange={(e) => patch({ noUbicacion: e.target.value })}
        >
          <option value="">Todas</option>
          {(filtros.data?.ubicaciones ?? []).map((u) => (
            <option key={u.noUbicacion} value={u.noUbicacion}>
              {u.noUbicacion}
              {u.nombre ? ` — ${u.nombre}` : ""}
            </option>
          ))}
        </select>
      </label>

      {showSemanaPgr ? (
        <label className="flex w-24 flex-col gap-1 text-xs font-medium text-gray-600">
          Semana PGR
          <Input
            value={value.semanaPgr}
            placeholder="0-4"
            onChange={(e) => patch({ semanaPgr: e.target.value })}
          />
        </label>
      ) : null}

      {showEstado ? (
        <label className="flex w-28 flex-col gap-1 text-xs font-medium text-gray-600">
          Estado
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={value.estado}
            onChange={(e) => patch({ estado: e.target.value })}
          >
            <option value="A">Activo</option>
            <option value="I">Inactivo</option>
            <option value="P">Pendiente</option>
            <option value="*">Todos</option>
          </select>
        </label>
      ) : null}

      {extra}

      <Button type="button" onClick={onSearch} className="bg-red-600 hover:bg-red-700">
        Filtrar
      </Button>
    </div>
  );
}
