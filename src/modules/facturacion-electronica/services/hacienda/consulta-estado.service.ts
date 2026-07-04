import type { FeAmbiente } from "@prisma/client";
import { mapHaciendaIndEstado } from "../../constants/hacienda-catalogos";
import { haciendaEndpoints } from "../../constants/hacienda-endpoints";
import { FeHaciendaError } from "../../errors/fe-errors";
import { extractRespuestaXmlFromConsultaRaw } from "../../utils/hacienda-respuesta-xml";
import { feLogger } from "../../utils/logger";

export type FeConsultaEstadoResult = {
  httpStatus: number;
  raw: string;
  indEstado?: string;
  mensaje?: string;
  respuestaXml?: string;
  mapped: ReturnType<typeof mapHaciendaIndEstado>;
};

export class FeConsultaEstadoService {
  async consultar(params: {
    ambiente: FeAmbiente;
    token: string;
    clave: string;
  }): Promise<FeConsultaEstadoResult> {
    const endpoints = haciendaEndpoints(params.ambiente);
    const url = `${endpoints.consulta}/${encodeURIComponent(params.clave)}`;

    const started = Date.now();
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${params.token}` },
    });

    const raw = await res.text();
    feLogger.info("Consulta estado Hacienda", {
      clave: params.clave,
      httpStatus: res.status,
      duracionMs: Date.now() - started,
    });

    if (res.status === 404) {
      return {
        httpStatus: res.status,
        raw,
        indEstado: "procesando",
        mapped: mapHaciendaIndEstado("procesando"),
      };
    }

    if (!res.ok) {
      throw new FeHaciendaError(`Error consultando estado (${res.status}): ${raw.slice(0, 400)}`);
    }

    let indEstado: string | undefined;
    let mensaje: string | undefined;
    const respuestaXml = extractRespuestaXmlFromConsultaRaw(raw) ?? undefined;

    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      indEstado =
        String(json["ind-estado"] ?? json.indEstado ?? json.estado ?? "").trim() || undefined;
      mensaje =
        String(json.mensaje ?? json.detalle ?? "").slice(0, 2000) ||
        (respuestaXml ? respuestaXml.slice(0, 2000) : undefined);
    } catch {
      const match = raw.match(/ind[-_]?estado["\s:>]+([a-zA-Z_]+)/i);
      indEstado = match?.[1];
    }

    const mapped = mapHaciendaIndEstado(indEstado ?? "procesando");

    return {
      httpStatus: res.status,
      raw,
      indEstado,
      mensaje,
      respuestaXml,
      mapped,
    };
  }
}

export const feConsultaEstadoService = new FeConsultaEstadoService();
