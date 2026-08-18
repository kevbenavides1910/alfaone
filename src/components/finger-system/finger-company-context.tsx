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

const FINGER_COMPANY_STORAGE_KEY = "finger-selected-company";

type FingerCompanyContextValue = {
  companyCode: string | null;
  setCompanyCode: (code: string) => void;
  needsSelection: boolean;
  isMultiCompany: boolean;
  companies: CompanyRow[];
};

const FingerCompanyContext = createContext<FingerCompanyContextValue | null>(null);

export function FingerCompanyProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const { data: companiesRes } = useCompanies();
  const fixedCompany = session?.user?.company?.trim() || null;
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (fixedCompany) {
      setSelected(fixedCompany);
      return;
    }
    const stored = localStorage.getItem(FINGER_COMPANY_STORAGE_KEY);
    if (stored) setSelected(stored);
  }, [fixedCompany]);

  const companies = useMemo(
    () => (companiesRes?.data ?? []).filter((c) => c.isActive),
    [companiesRes?.data],
  );

  useEffect(() => {
    if (fixedCompany || companies.length === 0) return;

    if (selected && companies.some((c) => c.code === selected)) return;

    if (selected && !companies.some((c) => c.code === selected)) {
      localStorage.removeItem(FINGER_COMPANY_STORAGE_KEY);
    }

    const next = companies[0]!.code;
    setSelected(next);
    localStorage.setItem(FINGER_COMPANY_STORAGE_KEY, next);
  }, [fixedCompany, selected, companies]);

  const setCompanyCode = useCallback(
    (code: string) => {
      setSelected(code);
      if (!fixedCompany) localStorage.setItem(FINGER_COMPANY_STORAGE_KEY, code);
    },
    [fixedCompany],
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
    [companyCode, setCompanyCode, fixedCompany, companies],
  );

  return <FingerCompanyContext.Provider value={value}>{children}</FingerCompanyContext.Provider>;
}

export function useFingerCompany() {
  const ctx = useContext(FingerCompanyContext);
  if (!ctx) {
    throw new Error("useFingerCompany debe usarse dentro de FingerCompanyProvider");
  }
  return ctx;
}

export function fingerApiUrl(path: string, companyCode: string | null | undefined): string {
  if (!companyCode) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}company=${encodeURIComponent(companyCode)}`;
}
