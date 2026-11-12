/**
 * Generadores de archivos bancarios — paridad FPLCK11 / Neo generarArchivoBancoTxt.
 * Fuente: NAF5.T_CHEQUES (pre-traslado) o NAF5.ARPLCK + ARPLME (post-traslado).
 */

import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { normalizeCodPla } from "@/modules/empleados-naf/services/revision-planilla-naf-write";

export type BancoArchivoCanal = "BN" | "DAV" | "CK";

export type BancoArchivoResult = {
  filename: string;
  contentType: string;
  body: string;
  empleados: number;
  total: number;
  fuente?: "t_cheques" | "arplck";
};

type ArchivoBancoRow = {
  noEmple: string;
  empleado: string;
  numCuenta: string;
  base: number;
  noCtaCia: string;
  fDesde: string | null;
  fHasta: string | null;
  cedula?: string | null;
  formaPago?: string | null;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pad0(n: number | string, width: number): string {
  const s = String(n ?? "");
  return s.length >= width ? s.slice(-width) : s.padStart(width, "0");
}

function fmtMontoNaf(base: number): string {
  return (Number(base) || 0).toFixed(2);
}

function pagoDetalleNaf(fDesde: string | null, fHasta: string | null): string {
  if (!fDesde || !fHasta) return "PAGO PLANILLA";
  const [y1, m1, d1] = fDesde.split("-");
  const [y2, m2, d2] = fHasta.split("-");
  return `PAGO: ${d1}/${m1}/${y1} AL ${d2}/${m2}/${y2}`;
}

function quincenaLabelNaf(fDesde: string | null): string {
  if (!fDesde) return "Pago Planilla";
  const day = Number(fDesde.slice(8, 10));
  const q = day >= 1 && day <= 15 ? "I Quincena" : "II Quincena";
  return `Pago Planilla ${q}`;
}

function calendarStamp(fHasta?: string | null): string {
  if (fHasta && fHasta.length >= 10) return fHasta.slice(0, 10).replace(/-/g, "");
  const d = new Date();
  return `${d.getFullYear()}${pad0(d.getMonth() + 1, 2)}${pad0(d.getDate(), 2)}`;
}

async function loadFilasArchivoBanco(opts: {
  noCia: string;
  codPla: string;
  banco: "01" | "07";
  fDesde?: string;
  fHasta?: string;
}): Promise<{ rows: ArchivoBancoRow[]; fuente: "t_cheques" | "arplck" }> {
  const noCia = opts.noCia.trim();
  const codPla = normalizeCodPla(opts.codPla);
  const banco = opts.banco;
  const fd = opts.fDesde?.slice(0, 10) || null;
  const fh = opts.fHasta?.slice(0, 10) || null;

  return withNafOracleConnection(async (conn) => {
    const t = await conn.execute<Record<string, unknown>>(
      `SELECT t.no_emple,
              NVL(t.empleado, e.nombre) AS empleado,
              e.num_cuenta,
              e.cedula,
              t.forma_pago,
              t.base,
              t.no_cta,
              TO_CHAR(TRUNC(p.f_desde),'YYYY-MM-DD') AS fd,
              TO_CHAR(TRUNC(p.f_hasta),'YYYY-MM-DD') AS fh
         FROM NAF5.T_CHEQUES t
         JOIN NAF5.ARPLME e
           ON e.no_cia = t.no_cia AND e.no_emple = t.no_emple
         LEFT JOIN NAF5.ARPLCP p
           ON p.no_cia = t.no_cia AND p.codpla = t.cod_pla
        WHERE t.no_cia = :cia
          AND t.banco = :banco
          AND t.forma_pago = 'T'
          AND NVL(t.ind_anulado, 'N') = 'N'
          AND LPAD(TRIM(t.cod_pla),2,'0') = :cod
        ORDER BY NVL(t.empleado, e.nombre), t.no_emple`,
      { cia: noCia, banco, cod: codPla },
    );
    if ((t.rows ?? []).length > 0) {
      return {
        fuente: "t_cheques" as const,
        rows: (t.rows ?? []).map((x) => ({
          noEmple: asString(x.NO_EMPLE) ?? "",
          empleado: asString(x.EMPLEADO) ?? "",
          numCuenta: asString(x.NUM_CUENTA) ?? "",
          base: Number(x.BASE) || 0,
          noCtaCia: asString(x.NO_CTA) ?? "",
          fDesde: asString(x.FD) || fd,
          fHasta: asString(x.FH) || fh,
          cedula: asString(x.CEDULA),
          formaPago: asString(x.FORMA_PAGO),
        })),
      };
    }

    const binds: Record<string, unknown> = { cia: noCia, banco, cod: codPla };
    let fechaSql = "";
    if (fd && fh) {
      fechaSql =
        " AND TRUNC(k.fecha) BETWEEN TO_DATE(:fd,'YYYY-MM-DD') AND TO_DATE(:fh,'YYYY-MM-DD')";
      binds.fd = fd;
      binds.fh = fh;
    }
    const h = await conn.execute<Record<string, unknown>>(
      `SELECT k.no_emple,
              e.nombre AS empleado,
              e.num_cuenta,
              e.cedula,
              e.forma_pago,
              k.monto AS base,
              k.no_cta
         FROM NAF5.ARPLCK k
         JOIN NAF5.ARPLME e
           ON e.no_cia = k.no_cia AND e.no_emple = k.no_emple
        WHERE k.no_cia = :cia
          AND k.banco = :banco
          AND LPAD(TRIM(k.cod_pla),2,'0') = :cod
          ${fechaSql}
        ORDER BY e.nombre, k.no_emple`,
      binds,
    );
    return {
      fuente: "arplck" as const,
      rows: (h.rows ?? []).map((x) => ({
        noEmple: asString(x.NO_EMPLE) ?? "",
        empleado: asString(x.EMPLEADO) ?? "",
        numCuenta: asString(x.NUM_CUENTA) ?? "",
        base: Number(x.BASE) || 0,
        noCtaCia: asString(x.NO_CTA) ?? "",
        fDesde: fd,
        fHasta: fh,
        cedula: asString(x.CEDULA),
        formaPago: asString(x.FORMA_PAGO),
      })),
    };
  });
}

function bodyDaviviendaNaf(rows: ArchivoBancoRow[]): string {
  const lines = rows.map((r) => {
    const detalle = pagoDetalleNaf(r.fDesde, r.fHasta);
    const q = quincenaLabelNaf(r.fDesde);
    return [r.numCuenta, r.empleado, fmtMontoNaf(r.base), detalle, q, q].join(",");
  });
  return lines.join("\r\n") + (lines.length ? "\r\n" : "");
}

async function bodyBncrNaf(
  noCia: string,
  noCtaCia: string,
  rows: ArchivoBancoRow[],
): Promise<string> {
  return withNafOracleConnection(async (conn) => {
    const cb = await conn.execute<Record<string, unknown>>(
      `SELECT cliente, cuenta, no_cta
         FROM NAF5.ARPLCB
        WHERE no_cia = :cia AND banco = '01' AND no_cta = :ncta
          AND ROWNUM = 1`,
      { cia: noCia, ncta: noCtaCia },
    );
    const cliente = asString(cb.rows?.[0]?.CLIENTE) ?? "";
    const cuentaCia = asString(cb.rows?.[0]?.CUENTA) ?? "";
    const totalCents = Math.round(rows.reduce((s, r) => s + r.base, 0) * 100);
    const totalStr = pad0(totalCents, 12);
    const fDesde = rows[0]?.fDesde || null;
    const fHasta = rows[0]?.fHasta || null;
    const pagoTxt = pagoDetalleNaf(fDesde, fHasta);
    const hoy = new Date();
    const ddmmyyyy = `${pad0(hoy.getDate(), 2)}${pad0(hoy.getMonth() + 1, 2)}${hoy.getFullYear()}`;

    const linea1 =
      `1${cliente}${ddmmyyyy}0000010000001` +
      `0000${totalStr}${pad0(0, 7)}${pad0(0, 7)}${pad0(0, 10)}`;
    const linea2 = `2${cuentaCia}00000001${totalStr}${pagoTxt}${pad0(0, 2)}`;
    const lineas3 = rows.map((r) => {
      const nc = (r.numCuenta || "").padEnd(22, " ");
      const pieza =
        nc.slice(7, 10) +
        nc.slice(0, 3) +
        nc.slice(4, 6) +
        nc.slice(11, 17) +
        nc.slice(18, 19);
      const monto = pad0(Math.round(r.base * 100), 12);
      return `3${pieza}00000001${monto}${pagoTxt}${pad0(0, 2)}`;
    });
    const sumCuentas = rows.reduce((s, r) => {
      const nc = (r.numCuenta || "").padEnd(22, " ");
      const piece = Number(nc.slice(11, 17).replace(/\D/g, "")) || 0;
      return s + piece;
    }, 0);
    const total200 = pad0(Math.round(rows.reduce((s, r) => s + r.base, 0) * 200), 15);
    const linea4 =
      `4${total200}${pad0(sumCuentas, 10)}${pad0(0, 10)}${pad0(0, 12)}${pad0(0, 12)}${pad0(0, 8)}`;
    return [linea1, linea2, ...lineas3, linea4].join("\r\n") + "\r\n";
  });
}

async function loadChequesCsv(opts: {
  noCia: string;
  codPla: string;
  fDesde?: string;
  fHasta?: string;
}): Promise<ArchivoBancoRow[]> {
  const noCia = opts.noCia.trim();
  const codPla = normalizeCodPla(opts.codPla);
  const fd = opts.fDesde?.slice(0, 10);
  const fh = opts.fHasta?.slice(0, 10);
  return withNafOracleConnection(async (conn) => {
    const t = await conn.execute<Record<string, unknown>>(
      `SELECT t.no_emple,
              NVL(t.empleado, e.nombre) AS empleado,
              e.cedula,
              e.num_cuenta,
              t.forma_pago,
              t.base,
              t.no_cta
         FROM NAF5.T_CHEQUES t
         JOIN NAF5.ARPLME e
           ON e.no_cia = t.no_cia AND e.no_emple = t.no_emple
        WHERE t.no_cia = :cia
          AND LPAD(TRIM(t.cod_pla),2,'0') = :cod
          AND t.forma_pago = 'K'
          AND NVL(t.ind_anulado,'N')='N'
        ORDER BY NVL(t.empleado, e.nombre), t.no_emple`,
      { cia: noCia, cod: codPla },
    );
    if ((t.rows ?? []).length > 0) {
      return (t.rows ?? []).map((x) => ({
        noEmple: asString(x.NO_EMPLE) ?? "",
        empleado: asString(x.EMPLEADO) ?? "",
        numCuenta: asString(x.NUM_CUENTA) ?? "",
        base: Number(x.BASE) || 0,
        noCtaCia: asString(x.NO_CTA) ?? "",
        fDesde: fd || null,
        fHasta: fh || null,
        cedula: asString(x.CEDULA),
        formaPago: asString(x.FORMA_PAGO),
      }));
    }
    const binds: Record<string, unknown> = { cia: noCia, cod: codPla };
    let fechaSql = "";
    if (fd && fh) {
      fechaSql =
        " AND TRUNC(k.fecha) BETWEEN TO_DATE(:fd,'YYYY-MM-DD') AND TO_DATE(:fh,'YYYY-MM-DD')";
      binds.fd = fd;
      binds.fh = fh;
    }
    const h = await conn.execute<Record<string, unknown>>(
      `SELECT k.no_emple, e.nombre AS empleado, e.cedula, e.num_cuenta,
              e.forma_pago, k.monto AS base, k.no_cta
         FROM NAF5.ARPLCK k
         JOIN NAF5.ARPLME e ON e.no_cia = k.no_cia AND e.no_emple = k.no_emple
        WHERE k.no_cia = :cia
          AND LPAD(TRIM(k.cod_pla),2,'0') = :cod
          AND e.forma_pago = 'K'
          ${fechaSql}
        ORDER BY e.nombre, k.no_emple`,
      binds,
    );
    return (h.rows ?? []).map((x) => ({
      noEmple: asString(x.NO_EMPLE) ?? "",
      empleado: asString(x.EMPLEADO) ?? "",
      numCuenta: asString(x.NUM_CUENTA) ?? "",
      base: Number(x.BASE) || 0,
      noCtaCia: asString(x.NO_CTA) ?? "",
      fDesde: fd || null,
      fHasta: fh || null,
      cedula: asString(x.CEDULA),
      formaPago: asString(x.FORMA_PAGO),
    }));
  });
}

/**
 * Archivo banco FPLCK11 desde NAF (paridad Neo).
 */
export async function generarArchivoBancoNaf(input: {
  noCia: string;
  codPla: string;
  canal: BancoArchivoCanal;
  fDesde?: string;
  fHasta?: string;
}): Promise<BancoArchivoResult> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const stamp = calendarStamp(input.fHasta);
  const baseName = `pago_${input.canal.toLowerCase()}_${noCia}_${codPla}_${stamp}`;

  if (input.canal === "CK") {
    const rows = await loadChequesCsv({
      noCia,
      codPla,
      fDesde: input.fDesde,
      fHasta: input.fHasta,
    });
    if (rows.length === 0) {
      throw new Error(
        `Sin cheques NAF (T_CHEQUES/ARPLCK forma K) para ${noCia}/${codPla}. Prepare primero (PLA_PREPARA_CK).`,
      );
    }
    const total = roundMoney(rows.reduce((s, r) => s + r.base, 0));
    const header = ["No.Emp", "Nombre", "Cedula", "F.Pago", "Neto"].join(";");
    const lines = rows.map((l) =>
      [
        l.noEmple,
        (l.empleado || "").replace(/;/g, ","),
        (l.cedula || "").replace(/\D/g, ""),
        l.formaPago ?? "K",
        fmtMontoNaf(l.base),
      ].join(";"),
    );
    const body = [header, ...lines, `TOTAL;${rows.length};;;${fmtMontoNaf(total)}`].join("\r\n");
    return {
      filename: `${baseName}_cheques.csv`,
      contentType: "text/csv; charset=utf-8",
      body: `\uFEFF${body}`,
      empleados: rows.length,
      total,
      fuente: "t_cheques",
    };
  }

  const banco = input.canal === "BN" ? "01" : "07";
  const { rows, fuente } = await loadFilasArchivoBanco({
    noCia,
    codPla,
    banco,
    fDesde: input.fDesde,
    fHasta: input.fHasta,
  });
  if (rows.length === 0) {
    throw new Error(
      `Sin transferencias NAF (T_CHEQUES/ARPLCK) para ${noCia}/${codPla} banco ${banco}. ` +
        `Flujo Codisa: Aprobar → Preparar (FPLCK01) → Archivo (FPLCK11) → Traslado.`,
    );
  }
  for (const r of rows) {
    if (input.fDesde) r.fDesde = input.fDesde.slice(0, 10);
    if (input.fHasta) r.fHasta = input.fHasta.slice(0, 10);
  }
  const total = roundMoney(rows.reduce((s, r) => s + r.base, 0));
  let body: string;
  if (banco === "07") {
    body = bodyDaviviendaNaf(rows);
  } else {
    const noCtaCia =
      rows.find((r) => r.noCtaCia)?.noCtaCia ||
      (await withNafOracleConnection(async (conn) => {
        const r = await conn.execute<{ NO_CTA: string }>(
          `SELECT no_cta FROM (
             SELECT no_cta FROM NAF5.ARPLCB
              WHERE no_cia = :cia AND banco = '01'
              ORDER BY CASE WHEN principal = 'S' THEN 0 ELSE 1 END, no_cta
           ) WHERE ROWNUM = 1`,
          { cia: noCia },
        );
        return asString(r.rows?.[0]?.NO_CTA) || "";
      }));
    body = await bodyBncrNaf(noCia, noCtaCia, rows);
  }
  const tag = banco === "01" ? "bncr" : "davivienda";
  return {
    filename: `banco-${tag}-${noCia}-${codPla}.txt`,
    contentType: "text/plain; charset=utf-8",
    body,
    empleados: rows.length,
    total,
    fuente,
  };
}

/**
 * Compat: si aún pasan loteId, resuelve noCia/codPla del lote y genera desde NAF.
 */
export async function generarArchivoBancoDesdeLote(
  loteId: string,
  canal: BancoArchivoCanal,
): Promise<BancoArchivoResult> {
  const { prisma } = await import("@/modules/core/db/prisma");
  const lote = await prisma.nafNominaPagoLote.findUnique({ where: { id: loteId } });
  if (!lote) throw new Error("Lote no encontrado");
  const fDesde =
    lote.fDesde instanceof Date
      ? lote.fDesde.toISOString().slice(0, 10)
      : String(lote.fDesde).slice(0, 10);
  const fHasta =
    lote.fHasta instanceof Date
      ? lote.fHasta.toISOString().slice(0, 10)
      : String(lote.fHasta).slice(0, 10);
  return generarArchivoBancoNaf({
    noCia: lote.noCia,
    codPla: lote.codPla,
    canal,
    fDesde,
    fHasta,
  });
}
