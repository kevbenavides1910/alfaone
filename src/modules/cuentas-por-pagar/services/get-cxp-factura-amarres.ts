import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { labelMonedaCxp } from "../business/cxp-status";
import type { CxpAmarresParamsInput } from "../validations/cxp-list.schema";

export type CxpAmarreRow = {
  id: string;
  pagoTipoDoc: string;
  pagoNoDocu: string;
  pagoNoFisico: string | null;
  pagoFecha: string | null;
  pagoMonto: number | null;
  pagoSaldo: number | null;
  pagoNoProve: string | null;
  montoAplicado: number;
  montoRefe: number;
  fechaAplicacion: string | null;
  ano: number | null;
  mes: number | null;
  procesado: boolean;
  moneda: string | null;
  monedaLabel: string;
};

export type CxpAmarresResult = {
  rows: CxpAmarreRow[];
  fetchedAt: string;
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

function asIsoDate(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function getCxpFacturaAmarres(
  input: CxpAmarresParamsInput,
): Promise<CxpAmarresResult> {
  const binds: Record<string, unknown> = {
    noCia: input.noCia.trim(),
    tipoDoc: input.tipoDoc.trim(),
    noDocu: input.noDocu.trim(),
  };

  let proveJoin = "";
  if (input.noProve?.trim()) {
    proveJoin = "AND p.NO_PROVE = :noProve";
    binds.noProve = input.noProve.trim();
  }

  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `
      SELECT
        r.TIPO_DOC AS PAGO_TIPO,
        r.NO_DOCU AS PAGO_NO,
        r.MONTO,
        r.MONTO_REFE,
        r.MONEDA_REFE,
        r.FEC_APLIC,
        r.ANO,
        r.MES,
        r.IND_PROCESADO,
        p.NO_PROVE AS PAGO_PROVE,
        p.NO_FISICO AS PAGO_FISICO,
        p.FECHA AS PAGO_FECHA,
        p.MONTO AS PAGO_MONTO,
        p.SALDO AS PAGO_SALDO
      FROM NAF5.ARCPRD r
      LEFT JOIN NAF5.ARCPMD p
        ON p.NO_CIA = r.NO_CIA
       AND p.TIPO_DOC = r.TIPO_DOC
       AND p.NO_DOCU = r.NO_DOCU
       ${proveJoin}
      WHERE r.NO_CIA = :noCia
        AND r.TIPO_REFE = :tipoDoc
        AND r.NO_REFE = :noDocu
      ORDER BY r.FEC_APLIC DESC NULLS LAST, r.NO_DOCU DESC
      `,
      binds,
    );

    const rows = (result.rows ?? []).map((raw) => {
      const row = raw as OracleRow;
      const pagoTipo = asString(row.PAGO_TIPO) ?? "";
      const pagoNo = asString(row.PAGO_NO) ?? "";
      const moneda = asString(row.MONEDA_REFE);
      return {
        id: `${pagoTipo}-${pagoNo}`,
        pagoTipoDoc: pagoTipo,
        pagoNoDocu: pagoNo,
        pagoNoFisico: asString(row.PAGO_FISICO),
        pagoFecha: asIsoDate(row.PAGO_FECHA),
        pagoMonto: row.PAGO_MONTO == null ? null : asNumber(row.PAGO_MONTO),
        pagoSaldo: row.PAGO_SALDO == null ? null : asNumber(row.PAGO_SALDO),
        pagoNoProve: asString(row.PAGO_PROVE),
        montoAplicado: asNumber(row.MONTO),
        montoRefe: asNumber(row.MONTO_REFE),
        fechaAplicacion: asIsoDate(row.FEC_APLIC),
        ano: row.ANO == null ? null : asNumber(row.ANO),
        mes: row.MES == null ? null : asNumber(row.MES),
        procesado: (asString(row.IND_PROCESADO) ?? "N").toUpperCase() === "S",
        moneda,
        monedaLabel: labelMonedaCxp(moneda),
      };
    });

    return { rows, fetchedAt: new Date().toISOString() };
  });
}
