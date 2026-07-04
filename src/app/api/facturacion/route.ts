import { NextRequest } from "next/server";

import { prisma } from "@/modules/core/db/prisma";

import { getSession } from "@/lib/api/middleware";

import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";

import { hasPermission } from "@/lib/permissions/check";

import {

  syncFacturasForPeriod,

  serializeFacturaMensual,

} from "@/modules/presupuestos/services/facturacion-cobro";



export async function GET(req: NextRequest) {

  const session = await getSession();

  if (!session) return unauthorized();

  if (!hasPermission(session, "facturacion.cobro", "view")) return forbidden();



  const { searchParams } = new URL(req.url);

  const now = new Date();

  const periodMonth = parseInt(searchParams.get("periodMonth") ?? String(now.getMonth() + 1), 10);

  const periodYear = parseInt(searchParams.get("periodYear") ?? String(now.getFullYear()), 10);

  const company = searchParams.get("company")?.trim();

  const status = searchParams.get("status")?.trim();



  if (periodMonth < 1 || periodMonth > 12 || periodYear < 2000) {

    return badRequest("Mes o año inválido");

  }



  try {

    await syncFacturasForPeriod(prisma, periodYear, periodMonth, session.user.id);



    const rows = await prisma.facturaMensual.findMany({

      where: {

        periodMonth,

        periodYear,

        ...(company ? { companyCodeCopied: company } : {}),

        ...(status ? { status: status as never } : {}),

      },

      orderBy: [{ clientNameCopied: "asc" }],

      include: {

        contract: { select: { licitacionNo: true, hiringType: true } },

        requisitos: { orderBy: { sortOrder: "asc" } },

        emisiones: { orderBy: { sortOrder: "asc" } },

      },

    });



    return ok(rows.map(serializeFacturaMensual));

  } catch (e) {

    return serverError("Error al listar facturación", e);

  }

}


