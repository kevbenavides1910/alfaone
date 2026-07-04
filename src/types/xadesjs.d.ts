declare module "xadesjs" {
  export type XadesXmlDocument = {
    documentElement: {
      appendChild(node: unknown): void;
    };
  };

  export const Application: {
    setEngine(name: string, crypto: Crypto): void;
  };

  export function Parse(xml: string): XadesXmlDocument;

  export function setNodeDependencies(deps: Record<string, unknown>): void;

  export class SignedXml {
    Sign(
      algorithm: Algorithm,
      key: CryptoKey,
      data: XadesXmlDocument,
      options?: Record<string, unknown>
    ): Promise<{ GetXml(): unknown | null }>;
  }
}

declare module "xmldsigjs" {
  export const Application: {
    setEngine(name: string, crypto: Crypto): void;
  };
}

declare module "xpath" {
  const xpath: unknown;
  export = xpath;
}
