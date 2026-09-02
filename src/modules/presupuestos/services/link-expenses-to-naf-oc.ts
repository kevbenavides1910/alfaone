import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

export type NafOcLinkFields = {
  nafOcNoCia: string;
  nafOcNoOrden: string;
  nafOcNoDocu: string | null;
  nafOcLinkedAt: Date;
};

export type LinkExpensesToNafOcResult = {
  scanned: number;
  linked: number;
  alreadyLinked: number;
  skippedNonNumeric: number;
  ambiguous: number;
  missing: number;
  fetchedAt: string;
};

type OcCandidate = {
  noCia: string;
  noOrden: string;
  noDocu: string | null;
  monto: number;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function isInstallmentOf(total: number, part: number): boolean {
  if (total <= 0 || part <= 0) return false;
  for (let n = 2; n <= 12; n++) {
    const share = total / n;
    if (Math.abs(share - part) <= Math.max(2, share * 0.02)) return true;
  }
  return false;
}

function pickCandidate(
  opts: OcCandidate[],
  noCia: string | null,
  amount: number,
): OcCandidate | null {
  if (!opts.length) return null;
  if (noCia) {
    const exact = opts.find((o) => o.noCia === noCia);
    if (exact) return exact;
  }
  if (opts.length === 1) return opts[0];

  const scored = [...opts]
    .map((o) => ({
      o,
      diff: Math.abs(o.monto - amount),
      installment: isInstallmentOf(o.monto, amount),
      near: Math.abs(o.monto - amount) <= Math.max(2, o.monto * 0.02),
    }))
    .sort((a, b) => a.diff - b.diff);

  const best = scored[0];
  const second = scored[1];
  if (!best) return null;
  if (best.near || best.installment) {
    if (!second || best.diff < second.diff * 0.5 || best.installment) return best.o;
  }
  return null;
}

async function loadOcIndex(): Promise<Map<string, OcCandidate[]>> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `
      SELECT
        e.NO_CIA,
        e.NO_ORDEN,
        e.NO_DOCU,
        NVL((
          SELECT SUM(NVL(d.CANTIDAD_PEDIDA, 0) * NVL(d.PRECIO_UNI, 0))
          FROM NAF5.ARIMDETORDEN d
          WHERE d.NO_CIA = e.NO_CIA AND d.NO_DOCU = e.NO_DOCU
        ), 0) AS MONTO
      FROM NAF5.ARIMENCORDEN e
      `,
    );
    const byOrden = new Map<string, OcCandidate[]>();
    for (const raw of result.rows ?? []) {
      const row = raw as Record<string, unknown>;
      const noOrden = asString(row.NO_ORDEN);
      const noCia = asString(row.NO_CIA)?.padStart(2, "0");
      if (!noOrden || !noCia) continue;
      const cand: OcCandidate = {
        noCia,
        noOrden,
        noDocu: asString(row.NO_DOCU),
        monto: Number(row.MONTO) || 0,
      };
      const list = byOrden.get(noOrden) ?? [];
      list.push(cand);
      byOrden.set(noOrden, list);
    }
    return byOrden;
  });
}

export function nafOcLinkFromPicker(row: {
  noCia: string;
  noOrden: string;
  noDocu?: string | null;
}): NafOcLinkFields {
  return {
    nafOcNoCia: row.noCia.padStart(2, "0"),
    nafOcNoOrden: row.noOrden.trim(),
    nafOcNoDocu: row.noDocu?.trim() || null,
    nafOcLinkedAt: new Date(),
  };
}

/**
 * Liga gastos con origen «Orden de compra» y N° referencia numérico a ARIMENCORDEN.
 * Idempotente: no pisa vínculos ya existentes.
 */
export async function linkExpensesToNafOc(options?: {
  onlyUnlinked?: boolean;
}): Promise<LinkExpensesToNafOcResult> {
  const onlyUnlinked = options?.onlyUnlinked !== false;
  const companies = await prisma.company.findMany({
    where: { isActive: true, sapCode: { not: null } },
    select: { code: true, sapCode: true },
  });
  const sapByCode = new Map(
    companies.map((c) => [c.code, (c.sapCode as string).trim().padStart(2, "0")]),
  );

  const expenses = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      origin: { name: "Orden de compra" },
      referenceNumber: { not: null },
      ...(onlyUnlinked ? { nafOcNoOrden: null } : {}),
    },
    select: {
      id: true,
      referenceNumber: true,
      company: true,
      amount: true,
      nafOcNoOrden: true,
    },
  });

  const byOrden = await loadOcIndex();
  let linked = 0;
  let alreadyLinked = 0;
  let skippedNonNumeric = 0;
  let ambiguous = 0;
  let missing = 0;

  for (const exp of expenses) {
    if (exp.nafOcNoOrden) {
      alreadyLinked += 1;
      continue;
    }
    const ref = (exp.referenceNumber ?? "").trim();
    if (!/^\d+$/.test(ref)) {
      skippedNonNumeric += 1;
      continue;
    }
    const opts = byOrden.get(ref) ?? [];
    if (!opts.length) {
      missing += 1;
      continue;
    }
    const noCia = exp.company ? sapByCode.get(exp.company) ?? null : null;
    const pick = pickCandidate(opts, noCia, parseFloat(exp.amount.toString()));
    if (!pick) {
      ambiguous += 1;
      continue;
    }
    await prisma.expense.update({
      where: { id: exp.id },
      data: {
        nafOcNoCia: pick.noCia,
        nafOcNoOrden: pick.noOrden,
        nafOcNoDocu: pick.noDocu,
        nafOcLinkedAt: new Date(),
        // Normaliza referencia al NO_ORDEN oficial
        referenceNumber: pick.noOrden,
      },
    });
    linked += 1;
  }

  return {
    scanned: expenses.length,
    linked,
    alreadyLinked,
    skippedNonNumeric,
    ambiguous,
    missing,
    fetchedAt: new Date().toISOString(),
  };
}
