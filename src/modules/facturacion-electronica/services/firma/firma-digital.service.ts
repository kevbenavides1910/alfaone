import { readFile, writeFile } from "fs/promises";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { FE_XML_ROOT_BY_TIPO } from "../../constants/tipos-comprobante";
import {
  FE_XADES_POLICY_HASH,
  FE_XADES_POLICY_URI,
} from "../../constants/xades-policy";
import type { FeComprobanteTipo } from "@prisma/client";
import { FeDomainError } from "../../errors/fe-errors";
import { decryptCertPassword } from "../../utils/crypto-certificado";
import { ensureFeDir, feRelativePath, feXmlDir, FE_STORAGE_ROOT } from "../../utils/fe-storage";
import { loadP12ForWebCrypto } from "../../utils/fe-p12-webcrypto";
import { ensureFeXadesBootstrap, feNativeRequire } from "../../utils/fe-xades-bootstrap";

function nativeRequire(): NodeRequire {
  return feNativeRequire();
}

export class FeFirmaDigitalService {
  async firmarXmlFromP12(params: {
    companyCode: string;
    comprobanteId: string;
    claveNumerica: string;
    p12RelativePath: string;
    p12PasswordEnc: string;
    xml: string;
    xmlRootLocalName?: string;
    comprobanteTipo?: FeComprobanteTipo;
  }): Promise<{ xmlFirmado: string; relativePath: string }> {
    const absP12 = resolveUnderRoot(FE_STORAGE_ROOT, params.p12RelativePath);
    if (!absP12) throw new FeDomainError("Ruta de certificado inválida", "FE_CERT_PATH_INVALID");

    const p12Buffer = await readFile(absP12);
    const password = decryptCertPassword(params.p12PasswordEnc);

    const rootName =
      params.xmlRootLocalName ??
      (params.comprobanteTipo ? FE_XML_ROOT_BY_TIPO[params.comprobanteTipo] : null) ??
      detectXmlRootLocalName(params.xml);

    if (!rootName) {
      throw new FeDomainError("No se pudo determinar el elemento raíz del XML", "FE_XML_ROOT_UNKNOWN");
    }

    const xmlFirmado = await this.signXmlXadesEpes(params.xml, p12Buffer, password);

    const dir = feXmlDir(params.companyCode, params.comprobanteId);
    await ensureFeDir(dir);
    const fileName = `${params.claveNumerica}-firmado.xml`;
    const relativePath = feRelativePath(params.companyCode, "xml", params.comprobanteId, fileName);
    const absOut = resolveUnderRoot(FE_STORAGE_ROOT, relativePath);
    if (!absOut) throw new FeDomainError("Ruta XML firmado inválida", "FE_XML_PATH_INVALID");
    await writeFile(absOut, xmlFirmado, "utf8");

    return { xmlFirmado, relativePath };
  }

  private async signXmlXadesEpes(xml: string, p12Buffer: Buffer, pin: string): Promise<string> {
    ensureFeXadesBootstrap();

    try {
      const req = nativeRequire();
      const xadesjs = req("xadesjs") as typeof import("xadesjs");
      const { XMLSerializer } = req("@xmldom/xmldom") as typeof import("@xmldom/xmldom");

      const credentials = await loadP12ForWebCrypto(p12Buffer, pin);
      const certBase64 = Buffer.from(credentials.certificateDer).toString("base64");
      const xmlDoc = xadesjs.Parse(xml) as {
        documentElement: { appendChild: (node: unknown) => void };
      };
      const signedXml = new xadesjs.SignedXml();
      const sigId = `xmldsig-${randomHexId()}`;

      const signatureXml = await signedXml.Sign(
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as Algorithm,
        credentials.privateKey,
        xmlDoc,
        {
          policy: {
            identifier: { value: FE_XADES_POLICY_URI },
            hash: "SHA-256",
            digestValue: FE_XADES_POLICY_HASH,
            qualifiers: [FE_XADES_POLICY_URI],
          },
          signingCertificate: certBase64,
          signingTime: { value: new Date() },
          references: [
            {
              id: `r-${randomHexId()}`,
              uri: "",
              hash: "SHA-256",
              transforms: ["enveloped", "c14n"],
            },
          ],
          x509: [certBase64],
          id: sigId,
        }
      );

      const rootElement = xmlDoc.documentElement;
      const signatureNode = signatureXml.GetXml();
      if (!signatureNode) {
        throw new FeDomainError("La firma XAdES no generó un nodo Signature", "FE_FIRMA_ERROR");
      }
      rootElement.appendChild(signatureNode);

      const serializer = new XMLSerializer();
      type XmldomNode = Parameters<InstanceType<typeof XMLSerializer>["serializeToString"]>[0];
      return serializer.serializeToString(xmlDoc as unknown as XmldomNode);
    } catch (e) {
      if (e instanceof FeDomainError) throw e;
      throw new FeDomainError(
        `Error al firmar XML (XAdES-EPES): ${e instanceof Error ? e.message : String(e)}`,
        "FE_FIRMA_ERROR"
      );
    }
  }
}

function detectXmlRootLocalName(xml: string): string | null {
  const match = xml.match(/<([A-Za-z][\w.-]*)(?:\s|>)/);
  return match?.[1] ?? null;
}

function randomHexId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("hex");
}

export const feFirmaDigitalService = new FeFirmaDigitalService();
