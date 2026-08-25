"use client";

import { useFingerCompany } from "@/components/finger-system/finger-company-context";
import { Badge } from "@/components/ui/badge";

/** Muestra la empresa activa del contexto Finger System. */
export function FingerCompanyFilterHint() {
  const { companyCode, companies, isMultiCompany } = useFingerCompany();
  if (!companyCode || !isMultiCompany) return null;

  const name = companies.find((c) => c.code === companyCode)?.name ?? companyCode;

  return (
    <Badge variant="outline" className="font-normal text-xs">
      Empresa: {companyCode} — {name}
    </Badge>
  );
}
