import type { FeAmbiente } from "@prisma/client";
import { FE_IDENTIFICACION_CODIGO } from "../../constants/hacienda-catalogos";
import { haciendaEndpoints } from "../../constants/hacienda-endpoints";
import { FeHaciendaError } from "../../errors/fe-errors";
import { formatFeFechaApi } from "../../utils/fe-fecha";
import { feLogger } from "../../utils/logger";

export type FeEnvioHaciendaParams = {
  ambiente: FeAmbiente;
  token: string;
  clave: string;
  fechaEmision: Date;
  emisorTipo: keyof typeof FE_IDENTIFICACION_CODIGO;
  emisorIdentificacion: string;
  receptorTipo?: keyof typeof FE_IDENTIFICACION_CODIGO;
  receptorIdentificacion?: string;
  xmlFirmado: string;
};

export type FeEnvioHaciendaResult = {
  httpStatus: number;
  body: string;
  headers: Record<string, string>;
  duplicateReceipt?: boolean;
};

function collectHeaders(res: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  return headers;
}

function isDuplicateReceipt(status: number, body: string, headers: Record<string, string>): boolean {
  if (status !== 400) return false;
  const cause = (headers["x-error-cause"] ?? "").toLowerCase();
  const text = body.toLowerCase();
  return cause.includes("ya fue recibido") || text.includes("ya fue recibido");
}

function buildRejectionMessage(status: number, body: string, headers: Record<string, string>): string {
  const cause = headers["x-error-cause"]?.trim();
  const detail = body.trim() || cause || "sin detalle del servidor";
  return `Hacienda rechazó recepción (${status}): ${detail.slice(0, 500)}`;
}

export class FeEnvioHaciendaService {
  async enviarComprobante(params: FeEnvioHaciendaParams): Promise<FeEnvioHaciendaResult> {
    const endpoints = haciendaEndpoints(params.ambiente);
    const payload: Record<string, unknown> = {
      clave: params.clave,
      fecha: formatFeFechaApi(params.fechaEmision),
      emisor: {
        tipoIdentificacion: FE_IDENTIFICACION_CODIGO[params.emisorTipo],
        numeroIdentificacion: params.emisorIdentificacion.replace(/\D/g, ""),
      },
      comprobanteXml: Buffer.from(params.xmlFirmado, "utf8").toString("base64"),
    };

    if (params.receptorIdentificacion && params.receptorTipo) {
      payload.receptor = {
        tipoIdentificacion: FE_IDENTIFICACION_CODIGO[params.receptorTipo],
        numeroIdentificacion: params.receptorIdentificacion.replace(/\D/g, ""),
      };
    }

    const started = Date.now();
    const res = await fetch(endpoints.recepcion, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.text();
    const headers = collectHeaders(res);

    feLogger.info("Comprobante enviado a Hacienda", {
      clave: params.clave,
      httpStatus: res.status,
      duracionMs: Date.now() - started,
      xErrorCause: headers["x-error-cause"],
    });

    if (res.status === 202 || res.status === 200 || res.status === 201) {
      return { httpStatus: res.status, body, headers };
    }

    if (isDuplicateReceipt(res.status, body, headers)) {
      return {
        httpStatus: res.status,
        body,
        headers,
        duplicateReceipt: true,
      };
    }

    throw new FeHaciendaError(buildRejectionMessage(res.status, body, headers));
  }
}

export const feEnvioHaciendaService = new FeEnvioHaciendaService();
