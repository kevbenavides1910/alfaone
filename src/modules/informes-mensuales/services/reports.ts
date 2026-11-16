import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { monthlyReportsUploadRoot } from "@/lib/storage/paths";
import { detectMimeFromBuffer, mimeMatchesDeclared } from "@/lib/security/file-validation";
import { resolveUnderRoot } from "@/lib/security/path-safety";

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_XLS = "application/vnd.ms-excel";
const MIME_PDF = "application/pdf";
const MIME_CSV = "text/csv";

export const MAX_MONTHLY_REPORT_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MONTHLY_REPORT_MIMES = new Set([MIME_XLSX, MIME_XLS, MIME_PDF, MIME_CSV]);
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".pdf", ".csv"]);

/** Plantilla oficial que se entrega a los usuarios (no se sirve desde /public). */
const TEMPLATE_FILE = path.join(
  process.cwd(),
  "assets",
  "informes-mensuales",
  "INFORME_DEL_MONTE_base.xlsx",
);

export class MonthlyReportError extends Error {
  code: "BAD_REQUEST" | "NOT_FOUND";

  constructor(message: string, code: "BAD_REQUEST" | "NOT_FOUND" = "BAD_REQUEST") {
    super(message);
    this.name = "MonthlyReportError";
    this.code = code;
  }
}

export type MonthlyReportDto = {
  id: string;
  period: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
  downloadUrl: string;
};

type MonthlyReportRow = {
  id: string;
  period: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
  note: string | null;
  uploadedById: string;
  uploadedByName: string;
  createdAt: Date;
};

function toDto(row: MonthlyReportRow): MonthlyReportDto {
  return {
    id: row.id,
    period: row.period,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    note: row.note,
    uploadedById: row.uploadedById,
    uploadedByName: row.uploadedByName,
    createdAt: row.createdAt.toISOString(),
    downloadUrl: `/api/informes-mensuales/${row.id}/file`,
  };
}

function assertPeriod(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new MonthlyReportError("El mes debe tener el formato AAAA-MM");
  }
}

function safeFileName(fileName: string) {
  const safe = (fileName || "informe.xlsx").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || "informe.xlsx";
}

export async function readMonthlyReportTemplate(): Promise<Buffer> {
  try {
    return await readFile(TEMPLATE_FILE);
  } catch {
    throw new MonthlyReportError("La plantilla base no está disponible", "NOT_FOUND");
  }
}

export async function listMonthlyReports(period?: string): Promise<MonthlyReportDto[]> {
  if (period) assertPeriod(period);
  const rows = await prisma.monthlyReport.findMany({
    where: period ? { period } : undefined,
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDto);
}

export async function saveMonthlyReport(input: {
  period: string;
  userId: string;
  userName: string;
  fileName: string;
  declaredMime: string;
  buffer: Buffer;
  note: string | null;
}): Promise<MonthlyReportDto> {
  assertPeriod(input.period);

  if (input.buffer.length === 0) throw new MonthlyReportError("El archivo está vacío");
  if (input.buffer.length > MAX_MONTHLY_REPORT_BYTES) {
    throw new MonthlyReportError("Archivo demasiado grande (máximo 20 MB)");
  }

  const extension = path.extname(input.fileName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new MonthlyReportError("Formato no permitido (Excel .xlsx/.xls, PDF o CSV)");
  }

  const detected = detectMimeFromBuffer(input.buffer);
  if (!mimeMatchesDeclared(detected, input.declaredMime)) {
    throw new MonthlyReportError("El contenido del archivo no coincide con el tipo declarado");
  }
  const mimeType = detected !== "application/octet-stream" ? detected : input.declaredMime;
  if (!ALLOWED_MONTHLY_REPORT_MIMES.has(mimeType)) {
    throw new MonthlyReportError("Formato no permitido (Excel .xlsx/.xls, PDF o CSV)");
  }

  const root = monthlyReportsUploadRoot();
  const dir = path.join(root, input.period);
  await mkdir(dir, { recursive: true });

  const storedName = `${Date.now()}_${safeFileName(input.fileName)}`;
  await writeFile(path.join(dir, storedName), input.buffer);

  const row = await prisma.monthlyReport.create({
    data: {
      period: input.period,
      fileName: input.fileName.slice(0, 255),
      mimeType,
      storagePath: path.posix.join(input.period, storedName),
      sizeBytes: input.buffer.length,
      note: input.note,
      uploadedById: input.userId,
      uploadedByName: input.userName,
    },
  });

  return toDto(row);
}

export async function getMonthlyReportFile(id: string) {
  const row = await prisma.monthlyReport.findUnique({ where: { id } });
  if (!row) throw new MonthlyReportError("Informe no encontrado", "NOT_FOUND");

  const abs = resolveUnderRoot(monthlyReportsUploadRoot(), row.storagePath);
  if (!abs) throw new MonthlyReportError("Informe no encontrado", "NOT_FOUND");

  return { row, abs };
}

export async function deleteMonthlyReport(id: string): Promise<void> {
  const { abs } = await getMonthlyReportFile(id);
  await prisma.monthlyReport.delete({ where: { id } });
  await unlink(abs).catch(() => undefined);
}
