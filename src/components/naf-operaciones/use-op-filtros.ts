"use client";

import { useQuery } from "@tanstack/react-query";

export type OpFiltrosData = {
  companies: { noCiaGrupo: string; nombreGrupo: string | null }[];
  currentWeek: {
    ano: number;
    semana: number;
    fecha1: string | null;
    fecha2: string | null;
  } | null;
  weeks: {
    ano: number;
    semana: number;
    fecha1: string | null;
    fecha2: string | null;
  }[];
  contratos: string[];
  ubicaciones: { noUbicacion: string; nombre: string | null }[];
  dbaChecklist?: string[];
};

export function useOpFiltros(params?: {
  noCiaGrupo?: string;
  noContrato?: string;
  enabled?: boolean;
}) {
  const noCiaGrupo = params?.noCiaGrupo ?? "";
  const noContrato = params?.noContrato ?? "";
  const enabled = params?.enabled ?? true;

  return useQuery({
    queryKey: ["naf-operaciones", "filtros", noCiaGrupo, noContrato],
    enabled,
    queryFn: async (): Promise<OpFiltrosData> => {
      const sp = new URLSearchParams();
      if (noCiaGrupo) sp.set("noCiaGrupo", noCiaGrupo);
      if (noContrato) sp.set("noContrato", noContrato);
      const res = await fetch(`/api/naf-operaciones/filtros?${sp}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "No se pudieron cargar filtros OP");
      }
      const json = await res.json();
      return json.data as OpFiltrosData;
    },
    staleTime: 60_000,
  });
}
