"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/lib/auth/client-session";
import { useCompanies, type CompanyRow } from "@/lib/hooks/use-companies";

const FE_COMPANY_STORAGE_KEY = "fe-selected-company";

type FeCompanyContextValue = {
  companyCode: string | null;
  setCompanyCode: (code: string) => void;
  needsSelection: boolean;
  isMultiCompany: boolean;
  companies: CompanyRow[];
};

const FeCompanyContext = createContext<FeCompanyContextValue | null>(null);

export function FeCompanyProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { data: companiesRes } = useCompanies();
  const fixedCompany = session?.user?.company?.trim() || null;
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (fixedCompany) {
      setSelected(fixedCompany);
      return;
    }
    const stored = localStorage.getItem(FE_COMPANY_STORAGE_KEY);
    if (stored) setSelected(stored);
  }, [fixedCompany]);

  const companies = useMemo(
    () => (companiesRes?.data ?? []).filter((c) => c.isActive),
    [companiesRes?.data]
  );

  useEffect(() => {
    if (fixedCompany || selected || companies.length === 0) return;
    setSelected(companies[0]!.code);
    localStorage.setItem(FE_COMPANY_STORAGE_KEY, companies[0]!.code);
  }, [fixedCompany, selected, companies]);

  const setCompanyCode = useCallback(
    (code: string) => {
      setSelected(code);
      if (!fixedCompany) localStorage.setItem(FE_COMPANY_STORAGE_KEY, code);
    },
    [fixedCompany]
  );

  const companyCode = fixedCompany || selected || null;

  const value = useMemo(
    () => ({
      companyCode,
      setCompanyCode,
      needsSelection: !fixedCompany && !companyCode,
      isMultiCompany: !fixedCompany,
      companies,
    }),
    [companyCode, setCompanyCode, fixedCompany, companies]
  );

  return <FeCompanyContext.Provider value={value}>{children}</FeCompanyContext.Provider>;
}

export function useFeCompany() {
  const ctx = useContext(FeCompanyContext);
  if (!ctx) {
    throw new Error("useFeCompany debe usarse dentro de FeCompanyProvider");
  }
  return ctx;
}

/** Añade companyCode a URLs /api/fe cuando el usuario opera sobre varias empresas. */
export function feApiUrl(path: string, companyCode: string | null | undefined): string {
  if (!companyCode) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}companyCode=${encodeURIComponent(companyCode)}`;
}

/** Body JSON con companyCode para POST/PUT cuando aplica. */
export function withFeCompanyBody<T extends Record<string, unknown>>(
  body: T,
  companyCode: string | null | undefined
): T & { companyCode?: string } {
  if (!companyCode) return body;
  return { ...body, companyCode };
}
