import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  executeRows,
  asString,
  asNumber,
  asIsoDate,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";

/**
 * Lectura (solo) del calendario de gastos fijos / pagos proveniente de APEX
 * (Oracle `ALFA.CALENDARIO_PAGOS_V` y `ALFA.CALENDARIO_PAGOS_BASE_V`, que leen
 * vía dblink `@dlalfa` las tablas ADMFINC.CALENDARIO_PAGOS(_BASE)).
 *
 * El marcado pagado/pendiente NO se escribe en Oracle: se persiste localmente
 * en el modelo `Payment` (Postgres) como overlay, unido por `apexPagoId`.
 */

export type ApexCalendarioPagoRow = {
  pagoId: number;
  pagoBaseId: number;
  fechaPago: string; // ISO yyyy-mm-dd
  montoPagado: number;
  atendido: string; // 'S' | 'N'
  observacion: string | null;
};

export type ApexCalendarioPagoBaseRow = {
  pagoBaseId: number;
  descripcion: string;
  monto: number;
  ciaPaga: string | null;
  tipo: string | null;
  periodicidad: string | null;
  fechaSiguiente: string | null;
};

/**
 * Ocurrencias de pago del calendario APEX.
 * Con `from`/`to` (ISO yyyy-mm-dd, to exclusivo) filtra por FECHA_PAGO
 * para no traer todo el histórico en cada sync de un mes.
 */
export async function listApexCalendarioPagos(range?: {
  from: string;
  to: string;
}): Promise<ApexCalendarioPagoRow[]> {
  return withNafOracleConnection(async (conn) => {
    if (range) {
      const rows = await executeRows(
        conn,
        `SELECT ID_CALENDARIO_PAGO, ID_CALENDARIO_PAGOS_BASE, FECHA_PAGO,
                MONTO_PAGADO, ATENDIDO, OBSERVACION
         FROM ALFA.CALENDARIO_PAGOS_V
         WHERE ACTIVO = 1
           AND FECHA_PAGO >= TO_DATE(:fromDay, 'YYYY-MM-DD')
           AND FECHA_PAGO < TO_DATE(:toDay, 'YYYY-MM-DD')`,
        { fromDay: range.from, toDay: range.to },
      );
      return rows.map(mapPago);
    }
    const rows = await executeRows(
      conn,
      `SELECT ID_CALENDARIO_PAGO, ID_CALENDARIO_PAGOS_BASE, FECHA_PAGO,
              MONTO_PAGADO, ATENDIDO, OBSERVACION
       FROM ALFA.CALENDARIO_PAGOS_V
       WHERE ACTIVO = 1`,
    );
    return rows.map(mapPago);
  });
}

function mapPago(row: OracleRow): ApexCalendarioPagoRow {
  return {
    pagoId: asNumber(row.ID_CALENDARIO_PAGO) ?? 0,
    pagoBaseId: asNumber(row.ID_CALENDARIO_PAGOS_BASE) ?? 0,
    fechaPago: asIsoDate(row.FECHA_PAGO) ?? "",
    montoPagado: asNumber(row.MONTO_PAGADO) ?? 0,
    atendido: asString(row.ATENDIDO) ?? "N",
    observacion: asString(row.OBSERVACION),
  };
}

/** Gastos fijos recurrentes (base) del calendario APEX. */
export async function listApexCalendarioPagosBase(): Promise<ApexCalendarioPagoBaseRow[]> {
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT ID_CALENDARIO_PAGOS_BASE, DESCRIPCION, MONTO, CIA_PAGA, TIPO, PERIODICIDAD, FECHA_SIGUIENTE
       FROM ALFA.CALENDARIO_PAGOS_BASE_V
       WHERE ACTIVO = 1`,
    );
    return rows.map(mapBase);
  });
}

function mapBase(row: OracleRow): ApexCalendarioPagoBaseRow {
  return {
    pagoBaseId: asNumber(row.ID_CALENDARIO_PAGOS_BASE) ?? 0,
    descripcion: asString(row.DESCRIPCION) ?? "",
    monto: asNumber(row.MONTO) ?? 0,
    ciaPaga: asString(row.CIA_PAGA),
    tipo: asString(row.TIPO),
    periodicidad: asString(row.PERIODICIDAD),
    fechaSiguiente: asIsoDate(row.FECHA_SIGUIENTE),
  };
}