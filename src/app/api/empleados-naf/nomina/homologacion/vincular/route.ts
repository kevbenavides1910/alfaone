import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { applyNafExactContractMatches } from "@/modules/empleados-naf/services/naf-contract-reconciliation";
import { linkRrhhContratoToContract } from "@/modules/empleados/services/contract-reconciliation";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.homologacion", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      action?: string;
      contratoNaf?: string;
      contractId?: string;
      notes?: string;
    };

    if (body.action === "apply_exact") {
      const result = await applyNafExactContractMatches();
      return ok(result);
    }

    const contrato = body.contratoNaf?.trim();
    const contractId = body.contractId?.trim();
    if (!contrato || !contractId) {
      return badRequest("Indique contratoNaf y contractId");
    }

    const result = await linkRrhhContratoToContract(
      contrato,
      contractId,
      session.user.id,
      body.notes?.trim() || "Homologación manual contrato NAF → presupuestos",
    );
    return ok(result);
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al homologar contrato NAF",
      e,
    );
  }
}
