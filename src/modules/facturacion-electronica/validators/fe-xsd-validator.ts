import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FeComprobanteTipo } from "@prisma/client";
import { FE_XML_ROOT_BY_TIPO } from "../constants/tipos-comprobante";
import { FeDomainError } from "../errors/fe-errors";
import { feLogger } from "../utils/logger";

const FE_XSD_BASE = "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4";

function xsdUrlForTipo(tipo: FeComprobanteTipo): string | null {
  const root = FE_XML_ROOT_BY_TIPO[tipo];
  if (!root) return null;
  const folder = `${root.charAt(0).toLowerCase()}${root.slice(1)}`;
  return `${FE_XSD_BASE}/${folder}/${root}_V4.4.xsd`;
}

function xmllintAvailable(): boolean {
  try {
    execFileSync("xmllint", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validación XSD opcional pre-envío. Activar con FE_XSD_VALIDATE=1.
 * Requiere `xmllint` (libxml2) en el servidor.
 */
export function validateFeXmlXsdOptional(xml: string, tipo: FeComprobanteTipo) {
  if (process.env.FE_XSD_VALIDATE !== "1") return;

  const xsdUrl = xsdUrlForTipo(tipo);
  if (!xsdUrl) return;

  if (!xmllintAvailable()) {
    feLogger.warn("FE_XSD_VALIDATE=1 pero xmllint no está instalado; se omite validación XSD.");
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "fe-xsd-"));
  const xmlPath = join(dir, "comprobante.xml");

  try {
    writeFileSync(xmlPath, xml, "utf8");
    execFileSync("xmllint", ["--noout", "--schema", xsdUrl, xmlPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const message =
      e instanceof Error && "stderr" in e && typeof (e as NodeJS.ErrnoException & { stderr?: string }).stderr === "string"
        ? (e as NodeJS.ErrnoException & { stderr: string }).stderr.trim()
        : e instanceof Error
          ? e.message
          : String(e);
    throw new FeDomainError(`XML no cumple esquema v4.4: ${message.slice(0, 500)}`, "FE_XSD_VALIDATION", 400);
  }
}
