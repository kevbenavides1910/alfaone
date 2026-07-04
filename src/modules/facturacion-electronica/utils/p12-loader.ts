import forge from "node-forge";
import { FeDomainError } from "../errors/fe-errors";

export type P12Material = {
  privateKeyPem: string;
  certificatePem: string;
};

export function loadP12Material(p12Buffer: Buffer, password: string): P12Material {
  try {
    const binary = p12Buffer.toString("binary");
    const asn1 = forge.asn1.fromDer(binary);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);

    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    const keyBag =
      keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
      p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];

    const certBag = certBags[forge.pki.oids.certBag]?.[0];

    if (!keyBag?.key || !certBag?.cert) {
      throw new FeDomainError(
        "No se pudo extraer llave/certificado del archivo .p12",
        "FE_CERT_PARSE_ERROR"
      );
    }

    return {
      privateKeyPem: forge.pki.privateKeyToPem(keyBag.key),
      certificatePem: forge.pki.certificateToPem(certBag.cert),
    };
  } catch (e) {
    if (e instanceof FeDomainError) throw e;
    throw new FeDomainError(
      "Certificado .p12 inválido o contraseña incorrecta",
      "FE_CERT_PARSE_ERROR"
    );
  }
}
