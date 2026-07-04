import { join } from "node:path";
import { FeDomainError } from "../errors/fe-errors";

let nativeReq: NodeRequire | null = null;
let initialized = false;

/**
 * Require nativo fuera del bundle webpack.
 * Next inyecta un `process` limitado (sin getBuiltinModule); Function() lee el process real de Node.
 */
function getNativeRequire(): NodeRequire {
  if (nativeReq) return nativeReq;

  const serverEntry = join(process.cwd(), "server.js");
  const Module = Function('return process.getBuiltinModule("module")')() as typeof import("node:module");
  if (!Module?.createRequire) {
    throw new FeDomainError(
      "Node no expone createRequire (getBuiltinModule)",
      "FE_FIRMA_INIT_ERROR"
    );
  }
  nativeReq = Module.createRequire(serverEntry);
  return nativeReq;
}

/**
 * Registra DOMParser/xpath en xadesjs/xmldsigjs antes de firmar.
 */
export function ensureFeXadesBootstrap(): void {
  if (initialized) return;

  try {
    const req = getNativeRequire();
    const bootstrapPath = join(process.cwd(), "scripts/fe-xades-bootstrap.cjs");

    try {
      req(bootstrapPath).ensureFeXadesBootstrap();
    } catch {
      // Fallback inline (p. ej. dev sin scripts/ copiado al standalone)
      const path = req("path") as typeof import("node:path");
      const { DOMImplementation, DOMParser, XMLSerializer } = req("@xmldom/xmldom") as typeof import("@xmldom/xmldom");
      const xpath = req("xpath") as typeof import("xpath");
      type NodeDeps = {
        DOMParser: typeof DOMParser;
        XMLSerializer: typeof XMLSerializer;
        DOMImplementation: typeof DOMImplementation;
        xpath: typeof xpath;
      };
      type XadesRuntime = {
        setNodeDependencies: (deps: NodeDeps) => void;
        Application: { setEngine: (name: string, crypto: Crypto) => void };
      };
      const xadesjs = req("xadesjs") as XadesRuntime;
      const xmldsigjs = req("xmldsigjs") as XadesRuntime;

      const deps: NodeDeps = { DOMParser, XMLSerializer, DOMImplementation, xpath };
      xadesjs.setNodeDependencies(deps);

      for (const pkgName of ["xmldsigjs", "xadesjs"] as const) {
        try {
          const pkgRoot = path.dirname(req.resolve(`${pkgName}/package.json`));
          const utils = req(path.join(pkgRoot, "node_modules/xml-core/build/cjs/utils.js")) as {
            setNodeDependencies: (d: typeof deps) => void;
          };
          utils.setNodeDependencies(deps);
        } catch {
          // Sin copia anidada de xml-core
        }
      }

      xmldsigjs.Application.setEngine("NodeJS", globalThis.crypto as Crypto);
      xadesjs.Application.setEngine("NodeJS", globalThis.crypto as Crypto);
    }

    initialized = true;
  } catch (e) {
    throw new FeDomainError(
      `No se pudo inicializar firma XAdES: ${e instanceof Error ? e.message : String(e)}`,
      "FE_FIRMA_INIT_ERROR"
    );
  }
}

/** Mismo require nativo para xadesjs/@xmldom tras el bootstrap. */
export function feNativeRequire(): NodeRequire {
  return getNativeRequire();
}
