/**
 * Generadores de archivos bancarios a partir del lote preparado (ARPLCK / PG).
 * Layouts prácticos alineados a operación BN TXT / Davivienda del Excel de revisión.
 * Si el banco exige un formato fijo distinto, ajustar con un sample real.
 */

import { prisma } from "@/modules/core/db/prisma";

export type BancoArchivoCanal = "BN" | "DAV" | "CK";

export type BancoArchivoResult = {
  filename: string;
  contentType: string;
  body: string;
  empleados: number;
  total: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function decimalToNumber(value: { toNumber(): number } | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

function sanitizeCedula(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function moneyPlain(value: number): string {
  return roundMoney(value).toFixed(2);
}

export async function generarArchivoBancoDesdeLote(
  loteId: string,
  canal: BancoArchivoCanal,
): Promise<BancoArchivoResult> {
  const lote = await prisma.nafNominaPagoLote.findUnique({
    where: { id: loteId },
    include: { lineas: { orderBy: { noEmple: "asc" } } },
  });
  if (!lote) throw new Error("Lote no encontrado");
  if (lote.estado !== "preparado") throw new Error("El lote no está en estado preparado");

  const filterCanal = canal === "BN" ? "BN" : canal === "DAV" ? "DAV" : "CK";
  const lineas = lote.lineas.filter((l) => l.canal === filterCanal);
  const total = roundMoney(lineas.reduce((s, l) => s + decimalToNumber(l.liquido), 0));
  const stamp = calendarStamp(lote.fechaPago);
  const baseName = `pago_${canal.toLowerCase()}_${lote.noCia}_${lote.codPla}_${stamp}`;

  if (canal === "CK") {
    const header = ["No.Emp", "Nombre", "Cedula", "F.Pago", "Neto"].join(";");
    const rows = lineas.map((l) =>
      [
        l.noEmple,
        csvSafe(l.nombre ?? ""),
        sanitizeCedula(l.cedula),
        l.formaPago ?? "K",
        moneyPlain(decimalToNumber(l.liquido)),
      ].join(";"),
    );
    const body = [header, ...rows, `TOTAL;${lineas.length};;;${moneyPlain(total)}`].join("\r\n");
    return {
      filename: `${baseName}_cheques.csv`,
      contentType: "text/csv; charset=utf-8",
      body: `\uFEFF${body}`,
      empleados: lineas.length,
      total,
    };
  }

  if (canal === "DAV") {
    // Davivienda: cédula;IBAN/cuenta;monto;nombre;no_emple
    const header = ["Cedula", "Cuenta", "Monto", "Nombre", "NoEmp"].join(";");
    const rows = lineas.map((l) =>
      [
        sanitizeCedula(l.cedula),
        (l.numCuenta ?? "").replace(/\s+/g, ""),
        moneyPlain(decimalToNumber(l.liquido)),
        csvSafe(l.nombre ?? ""),
        l.noEmple,
      ].join(";"),
    );
    const body = [header, ...rows].join("\r\n");
    return {
      filename: `${baseName}_davivienda.txt`,
      contentType: "text/plain; charset=utf-8",
      body,
      empleados: lineas.length,
      total,
    };
  }

  // BN TXT: cédula;cuenta BN;monto;nombre;no_emple (delimitado ; )
  const header = ["Cedula", "Cuenta", "Monto", "Nombre", "NoEmp"].join(";");
  const rows = lineas.map((l) =>
    [
      sanitizeCedula(l.cedula),
      (l.numCuenta ?? "").replace(/\s+/g, ""),
      moneyPlain(decimalToNumber(l.liquido)),
      csvSafe(l.nombre ?? ""),
      l.noEmple,
    ].join(";"),
  );
  const body = [header, ...rows].join("\r\n");
  return {
    filename: `${baseName}_bn.txt`,
    contentType: "text/plain; charset=utf-8",
    body,
    empleados: lineas.length,
    total,
  };
}

function csvSafe(value: string): string {
  return value.replace(/;/g, ",").replace(/\r?\n/g, " ").trim();
}

function calendarStamp(value: Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${year}${month}${day}`;
}
