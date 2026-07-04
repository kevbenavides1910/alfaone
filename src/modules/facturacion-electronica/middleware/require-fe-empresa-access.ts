import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { prisma } from "@/modules/core/db/prisma";

const empresaRepo = new FeEmpresaRepository(prisma);

/** Company del usuario (o override) sin exigir FE configurado. */
export function resolveFeCompanyCodeFromSession(session: Session, companyOverride?: string | null) {
  const userCompany = session.user.company?.trim() || null;
  const override = companyOverride?.trim() || null;

  if (userCompany) {
    if (override && override !== userCompany) {
      throw new FeDomainError(
        "No puede operar sobre otra empresa distinta a la asignada",
        "FE_COMPANY_FORBIDDEN",
        403
      );
    }
    return userCompany;
  }

  if (override) return override;

  throw new FeDomainError(
    "Seleccione la empresa emisora en Facturación electrónica (usuarios con acceso a todas las compañías)",
    "FE_NO_COMPANY",
    403
  );
}

export function resolveFeCompanyCodeFromRequest(session: Session, req: NextRequest) {
  const companyOverride = new URL(req.url).searchParams.get("companyCode");
  return resolveFeCompanyCodeFromSession(session, companyOverride);
}

/** Valida que exista configuración FE activa para operaciones de comprobantes. */
export async function resolveFeCompanyCode(session: Session, companyOverride?: string | null) {
  const companyCode = resolveFeCompanyCodeFromSession(session, companyOverride);
  await empresaRepo.findByCompanyCode(companyCode);
  return companyCode;
}
