import { create } from "xmlbuilder2";
import { formatFeFechaEmisionXml } from "../../../utils/fe-fecha";

const NS = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeReceptor";

export type FeMensajeReceptorXmlInput = {
  claveComprobanteRecibido: string;
  cedulaEmisor: string;
  fechaEmisionMensaje: Date;
  tipoMensaje: string;
  detalleMensaje?: string | null;
  montoTotalImpuesto?: number | null;
  montoTotal?: number | null;
};

function dec(value: number | null | undefined, digits = 5) {
  return (value ?? 0).toFixed(digits);
}

export function buildMensajeReceptorXml(input: FeMensajeReceptorXmlInput): string {
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("MensajeReceptor", { xmlns: NS });

  root.ele("Clave").txt(input.claveComprobanteRecibido);
  root.ele("NumeroCedulaEmisor").txt(input.cedulaEmisor.replace(/\D/g, ""));
  root.ele("FechaEmisionMensaje").txt(formatFeFechaEmisionXml(input.fechaEmisionMensaje));
  root.ele("Mensaje").txt(input.tipoMensaje);
  if (input.detalleMensaje?.trim()) {
    root.ele("DetalleMensaje").txt(input.detalleMensaje.trim().slice(0, 250));
  }
  if (input.montoTotalImpuesto != null) {
    root.ele("MontoTotalImpuesto").txt(dec(input.montoTotalImpuesto));
  }
  if (input.montoTotal != null) {
    root.ele("MontoTotal").txt(dec(input.montoTotal));
  }

  return root.end({ prettyPrint: false });
}
