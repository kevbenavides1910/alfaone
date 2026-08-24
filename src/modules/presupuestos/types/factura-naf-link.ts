/** Vínculo emisión ↔ documento NAF (serializado para API/UI). */
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
