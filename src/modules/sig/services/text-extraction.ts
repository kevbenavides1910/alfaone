import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";
import * as XLSX from "xlsx";

const execFileAsync = promisify(execFile);
const MAX_STORED_CHARS = 500_000;
const OCR_LANG = "spa+eng";
const MIN_NATIVE_TEXT_CHARS = 80;

function normalizeText(raw: string): string {
  return raw
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_STORED_CHARS);
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "sig-text-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runTesseractOnFile(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "tesseract",
    [filePath, "stdout", "-l", OCR_LANG, "--psm", "3"],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  return stdout;
}

async function ocrImageBuffer(buffer: Buffer, ext: string): Promise<string> {
  return withTempDir(async (dir) => {
    const imgPath = path.join(dir, `image.${ext}`);
    await fs.writeFile(imgPath, buffer);
    return runTesseractOnFile(imgPath);
  });
}

async function ocrPdfBuffer(buffer: Buffer): Promise<string> {
  return withTempDir(async (dir) => {
    const pdfPath = path.join(dir, "document.pdf");
    await fs.writeFile(pdfPath, buffer);
    const prefix = path.join(dir, "page");
    await execFileAsync("pdftoppm", ["-png", "-r", "200", pdfPath, prefix]);

    const entries = await fs.readdir(dir);
    const pages = entries
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    const parts: string[] = [];
    for (const page of pages.slice(0, 40)) {
      const text = await runTesseractOnFile(path.join(dir, page));
      if (text.trim()) parts.push(text);
    }
    return parts.join("\n\n");
  });
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  const native = normalizeText(parsed.text ?? "");
  if (native.length >= MIN_NATIVE_TEXT_CHARS) return native;
  const ocr = normalizeText(await ocrPdfBuffer(buffer));
  return ocr || native;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value ?? "");
}

function extractXlsxText(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    parts.push(XLSX.utils.sheet_to_csv(sheet));
  }
  return normalizeText(parts.join("\n"));
}

function extractPlainText(buffer: Buffer): string {
  return normalizeText(new TextDecoder("utf-8", { fatal: false }).decode(buffer));
}

/** Extrae texto del archivo para indexación y búsqueda por contenido. */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  if (mimeType === "application/pdf" || ext === ".pdf") {
    return extractPdfText(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    return extractDocxText(buffer);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === ".xlsx" ||
    ext === ".xls"
  ) {
    return extractXlsxText(buffer);
  }

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    const imageExt = ext.replace(".", "") || "png";
    return normalizeText(await ocrImageBuffer(buffer, imageExt === "jpeg" ? "jpg" : imageExt));
  }

  if (mimeType.startsWith("text/") || ext === ".csv" || ext === ".txt") {
    return extractPlainText(buffer);
  }

  return "";
}

export function scheduleSigVersionTextIndex(versionId: string) {
  void import("./text-index")
    .then(({ indexSigDocumentVersionText }) => indexSigDocumentVersionText(versionId))
    .catch((err) => {
      console.error("[SIG] Error programando indexación de texto:", versionId, err);
    });
}
