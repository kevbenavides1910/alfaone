import { NextRequest } from "next/server";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api/response";

type Ctx = { params: Promise<{ id: string }> };

/** Suma meses a una fecha conservando el día (ajustando si el mes es más corto). */
function sumarMeses(base: Date, meses: number): Date {
  const total = base.getMonth() + meses;
  const anio = base.getFullYear() + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const dia = Math.min(base.getDate(), new Date(anio, mes + 1, 0).getDate());
  return new Date(anio, mes, dia);
}

/**
 * Compromisos periódicos del cartel/pliego para un contrato.
 * Devuelve cada compromiso con su cita, frecuencia y la próxima fecha exigible calculada
 * desde la fecha de inicio del contrato (misma regla del calendario).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  const { hasPermission } = await import("@/lib/permissions/check");
  if (!hasPermission(session, "presupuestos.contracts", "view")) return forbidden();

  const { id } = await params;
  const contrato = await prisma.contract.findFirst({
    where: { id, deletedAt: null },
    select: { startDate: true, endDate: true, licitacionNo: true },
  });
  if (!contrato) return notFound("Contrato no encontrado");

  const filas = await prisma.contractCommitment.findMany({
    where: { contractId: id },
    orderBy: [{ tema: "asc" }, { frecuencia: "asc" }],
  });

  const hoy = new Date();
  const inicio = contrato.startDate ? new Date(contrato.startDate) : null;
  const fin = contrato.endDate ? new Date(contrato.endDate) : null;

  const compromisos = filas.map((f) => {
    let proxima: Date | null = null;
    let veces: number | null = null;
    if (inicio && f.meses && f.meses > 0) {
      let k = 1;
      while (k <= 60) {
        const fecha = sumarMeses(inicio, Math.round(f.meses * k));
        if (fin && fecha > fin) break;
        if (fecha >= hoy) {
          proxima = fecha;
          veces = k;
          break;
        }
        k += 1;
      }
    }
    return {
      id: f.id,
      tema: f.tema,
      subtipo: f.subtipo,
      obligacion: f.obligacion,
      frecuencia: f.frecuencia,
      meses: f.meses,
      pagina: f.pagina,
      documento: f.documento,
      citasAdicionales: f.citasAdicionales,
      proximaFecha: proxima ? proxima.toISOString().slice(0, 10) : null,
      numeroDeVez: veces,
    };
  });

  const conFecha = compromisos.filter((c) => c.proximaFecha).sort((a, b) =>
    (a.proximaFecha as string).localeCompare(b.proximaFecha as string)
  );
  const sinFecha = compromisos.filter((c) => !c.proximaFecha);

  return ok({
    licitacionNo: contrato.licitacionNo,
    inicio: contrato.startDate ? new Date(contrato.startDate).toISOString().slice(0, 10) : null,
    fin: contrato.endDate ? new Date(contrato.endDate).toISOString().slice(0, 10) : null,
    total: compromisos.length,
    conProximaFecha: conFecha.length,
    compromisos: [...conFecha, ...sinFecha],
  });
}
