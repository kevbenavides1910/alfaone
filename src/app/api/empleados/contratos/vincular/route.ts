import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  applyAllExactMatches,
  consolidateContractLicitacion,
  linkRrhhContratoToContract,
} from "@/modules/empleados/services/contract-reconciliation";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.contratos", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      action?: string;
      contratoRrhh?: string;
      contractId?: string;
      notes?: string;
      consolidate?: boolean;
    };

    if (body.action === "apply_exact") {
      const result = await applyAllExactMatches();
      return ok(result);
    }

    const contrato = body.contratoRrhh?.trim();
    const contractId = body.contractId?.trim();
    if (!contrato || !contractId) {
      return badRequest("Indique contratoRrhh y contractId");
    }

    if (body.consolidate) {
      if (!hasPermission(session, "alfa-one.contracts", "edit")) {
        return forbidden("Se requiere permiso de edición en contratos para unificar la licitación");
      }
      const result = await consolidateContractLicitacion(contrato, contractId, session.user.id);
      return ok(result);
    }

    const result = await linkRrhhContratoToContract(
      contrato,
      contractId,
      session.user.id,
      body.notes,
    );
    return ok(result);
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al vincular contrato",
      e,
    );
  }
}

