import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * PDFs CCSS suelen venir cifrados. pdf-lib con ignoreEncryption genera archivos
 * inválidos (Adobe error 132). qpdf normaliza/desencripta antes de editar.
 */
export async function preparePdfBufferForEdit(buffer: Buffer): Promise<Buffer> {
  const id = crypto.randomBytes(8).toString("hex");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "alfa-pdf-"));
  const inputPath = path.join(dir, `${id}-in.pdf`);
  const outputPath = path.join(dir, `${id}-out.pdf`);

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync("qpdf", ["--decrypt", inputPath, outputPath], {
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    const out = await fs.readFile(outputPath);
    if (out.length < 5 || out.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("qpdf no produjo un PDF válido");
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOENT") || msg.includes("qpdf")) {
      throw new Error(
        "qpdf no está instalado en el servidor. Contacte al administrador del sistema.",
      );
    }
    throw new Error(`No se pudo preparar el PDF para edición: ${msg}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
