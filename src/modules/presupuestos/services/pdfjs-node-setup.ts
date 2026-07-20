import path from "node:path";
import { pathToFileURL } from "node:url";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/** Carga pdfjs-dist en Node/Docker: canvas nativo + worker del paquete. */
export async function loadPdfJsForNode(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      // Debe cargarse antes que pdfjs para evitar "DOMMatrix is not defined".
      await import("@napi-rs/canvas");

      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

      const workerPath = path.join(
        process.cwd(),
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      );

      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

      return pdfjs;
    })();
  }

  return pdfjsPromise;
}
