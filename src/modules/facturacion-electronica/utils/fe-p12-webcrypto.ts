import { createPrivateKey } from "node:crypto";
import forge from "node-forge";
import { FeDomainError } from "../errors/fe-errors";

export type FeP12WebCryptoCredentials = {
  privateKey: CryptoKey;
  certificateDer: ArrayBuffer;
  certificatePem: string;
};

const OID_PKCS8_SHROUDED_KEY_BAG = "1.2.840.113549.1.12.10.1.2";
const OID_CERT_BAG = "1.2.840.113549.1.12.10.1.3";

export async function loadP12ForWebCrypto(
  p12Buffer: Buffer,
  pin: string
): Promise<FeP12WebCryptoCredentials> {
  try {
    const p12DerString = forge.util.binary.raw.encode(new Uint8Array(p12Buffer));
    const p12Asn1 = forge.asn1.fromDer(p12DerString);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pin);

    const keyBags = p12.getBags({ bagType: OID_PKCS8_SHROUDED_KEY_BAG });
    const keyBagArray = keyBags[OID_PKCS8_SHROUDED_KEY_BAG];
    if (!keyBagArray?.[0]?.key) {
      throw new FeDomainError("No se encontró llave privada en el .p12", "FE_CERT_PARSE_ERROR");
    }

    const certBags = p12.getBags({ bagType: OID_CERT_BAG });
    const certBagArray = certBags[OID_CERT_BAG];
    if (!certBagArray?.[0]?.cert) {
      throw new FeDomainError("No se encontró certificado en el .p12", "FE_CERT_PARSE_ERROR");
    }

    const pemKey = forge.pki.privateKeyToPem(keyBagArray[0].key);
    const forgeCert = certBagArray[0].cert;
    const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(forgeCert)).getBytes();
    const certificateDer = Buffer.from(certDerBytes, "binary");
    const certificatePem = forge.pki.certificateToPem(forgeCert);

    const nodeKeyObject = createPrivateKey(pemKey);
    const pkcs8Der = nodeKeyObject.export({ type: "pkcs8", format: "der" });

    const privateKey = await globalThis.crypto.subtle.importKey(
      "pkcs8",
      pkcs8Der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const certUint8 = new Uint8Array(certificateDer);
    const certArrayBuffer = certUint8.buffer.slice(
      certUint8.byteOffset,
      certUint8.byteOffset + certUint8.byteLength
    ) as ArrayBuffer;

    return { privateKey, certificateDer: certArrayBuffer, certificatePem };
  } catch (e) {
    if (e instanceof FeDomainError) throw e;
    throw new FeDomainError(
      "Certificado .p12 inválido o contraseña incorrecta",
      "FE_CERT_PARSE_ERROR"
    );
  }
}
