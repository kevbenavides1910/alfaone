import type { FeConsecutivo, FePuntoVenta, FeSucursal } from "@prisma/client";

export type FeConsecutivoPublic = Omit<FeConsecutivo, "ultimoNumero"> & {
  ultimoNumero: string;
};

export type FePuntoVentaPublic = Omit<FePuntoVenta, "consecutivos"> & {
  consecutivos: FeConsecutivoPublic[];
};

export type FeSucursalPublic = Omit<FeSucursal, "puntosVenta"> & {
  puntosVenta: FePuntoVentaPublic[];
};

function serializeFeConsecutivo(row: FeConsecutivo): FeConsecutivoPublic {
  return {
    ...row,
    ultimoNumero: row.ultimoNumero.toString(),
  };
}

export function serializeFePuntoVenta(
  row: FePuntoVenta & { consecutivos: FeConsecutivo[] }
): FePuntoVentaPublic {
  return {
    ...row,
    consecutivos: row.consecutivos.map(serializeFeConsecutivo),
  };
}

export function serializeFeSucursales(
  rows: Array<FeSucursal & { puntosVenta: Array<FePuntoVenta & { consecutivos: FeConsecutivo[] }> }>
): FeSucursalPublic[] {
  return rows.map((sucursal) => ({
    ...sucursal,
    puntosVenta: sucursal.puntosVenta.map(serializeFePuntoVenta),
  }));
}
