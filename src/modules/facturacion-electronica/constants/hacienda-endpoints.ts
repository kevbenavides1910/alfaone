import type { FeAmbiente } from "@prisma/client";

/**
 * Staging: host api-sandbox.* (Bearer OAuth).
 * No usar api.comprobanteselectronicos.go.cr/recepcion-sandbox — responde 403 AWS.
 */
const STAGING = {
  token: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
  recepcion: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion",
  consulta: "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion",
} as const;

const PRODUCCION = {
  token: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
  recepcion: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion",
  consulta: "https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion",
} as const;

export function haciendaEndpoints(ambiente: FeAmbiente) {
  return ambiente === "PRODUCCION" ? PRODUCCION : STAGING;
}
