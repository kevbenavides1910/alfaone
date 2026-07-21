import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { listNafDocuments, type NafDocumentoRow } from "@/modules/naf-documentos/services/list-naf-documents";
import { resolveEmisionSubtotals } from "@/modules/presupuestos/business/administration-billing-amount";
import { resolveContractMonthlyBilling } from "@/modules/presupuestos/business/contractPeriodBilling";
import { addDaysUtc } from "@/modules/presupuestos/import/cxc-rows";
import {
  calculateInvoiceTotal,
  calendarDayUtc,
  defaultDueDateFromIssue,
} from "@/modules/presupuestos/services/facturacion-cobro";
import { syncCxcFromFacturaEmision, syncCxcFromFacturaMensual } from "@/modules/presupuestos/services/sync-cxc-from-factura";

type Db = PrismaClient;

export const NAF_LINKABLE_TIPOS = new Set(["FC", "ND", "NC", "AN"]);

export type NafDocKey = {
  noCia: string;
  tipoDoc: string;
  noFactu: string;
};

export type FacturaEmisionNafLinkSerialized = {
  id: string;
  nafNoCia: string;
  nafTipoDoc: string;
  nafNoFactu: string;
  nafNoFisico: string | null;
  nafSerieFisico: string | null;
  nafConsecutivoFe: string | null;
  nafClaveFactura: string | null;
  nafFecha: string | null;
  subtotal: number;
  impuesto: number;
  total: number;
  amountSign: number;
  signedTotal: number;
  linkedAt: string;
};

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNum(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v.toString());
}

export function nafAmountSign(tipoDoc: string): number | null {
  const t = tipoDoc.trim().toUpperCase();
  if (t === "FC" || t === "ND") return 1;
  if (t === "NC" || t === "AN") return -1;
  return null;
}

export function serializeNafLink(row: {
  id: string;
  nafNoCia: string;
  nafTipoDoc: string;
  nafNoFactu: string;
  nafNoFisico: string | null;
  nafSerieFisico: string | null;
  nafConsecutivoFe: string | null;
  nafClaveFactura: string | null;
  nafFecha: Date | null;
  subtotal: { toString(): string } | number;
  impuesto: { toString(): string } | number;
  total: { toString(): string } | number;
  amountSign: number;
  signedTotal: { toString(): string } | number;
  linkedAt: Date;
}): FacturaEmisionNafLinkSerialized {
  return {
    id: row.id,
    nafNoCia: row.nafNoCia,
    nafTipoDoc: row.nafTipoDoc,
    nafNoFactu: row.nafNoFactu,
    nafNoFisico: row.nafNoFisico,
    nafSerieFisico: row.nafSerieFisico,
    nafConsecutivoFe: row.nafConsecutivoFe,
    nafClaveFactura: row.nafClaveFactura,
    nafFecha: row.nafFecha?.toISOString() ?? null,
    subtotal: toNum(row.subtotal),
    impuesto: toNum(row.impuesto),
    total: toNum(row.total),
    amountSign: row.amountSign,
    signedTotal: toNum(row.signedTotal),
    linkedAt: row.linkedAt.toISOString(),
  };
}

export async function fetchNafDocumentFromOracle(key: NafDocKey): Promise<{
  noCia: string;
  tipoDoc: string;
  noFactu: string;
  noFisico: string | null;
  serieFisico: string | null;
  consecutivoFe: string | null;
  claveFactura: string | null;
  fecha: Date | null;
  plazo: number | null;
  subtotal: number;
  impuesto: number;
  total: number;
} | null> {
  const noCia = key.noCia.trim();
  const tipoDoc = key.tipoDoc.trim().toUpperCase();
  const noFactu = key.noFactu.trim();
  if (!noCia || !tipoDoc || !noFactu) return null;

  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `
      SELECT
        f.NO_CIA,
        f.TIPO_DOC,
        f.NO_FACTU,
        f.NO_FISICO,
        f.SERIE_FISICO,
        f.F_ELECTRONICA,
        f.CLAVE_FACTURA,
        f.FECHA,
        f.PLAZO,
        f.SUB_TOTAL,
        f.IMPUESTO,
        f.TOTAL
      FROM NAF5.ARFAFE f
      WHERE f.NO_CIA = :noCia
        AND f.TIPO_DOC = :tipoDoc
        AND TO_CHAR(f.NO_FACTU) = :noFactu
      `,
      { noCia, tipoDoc, noFactu },
    );
    const row = (result.rows?.[0] ?? null) as OracleRow | null;
    if (!row) return null;
    const plazoRaw = row.PLAZO == null || row.PLAZO === "" ? null : asNumber(row.PLAZO);
    return {
      noCia: asString(row.NO_CIA) ?? noCia,
      tipoDoc: (asString(row.TIPO_DOC) ?? tipoDoc).toUpperCase(),
      noFactu: asString(row.NO_FACTU) ?? noFactu,
      noFisico: asString(row.NO_FISICO),
      serieFisico: asString(row.SERIE_FISICO),
      consecutivoFe: asString(row.F_ELECTRONICA),
      claveFactura: asString(row.CLAVE_FACTURA),
      fecha: asDate(row.FECHA),
      plazo: plazoRaw != null && Number.isFinite(plazoRaw) ? Math.trunc(plazoRaw) : null,
      subtotal: asNumber(row.SUB_TOTAL),
      impuesto: asNumber(row.IMPUESTO),
      total: asNumber(row.TOTAL),
    };
  });
}

export async function listLinkedNafKeys(keys: NafDocKey[]): Promise<
  Map<string, { emisionId: string; linkId: string }>
> {
  if (keys.length === 0) return new Map();
  const rows = await prisma.facturaEmisionNafDocumento.findMany({
    where: {
      OR: keys.map((k) => ({
        nafNoCia: k.noCia,
        nafTipoDoc: k.tipoDoc.toUpperCase(),
        nafNoFactu: k.noFactu,
      })),
    },
    select: {
      id: true,
      nafNoCia: true,
      nafTipoDoc: true,
      nafNoFactu: true,
      facturaMensualEmisionId: true,
    },
  });
  const map = new Map<string, { emisionId: string; linkId: string }>();
  for (const row of rows) {
    map.set(`${row.nafNoCia}-${row.nafTipoDoc}-${row.nafNoFactu}`, {
      emisionId: row.facturaMensualEmisionId,
      linkId: row.id,
    });
  }
  return map;
}

export async function listLinkableNafDocs(input: {
  noCia?: string | null;
  companyCode?: string | null;
  periodMonth: number;
  periodYear: number;
  search?: string;
  page?: number;
  pageSize?: number;
  excludeEmisionId?: string;
}): Promise<{
  rows: Array<NafDocumentoRow & { yaLigado: boolean; ligadoEmisionId: string | null }>;
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 30;
  const list = await listNafDocuments({
    periodMonth: input.periodMonth,
    periodYear: input.periodYear,
    company: input.companyCode ?? undefined,
    search: input.search,
    page,
    pageSize,
  });

  const linkable = list.rows.filter((r) => NAF_LINKABLE_TIPOS.has(r.tipoDoc.toUpperCase()));
  const linked = await listLinkedNafKeys(
    linkable.map((r) => ({ noCia: r.noCia, tipoDoc: r.tipoDoc, noFactu: r.noFactu })),
  );

  const rows = linkable
    .map((r) => {
      const hit = linked.get(`${r.noCia}-${r.tipoDoc}-${r.noFactu}`);
      const yaLigado = Boolean(hit) && hit!.emisionId !== input.excludeEmisionId;
      return {
        ...r,
        yaLigado: Boolean(hit),
        ligadoEmisionId: hit?.emisionId ?? null,
        // keep rows already linked to OTHER emisiones marked not selectable via yaLigado
        _blocked: yaLigado && hit!.emisionId !== input.excludeEmisionId,
      };
    })
    .filter((r) => !r._blocked || r.ligadoEmisionId === input.excludeEmisionId)
    .map(({ _blocked: _, ...rest }) => rest);

  return {
    rows,
    total: rows.length,
    page: list.page,
    pageSize: list.pageSize,
  };
}

type NafLinkNumberSource = {
  nafTipoDoc: string;
  nafNoFactu: string | null;
  nafNoFisico: string | null;
  nafConsecutivoFe: string | null;
  nafFecha: Date | null;
  total: number;
};

/** Prefer FC with highest total: FE consecutive → invoice #, Codisa NO_FACTU → document #. */
function pickInvoiceFieldsFromLinks(links: NafLinkNumberSource[]): {
  invoiceNumber: string | null;
  documentNumber: string | null;
  nafFecha: Date | null;
} {
  const ranked = [...links].sort((a, b) => b.total - a.total);
  const fcs = ranked.filter((l) => l.nafTipoDoc.toUpperCase() === "FC");
  const pool = fcs.length > 0 ? fcs : ranked;

  const withElectronic = pool.find((l) => l.nafConsecutivoFe?.trim());
  const withCodisaDoc = pool.find((l) => l.nafNoFactu?.trim());
  const primary = withElectronic ?? withCodisaDoc ?? pool[0] ?? null;

  return {
    invoiceNumber: primary?.nafConsecutivoFe?.trim() || null,
    documentNumber: primary?.nafNoFactu?.trim() || withCodisaDoc?.nafNoFactu?.trim() || null,
    nafFecha: primary?.nafFecha ?? withCodisaDoc?.nafFecha ?? null,
  };
}

export async function recomputeEmisionFromNafLinks(
  db: Db,
  emisionId: string,
  options?: {
    /** Credit days from the NAF doc just linked (Oracle PLAZO); used once to set due date. */
    plazoDays?: number | null;
    /** When true (default), fill invoiceReceivedAt from NAF FECHA if still empty. */
    applyNafDates?: boolean;
  },
): Promise<{
  subtotalFacturadoNaf: number | null;
  totalFacturadoNaf: number | null;
  invoiceNumber: string | null;
  documentNumber: string | null;
  linksCount: number;
}> {
  const applyNafDates = options?.applyNafDates !== false;
  const links = await db.facturaEmisionNafDocumento.findMany({
    where: { facturaMensualEmisionId: emisionId },
    orderBy: [{ nafFecha: "asc" }, { linkedAt: "asc" }],
  });

  if (links.length === 0) {
    const emptied = await db.facturaMensualEmision.update({
      where: { id: emisionId },
      data: {
        subtotalFacturadoNaf: null,
        totalFacturadoNaf: null,
        invoiceNumber: null,
        documentNumber: null,
      },
      select: { facturaMensualId: true },
    });
    // Limpiar números en el padre solo si ninguna emisión conserva NAF.
    const siblingsWithLinks = await db.facturaEmisionNafDocumento.count({
      where: { emision: { facturaMensualId: emptied.facturaMensualId } },
    });
    if (siblingsWithLinks === 0) {
      await db.facturaMensual.update({
        where: { id: emptied.facturaMensualId },
        data: { invoiceNumber: null, documentNumber: null },
      });
    }
    await recomputeFacturaMensualFromEmisiones(db, emisionId);
    return {
      subtotalFacturadoNaf: null,
      totalFacturadoNaf: null,
      invoiceNumber: null,
      documentNumber: null,
      linksCount: 0,
    };
  }

  let signedSubtotal = 0;
  let signedTotal = 0;
  for (const link of links) {
    signedSubtotal += link.amountSign * Math.abs(toNum(link.subtotal));
    signedTotal += toNum(link.signedTotal);
  }
  signedSubtotal = round2(signedSubtotal);
  signedTotal = round2(signedTotal);

  const picked = pickInvoiceFieldsFromLinks(
    links.map((l) => ({
      nafTipoDoc: l.nafTipoDoc,
      nafNoFactu: l.nafNoFactu,
      nafNoFisico: l.nafNoFisico,
      nafConsecutivoFe: l.nafConsecutivoFe,
      nafFecha: l.nafFecha,
      total: toNum(l.total),
    })),
  );

  const emision = await db.facturaMensualEmision.findUnique({
    where: { id: emisionId },
    select: {
      id: true,
      facturaMensualId: true,
      invoiceReceivedAt: true,
      facturaMensual: {
        select: {
          id: true,
          invoiceReceivedAt: true,
          dueDate: true,
          expectedIssueDate: true,
        },
      },
    },
  });
  if (!emision) {
    return {
      subtotalFacturadoNaf: signedSubtotal,
      totalFacturadoNaf: signedTotal,
      invoiceNumber: picked.invoiceNumber,
      documentNumber: picked.documentNumber,
      linksCount: links.length,
    };
  }

  const emisionData: {
    subtotalFacturadoNaf: Prisma.Decimal;
    totalFacturadoNaf: Prisma.Decimal;
    invoiceNumber: string | null;
    documentNumber: string | null;
    invoiceReceivedAt?: Date;
  } = {
    subtotalFacturadoNaf: new Prisma.Decimal(signedSubtotal.toFixed(2)),
    totalFacturadoNaf: new Prisma.Decimal(signedTotal.toFixed(2)),
    invoiceNumber: picked.invoiceNumber,
    documentNumber: picked.documentNumber,
  };

  const parentData: {
    invoiceNumber?: string | null;
    documentNumber?: string | null;
    invoiceReceivedAt?: Date;
    dueDate?: Date;
  } = {
    invoiceNumber: picked.invoiceNumber,
    documentNumber: picked.documentNumber,
  };

  if (applyNafDates && picked.nafFecha) {
    const hasReceived =
      emision.invoiceReceivedAt != null || emision.facturaMensual.invoiceReceivedAt != null;
    if (!hasReceived) {
      emisionData.invoiceReceivedAt = picked.nafFecha;
      parentData.invoiceReceivedAt = picked.nafFecha;
    }

    const plazo =
      options?.plazoDays != null && Number.isFinite(options.plazoDays)
        ? Math.trunc(options.plazoDays)
        : null;
    if (plazo != null && plazo >= 0) {
      const currentDue = emision.facturaMensual.dueDate;
      const defaultDue = defaultDueDateFromIssue(emision.facturaMensual.expectedIssueDate);
      const stillDefault =
        !currentDue || calendarDayUtc(currentDue) === calendarDayUtc(defaultDue);
      if (stillDefault) {
        parentData.dueDate = addDaysUtc(picked.nafFecha, plazo);
      }
    }
  }

  await db.facturaMensualEmision.update({
    where: { id: emisionId },
    data: emisionData,
  });

  if (Object.keys(parentData).length > 0) {
    await db.facturaMensual.update({
      where: { id: emision.facturaMensualId },
      data: parentData,
    });
  }

  await recomputeFacturaMensualFromEmisiones(db, emisionId);

  return {
    subtotalFacturadoNaf: signedSubtotal,
    totalFacturadoNaf: signedTotal,
    invoiceNumber: picked.invoiceNumber,
    documentNumber: picked.documentNumber,
    linksCount: links.length,
  };
}

async function recomputeFacturaMensualFromEmisiones(db: Db, emisionId: string): Promise<void> {
  const emision = await db.facturaMensualEmision.findUnique({
    where: { id: emisionId },
    select: { facturaMensualId: true },
  });
  if (!emision) return;

  const factura = await db.facturaMensual.findUnique({
    where: { id: emision.facturaMensualId },
    include: {
      emisiones: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          contractAdministrationId: true,
          closedAt: true,
          subtotalFacturadoNaf: true,
          totalFacturadoNaf: true,
          _count: { select: { nafDocumentos: true } },
        },
      },
      contract: {
        select: {
          administrations: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              billingLines: {
                select: {
                  billingLineId: true,
                  monthlyAmount: true,
                  billingLine: { select: { monthlyAmount: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!factura) return;

  const anyNaf = factura.emisiones.some((e) => e._count.nafDocumentos > 0);
  const ivaPct = toNum(factura.ivaPctCopied);
  const administrations = factura.contract?.administrations ?? [];

  // Baseline contract subtotal: prefer current venta when no NAF; when mixing NAF,
  // split remaining emisiones from the original contract amount stored before NAF overwrite
  // using contract administrations proportions against contract.monthlyBilling if needed.
  const contractBilling = await db.contract.findUnique({
    where: { id: factura.contractId },
    select: {
      monthlyBilling: true,
      hiringType: true,
      billingHistory: { select: { periodMonth: true, monthlyBilling: true }, orderBy: { periodMonth: "asc" } },
      demandBilling: {
        where: { periodYear: factura.periodYear, periodMonth: factura.periodMonth },
        select: { monthlyBilling: true },
      },
    },
  });

  let baselineSubtotal = toNum(factura.subtotalCopied);
  if (contractBilling) {
    const venta = resolveContractMonthlyBilling(
      {
        hiringType: contractBilling.hiringType ?? factura.hiringTypeCopied ?? "FIXED",
        monthlyBilling: contractBilling.monthlyBilling,
      },
      contractBilling.billingHistory,
      contractBilling.demandBilling.map((d) => ({
        periodYear: factura.periodYear,
        periodMonth: factura.periodMonth,
        monthlyBilling: d.monthlyBilling,
      })),
      factura.periodYear,
      factura.periodMonth,
    );
    if (venta.amountDefined && venta.billing != null) {
      baselineSubtotal = venta.billing;
    }
  }

  const emisionSubtotalsByAdmin = new Map<string, number>();
  if (administrations.length > 0 && baselineSubtotal > 0) {
    const subs = resolveEmisionSubtotals(baselineSubtotal, administrations, administrations.length);
    administrations.forEach((a, i) => {
      if (subs[i] != null) emisionSubtotalsByAdmin.set(a.id, subs[i]!);
    });
  }

  let sumSubtotal = 0;
  let sumTotal = 0;
  factura.emisiones.forEach((e, idx) => {
    if (e._count.nafDocumentos > 0) {
      sumSubtotal += toNum(e.subtotalFacturadoNaf);
      sumTotal += toNum(e.totalFacturadoNaf);
      return;
    }
    const emSub =
      (e.contractAdministrationId
        ? emisionSubtotalsByAdmin.get(e.contractAdministrationId)
        : undefined) ??
      (emisionSubtotalsByAdmin.size > 0
        ? [...emisionSubtotalsByAdmin.values()][idx]
        : undefined) ??
      (factura.emisiones.length === 1 ? baselineSubtotal : 0);
    const sub = emSub ?? 0;
    sumSubtotal += sub;
    sumTotal += calculateInvoiceTotal(sub, ivaPct);
  });

  // Only overwrite parent montos when there is at least one NAF link, or when clearing
  // the last link (restore contract baseline across emisiones).
  if (anyNaf || baselineSubtotal > 0) {
    await db.facturaMensual.update({
      where: { id: factura.id },
      data: {
        subtotalCopied: new Prisma.Decimal(round2(sumSubtotal).toFixed(2)),
        totalCalculated: new Prisma.Decimal(round2(sumTotal).toFixed(2)),
      },
    });
  }

  for (const e of factura.emisiones) {
    if (!e.closedAt) continue;
    if (e._count.nafDocumentos === 0 && e.id !== emisionId && anyNaf) continue;
    const total =
      e._count.nafDocumentos > 0
        ? toNum(e.totalFacturadoNaf)
        : (() => {
            const emSub =
              (e.contractAdministrationId
                ? emisionSubtotalsByAdmin.get(e.contractAdministrationId)
                : undefined) ?? 0;
            return calculateInvoiceTotal(emSub, ivaPct);
          })();
    await syncCxcFromFacturaEmision(db, factura.id, e.id, round2(total));
  }

  if (
    (factura.status === "FACTURADO" || factura.status === "COBRADO") &&
    factura.emisiones.every((e) => e.closedAt) &&
    factura.emisiones.length <= 1
  ) {
    await syncCxcFromFacturaMensual(db, factura.id);
  }
}

export type LinkNafResult =
  | { ok: true; link: FacturaEmisionNafLinkSerialized }
  | { ok: false; code: "NOT_FOUND" | "INVALID_TIPO" | "ALREADY_LINKED" | "EMISION_MISMATCH"; message: string };

export async function linkNafDocumento(
  db: Db,
  input: {
    facturaId: string;
    emisionId: string;
    key: NafDocKey;
    userId?: string | null;
    /** User-selected dates from the invoice form (take precedence over NAF defaults). */
    invoiceReceivedAt?: Date | null;
    dueDate?: Date | null;
  },
): Promise<LinkNafResult> {
  const emision = await db.facturaMensualEmision.findFirst({
    where: { id: input.emisionId, facturaMensualId: input.facturaId },
    select: { id: true },
  });
  if (!emision) {
    return { ok: false, code: "NOT_FOUND", message: "Emisión no encontrada en esta factura" };
  }

  const tipo = input.key.tipoDoc.trim().toUpperCase();
  const sign = nafAmountSign(tipo);
  if (sign == null) {
    return {
      ok: false,
      code: "INVALID_TIPO",
      message: "Solo se pueden ligar documentos FC, ND, NC o AN",
    };
  }

  const naf = await fetchNafDocumentFromOracle({
    noCia: input.key.noCia,
    tipoDoc: tipo,
    noFactu: input.key.noFactu,
  });
  if (!naf) {
    return { ok: false, code: "NOT_FOUND", message: "Documento NAF no encontrado en Oracle" };
  }

  const existing = await db.facturaEmisionNafDocumento.findUnique({
    where: {
      nafNoCia_nafTipoDoc_nafNoFactu: {
        nafNoCia: naf.noCia,
        nafTipoDoc: naf.tipoDoc,
        nafNoFactu: naf.noFactu,
      },
    },
    select: { id: true, facturaMensualEmisionId: true },
  });
  if (existing) {
    if (existing.facturaMensualEmisionId === input.emisionId) {
      const link = await db.facturaEmisionNafDocumento.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return { ok: true, link: serializeNafLink(link) };
    }
    return {
      ok: false,
      code: "ALREADY_LINKED",
      message: "Este documento NAF ya está ligado a otra emisión",
    };
  }

  // Oracle may store NC/AN totals already negative; apply sign on |amount|.
  const absSubtotal = Math.abs(naf.subtotal);
  const absImpuesto = Math.abs(naf.impuesto);
  const absTotal = Math.abs(naf.total);
  const signedTotal = round2(sign * absTotal);
  const created = await db.facturaEmisionNafDocumento.create({
    data: {
      facturaMensualEmisionId: input.emisionId,
      nafNoCia: naf.noCia,
      nafTipoDoc: naf.tipoDoc,
      nafNoFactu: naf.noFactu,
      nafNoFisico: naf.noFisico,
      nafSerieFisico: naf.serieFisico,
      nafConsecutivoFe: naf.consecutivoFe,
      nafClaveFactura: naf.claveFactura,
      nafFecha: naf.fecha,
      subtotal: new Prisma.Decimal(absSubtotal.toFixed(2)),
      impuesto: new Prisma.Decimal(absImpuesto.toFixed(2)),
      total: new Prisma.Decimal(absTotal.toFixed(2)),
      amountSign: sign,
      signedTotal: new Prisma.Decimal(signedTotal.toFixed(2)),
      linkedById: input.userId ?? null,
    },
  });

  await recomputeEmisionFromNafLinks(db, input.emisionId, {
    plazoDays: tipo === "FC" ? naf.plazo : null,
    applyNafDates: tipo === "FC",
  });

  // User-selected form dates win over NAF FECHA/PLAZO defaults.
  const formDates: {
    invoiceReceivedAt?: Date | null;
    dueDate?: Date;
  } = {};
  if (input.invoiceReceivedAt !== undefined && input.invoiceReceivedAt !== null) {
    formDates.invoiceReceivedAt = input.invoiceReceivedAt;
  }
  if (input.dueDate != null) {
    formDates.dueDate = input.dueDate;
  }
  if (Object.keys(formDates).length > 0) {
    await db.facturaMensual.update({
      where: { id: input.facturaId },
      data: formDates,
    });
    if (formDates.invoiceReceivedAt !== undefined) {
      await db.facturaMensualEmision.update({
        where: { id: input.emisionId },
        data: { invoiceReceivedAt: formDates.invoiceReceivedAt },
      });
    }
  }

  return { ok: true, link: serializeNafLink(created) };
}

export type UnlinkNafResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "EMISION_MISMATCH"; message: string };

export async function unlinkNafDocumento(
  db: Db,
  input: { facturaId: string; emisionId: string; linkId: string },
): Promise<UnlinkNafResult> {
  const link = await db.facturaEmisionNafDocumento.findFirst({
    where: {
      id: input.linkId,
      facturaMensualEmisionId: input.emisionId,
      emision: { facturaMensualId: input.facturaId },
    },
    select: { id: true, facturaMensualEmisionId: true },
  });
  if (!link) {
    return { ok: false, code: "NOT_FOUND", message: "Vínculo NAF no encontrado" };
  }

  await db.facturaEmisionNafDocumento.delete({ where: { id: link.id } });
  await recomputeEmisionFromNafLinks(db, input.emisionId);
  return { ok: true };
}

export async function listEmisionNafLinks(
  db: Db,
  emisionId: string,
): Promise<FacturaEmisionNafLinkSerialized[]> {
  const rows = await db.facturaEmisionNafDocumento.findMany({
    where: { facturaMensualEmisionId: emisionId },
    orderBy: [{ nafFecha: "asc" }, { linkedAt: "asc" }],
  });
  return rows.map(serializeNafLink);
}
