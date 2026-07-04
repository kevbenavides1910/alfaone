import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, notFound, serverError } from "@/lib/api/response";
import { getContractAssetsTree } from "@/modules/inventario/services/contract-assets";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { id: contractId } = await params;

  try {
    const tree = await getContractAssetsTree(contractId);
    if (!tree) return notFound();
    return ok(tree);
  } catch (e) {
    return serverError("Error al obtener activos del contrato", e);
  }
}
