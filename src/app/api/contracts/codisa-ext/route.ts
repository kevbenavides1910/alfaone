import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";
import {
  getNeoContractAutocomplete,
  listCodisaContractAliases,
  lookupNeoContractFromCodisa,
  reconcileCodisaContractExtensions,
} from "@/modules/presupuestos/services/codisa-contract-reconcile";

/**
 * GET /api/contracts/codisa-ext?noContrato=...&noCia=01
 * Autocomplete Neo: maestro Codisa (Oracle, solo A) + extensión/alias (Postgres).
 *
 * GET /api/contracts/codisa-ext?aliases=1
 * Lista alias One→Codisa.
 *
 * GET /api/contracts/codisa-ext?noContrato=...&bundle=1
 * Lookup completo (multipart P1/P2…).
 *
 * POST /api/contracts/codisa-ext  { dryRun?: boolean }
 * Reconciliar extensión desde contratos Alfa-One (+ aliases).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "presupuestos.contracts", "view")) return forbidden();

  const { searchParams } = new URL(req.url);
  const noContrato = searchParams.get("noContrato")?.trim();
  const noCia = searchParams.get("noCia")?.trim() || null;
  const wantAliases = searchParams.get("aliases") === "1";
  const wantBundle = searchParams.get("bundle") === "1";

  if (wantAliases) {
    const rows = await listCodisaContractAliases(prisma);
    return ok({
      count: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        licitacionNoOne: r.licitacionNoOne,
        companyOne: r.companyOne,
        noCia: r.noCia,
        noContrato: r.noContrato,
        aliasNote: r.aliasNote,
      })),
    });
  }

  if (!noContrato) {
    const rows = await prisma.codisaContractExtension.findMany({
      orderBy: [{ noCia: "asc" }, { noContrato: "asc" }],
      take: 2000,
      include: {
        contract: {
          select: {
            id: true,
            licitacionNo: true,
            client: true,
            status: true,
            company: true,
          },
        },
      },
    });
    return ok({
      count: rows.length,
      rows: rows.map((r) => ({
        noCia: r.noCia,
        noContrato: r.noContrato,
        companyCode: r.companyCode,
        contractId: r.contractId,
        officersCount: r.officersCount,
        positionsCount: r.positionsCount,
        administrationsCount: r.administrationsCount,
        ivaPct: r.ivaPct != null ? Number(r.ivaPct) : null,
        billingPeriodToDay: r.billingPeriodToDay,
        matchMethod: r.matchMethod,
        source: r.source,
        lastReconciledAt: r.lastReconciledAt?.toISOString() ?? null,
        contract: r.contract,
      })),
    });
  }

  try {
    if (wantBundle) {
      const bundle = await lookupNeoContractFromCodisa(prisma, noContrato, noCia);
      // Siempre 200: exacto (parts) o parcial (suggestions) para el autocomplete UI.
      if (!bundle.parts.length && !bundle.suggestions.length) {
        return notFound("Contrato no encontrado en Codisa ni en aliases");
      }
      return ok(bundle);
    }

    const payload = await getNeoContractAutocomplete(prisma, noContrato, noCia);
    if (!payload) {
      const bundle = await lookupNeoContractFromCodisa(prisma, noContrato, noCia);
      if (bundle.suggestions.length) return ok({ ...bundle, form: null });
      return notFound("Contrato no encontrado en Codisa");
    }
    return ok(payload);
  } catch (e) {
    console.error("[codisa-ext GET]", e);
    return serverError(e instanceof Error ? e.message : "Error consultando Codisa");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "presupuestos.contracts", "edit")) return forbidden();

  let dryRun = false;
  try {
    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
    dryRun = Boolean(body.dryRun);
  } catch {
    return badRequest("JSON inválido");
  }

  try {
    const result = await reconcileCodisaContractExtensions(prisma, { dryRun });
    return ok({ dryRun, ...result });
  } catch (e) {
    console.error("[codisa-ext POST]", e);
    return serverError(e instanceof Error ? e.message : "Error reconciliando");
  }
}
