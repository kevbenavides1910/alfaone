"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { companyDisplayName } from "@/lib/utils/constants";
import type { CompanyRow } from "@/lib/hooks/use-companies";

export type DeferredContractDraft = string[] | "all";

export type DeferredSelectorContract = {
  id: string;
  client: string;
  licitacionNo: string;
  company: string;
};

export function contractIncludedInDeferredDraft(
  draft: DeferredContractDraft,
  contractId: string,
  allActiveIds: string[]
): boolean {
  if (allActiveIds.length === 0) return false;
  if (draft === "all") return true;
  return draft.includes(contractId);
}

/**
 * Permite quedar con 0 contratos en el draft para que el usuario arme su selección
 * manualmente. La validación de "al menos uno" se hace al guardar.
 */
export function toggleDeferredDraft(
  draft: DeferredContractDraft,
  contractId: string,
  allActiveIds: string[]
): DeferredContractDraft {
  if (allActiveIds.length === 0) return draft;
  if (draft === "all") {
    const next = allActiveIds.filter((id) => id !== contractId);
    return next;
  }
  const set = new Set(draft);
  if (set.has(contractId)) {
    set.delete(contractId);
    const arr = allActiveIds.filter((id) => set.has(id));
    if (arr.length === 0) return [];
    if (arr.length === allActiveIds.length) return "all";
    return arr;
  }
  set.add(contractId);
  const arr = allActiveIds.filter((id) => set.has(id));
  if (arr.length === allActiveIds.length) return "all";
  return arr;
}

/** True si el draft tiene al menos un contrato seleccionado. */
export function draftHasSelection(draft: DeferredContractDraft): boolean {
  if (draft === "all") return true;
  return draft.length > 0;
}

/** Normaliza lo que vino del backend (array vacío = todos) a un DeferredContractDraft. */
export function draftFromServer(ids: string[] | null | undefined): DeferredContractDraft {
  if (!ids || ids.length === 0) return "all";
  return [...ids];
}

function applyDraftChange(
  draft: DeferredContractDraft,
  allIds: string[],
  mutate: (currentIds: Set<string>) => void
): DeferredContractDraft {
  const current = new Set(draft === "all" ? allIds : draft);
  mutate(current);
  const sorted = allIds.filter((id) => current.has(id));
  if (sorted.length === 0) return [];
  if (sorted.length === allIds.length) return "all";
  return sorted;
}

export function DeferredContractSelector({
  contracts,
  allIds,
  draft,
  onChange,
  companyRows,
  listClassName,
  readOnly = false,
}: {
  contracts: DeferredSelectorContract[];
  allIds: string[];
  draft: DeferredContractDraft;
  onChange: (next: DeferredContractDraft) => void;
  companyRows: CompanyRow[];
  listClassName?: string;
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const companyContractIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of contracts) {
      if (!c.company) continue;
      const list = map.get(c.company) ?? [];
      list.push(c.id);
      map.set(c.company, list);
    }
    return map;
  }, [contracts]);

  const availableCompanies = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of contracts) {
      if (!c.company) continue;
      if (!seen.has(c.company)) {
        seen.set(c.company, companyDisplayName(c.company, companyRows) ?? c.company);
      }
    }
    return Array.from(seen.entries())
      .map(([code, label]) => ({ code, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [contracts, companyRows]);

  const companyInclusionState = (code: string): "all" | "partial" | "none" => {
    const ids = companyContractIds.get(code) ?? [];
    if (ids.length === 0) return "all";
    const included = ids.filter((id) => contractIncludedInDeferredDraft(draft, id, allIds)).length;
    if (included === 0) return "none";
    if (included === ids.length) return "all";
    return "partial";
  };

  const setCompanyIncluded = (code: string, included: boolean) => {
    const ids = companyContractIds.get(code) ?? [];
    if (ids.length === 0) return;
    onChange(
      applyDraftChange(draft, allIds, (current) => {
        if (included) ids.forEach((id) => current.add(id));
        else ids.forEach((id) => current.delete(id));
      })
    );
  };

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      if (!q) return true;
      const comp = companyDisplayName(c.company, companyRows) ?? "";
      return (
        c.client.toLowerCase().includes(q) ||
        c.licitacionNo.toLowerCase().includes(q) ||
        comp.toLowerCase().includes(q)
      );
    });
  }, [contracts, q, companyRows]);

  const selectedCount = draft === "all" ? allIds.length : draft.length;
  const visibleIds = filtered.map((c) => c.id);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => contractIncludedInDeferredDraft(draft, id, allIds));
  const hasTextFilter = q.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="pl-7 h-8 text-xs"
            placeholder="Buscar por cliente, licitación o empresa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange("all")}
              className="text-xs font-medium text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline"
              disabled={draft === "all"}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-blue-700 hover:underline disabled:text-slate-400 disabled:no-underline"
              disabled={draft !== "all" && (draft as string[]).length === 0}
            >
              Ninguno
            </button>
            {hasTextFilter && visibleIds.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (allVisibleSelected) {
                    onChange(
                      applyDraftChange(draft, allIds, (current) => {
                        visibleIds.forEach((id) => current.delete(id));
                      })
                    );
                  } else {
                    onChange(
                      applyDraftChange(draft, allIds, (current) => {
                        visibleIds.forEach((id) => current.add(id));
                      })
                    );
                  }
                }}
                className="text-xs font-medium text-slate-600 hover:underline"
              >
                {allVisibleSelected ? "Quitar visibles" : "Marcar visibles"}
              </button>
            )}
          </div>
        )}
      </div>

      {availableCompanies.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500 mr-1">Empresas en reparto:</span>
          {availableCompanies.map((comp) => {
            const state = companyInclusionState(comp.code);
            const chipClass =
              state === "all"
                ? "px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-600 text-white border border-red-600"
                : state === "partial"
                  ? "px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-400"
                  : "px-2 py-0.5 rounded-full text-[11px] font-medium bg-card text-slate-500 border border-slate-300 line-through";
            return (
              <button
                key={comp.code}
                type="button"
                disabled={readOnly}
                onClick={() => setCompanyIncluded(comp.code, state !== "all")}
                className={chipClass}
                title={
                  state === "all"
                    ? "Excluir todos los contratos de esta empresa"
                    : "Incluir todos los contratos de esta empresa"
                }
              >
                {comp.label}
              </button>
            );
          })}
        </div>
      )}

      <p
        className={
          selectedCount === 0
            ? "text-[11px] font-medium text-amber-700"
            : "text-[11px] text-slate-500"
        }
      >
        {selectedCount} de {allIds.length} seleccionados
        {selectedCount === 0 && " · seleccione al menos uno para guardar"}
        {hasTextFilter && ` · ${filtered.length} coinciden con la búsqueda`}
      </p>
      <div
        className={
          listClassName ??
          "max-h-44 overflow-y-auto space-y-2 rounded-md border border-red-100 bg-card p-2"
        }
      >
        {contracts.length === 0 ? (
          <p className="text-xs text-slate-500">No hay contratos en estado Activo o Prórroga.</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-500">
            {q ? `Sin resultados para “${query}”.` : "Ningún contrato disponible."}
          </p>
        ) : (
          filtered.map((c) => {
            const checked = contractIncludedInDeferredDraft(draft, c.id, allIds);
            return (
              <label key={c.id} className="flex items-start gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300"
                  checked={checked}
                  disabled={readOnly}
                  onChange={() => {
                    if (readOnly) return;
                    onChange(toggleDeferredDraft(draft, c.id, allIds));
                  }}
                />
                <span>
                  <span className="font-medium text-slate-800">{c.client}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {c.licitacionNo} · {companyDisplayName(c.company, companyRows)}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
