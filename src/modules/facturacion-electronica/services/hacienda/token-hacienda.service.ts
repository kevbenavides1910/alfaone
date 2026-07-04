import type { FeAmbiente, FeEmpresa } from "@prisma/client";
import { HACIENDA_CLIENT_ID } from "../../constants/hacienda-catalogos";
import { haciendaEndpoints } from "../../constants/hacienda-endpoints";
import { FeDomainError, FeHaciendaError } from "../../errors/fe-errors";
import { decryptCertPassword } from "../../utils/crypto-certificado";
import { resolveAtvUsernameForToken, resolveAtvPasswordEncForToken, isTribuAtvUsuario } from "../../utils/fe-atv-usuario";
import { feLogger } from "../../utils/logger";

type TokenCacheEntry = { token: string; expiresAtMs: number };

const tokenCache = new Map<string, TokenCacheEntry>();

export class FeTokenHaciendaService {
  async obtenerToken(empresa: FeEmpresa): Promise<string> {
    const cacheKey = `${empresa.companyCode}:${empresa.ambiente}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now() + 30_000) {
      return cached.token;
    }

    const username = resolveAtvUsernameForToken(empresa);
    if (empresa.ambiente === "STAGING" && username && !isTribuAtvUsuario(username)) {
      throw new FeDomainError(
        "En pruebas (Tribu) use el usuario completo tipo cpf-…@stag.comprobanteselectronicos.go.cr, no solo la cédula. Guarde de nuevo en Configuración → Credenciales ATV.",
        "FE_ATV_USUARIO_TRIBU"
      );
    }
    const atvPasswordEnc = resolveAtvPasswordEncForToken(empresa);
    if (!atvPasswordEnc) {
      const label = empresa.ambiente === "STAGING" ? "pruebas (Staging)" : "producción";
      throw new FeDomainError(
        `Configure la contraseña ATV de Hacienda (${label}) en configuración del emisor`,
        "FE_ATV_PASSWORD_REQUERIDA"
      );
    }

    const password = decryptCertPassword(atvPasswordEnc);
    const endpoints = haciendaEndpoints(empresa.ambiente);
    const clientId = HACIENDA_CLIENT_ID[empresa.ambiente];

    const body = new URLSearchParams({
      grant_type: "password",
      client_id: clientId,
      username,
      password,
    });

    const started = Date.now();
    const res = await fetch(endpoints.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const text = await res.text();
    feLogger.info("Token Hacienda solicitado", {
      companyCode: empresa.companyCode,
      ambiente: empresa.ambiente,
      httpStatus: res.status,
      duracionMs: Date.now() - started,
    });

    if (!res.ok) {
      const hint =
        res.status === 401
          ? " Usuario o contraseña ATV incorrectos. En Tribu pruebas use el usuario @stag.comprobanteselectronicos.go.cr completo."
          : "";
      throw new FeHaciendaError(`Error obteniendo token Hacienda (${res.status}): ${text.slice(0, 300)}${hint}`);
    }

    let json: { access_token?: string; expires_in?: number };
    try {
      json = JSON.parse(text) as { access_token?: string; expires_in?: number };
    } catch {
      throw new FeHaciendaError("Respuesta token Hacienda no es JSON válido");
    }

    if (!json.access_token) {
      throw new FeHaciendaError("Token Hacienda sin access_token");
    }

    const ttlSec = json.expires_in ?? 300;
    tokenCache.set(cacheKey, {
      token: json.access_token,
      expiresAtMs: Date.now() + ttlSec * 1000,
    });

    return json.access_token;
  }

  clearCache(companyCode: string, ambiente: FeAmbiente) {
    tokenCache.delete(`${companyCode}:${ambiente}`);
  }
}

export const feTokenHaciendaService = new FeTokenHaciendaService();
