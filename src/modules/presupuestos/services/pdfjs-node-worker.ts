import path from "node:path";
import { pathToFileURL } from "node:url";

let configured = false;

/** Configura el worker de pdfjs-dist en Node (Docker standalone / API route). */
export function ensurePdfJsWorker(pdfjs: {
  GlobalWorkerOptions: { workerSrc: string };
}): void {
  if (configured) return;

  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );

  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
  configured = true;
}
