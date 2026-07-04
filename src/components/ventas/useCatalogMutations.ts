"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CatalogSection } from "@/modules/ventas";

export function useGlobalCatalogMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto-parametros"] });

  const addLine = useMutation({
    mutationFn: async (payload: { section: CatalogSection; item: Record<string, string | number> }) => {
      const res = await fetch("/api/ventas/presupuestos/parametros", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al agregar");
    },
    onSuccess: invalidate,
  });

  const deleteLine = useMutation({
    mutationFn: async (payload: { section: CatalogSection; codigo: string }) => {
      const res = await fetch("/api/ventas/presupuestos/parametros", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: invalidate,
  });

  return { addLine, deleteLine };
}

export function usePresupuestoCatalogMutations(presupuestoId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto", presupuestoId] });

  const addLine = useMutation({
    mutationFn: async (payload: { section: CatalogSection; item: Record<string, string | number> }) => {
      const res = await fetch(`/api/ventas/presupuestos/${presupuestoId}/catalogo`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al agregar");
    },
    onSuccess: invalidate,
  });

  const deleteLine = useMutation({
    mutationFn: async (payload: { section: CatalogSection; codigo: string }) => {
      const res = await fetch(`/api/ventas/presupuestos/${presupuestoId}/catalogo`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: invalidate,
  });

  return { addLine, deleteLine };
}
