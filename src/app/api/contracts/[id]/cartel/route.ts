import { NextRequest } from "next/server";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import {
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  ok,
  serverError,
} from "@/lib/api/response";
import {
  CONTRACT_CARTEL_ROOT,
  contractCartelDir,
  cartelStoragePath,
  ALLOWED_CARTEL_MIMES,
  MAX_CARTEL_BYTES,
} from "@/modules/presupuestos/services/contract-cartel";
import { detectMimeFromBuffer, mimeMatchesDeclared } from "@/lib/security/file-validation";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type Ctx = { params: Promise<{ id: string }> };

const PERMISSION_KEY = "presupuestos.contracts" as const;

/** Sube (o reemplaza) el cartel de la licitación de este contrato. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, PERMISSION_KEY, "edit")) {
    return forbidden("No tiene permiso para cargar el cartel");
  }

  const { id } = await params;
  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, cartelStoragePath: true },
    });
    if (!contract) return notFound();

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("Archivo requerido");

    const blob = file as File;
    if (blob.size > MAX_CARTEL_BYTES) {
      return badRequest("Archivo demasiado grande (máximo 30 MB)");
    }

    const buf = Buffer.from(await blob.arrayBuffer());
    const detected = detectMimeFromBuffer(buf);
    const declared = blob.type || "application/octet-stream";
    if (!ALLOWED_CARTEL_MIMES.has(declared)) {
      return badRequest("Tipo de archivo no permitido (PDF, imagen o Word)");
    }
    if (!mimeMatchesDeclared(detected, declared)) {
      return badRequest("El contenido del archivo no coincide con el tipo declarado");
    }
    const mime = detected !== "application/octet-stream" ? detected : declared;

    const originalName = (blob.name || "cartel").slice(0, 255);
    const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const storedName = `${Date.now()}_${safe}`;

    const dir = contractCartelDir(id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, storedName), buf);

    const rel = cartelStoragePath(id, storedName);
    const row = await prisma.contract.update({
      where: { id },
      data: {
        cartelFileName: originalName,
        cartelMimeType: mime,
        cartelStoragePath: rel,
        cartelUploadedAt: new Date(),
      },
      select: {
        id: true,
        cartelFileName: true,
        cartelMimeType: true,
        cartelUploadedAt: true,
      },
    });

    // Borrar el archivo anterior cuando se reemplaza
    if (contract.cartelStoragePath && contract.cartelStoragePath !== rel) {
      const viejo = resolveUnderRoot(CONTRACT_CARTEL_ROOT, contract.cartelStoragePath);
      if (viejo) await unlink(viejo).catch(() => undefined);
    }

    return created({
      ...row,
      cartelUploadedAt: row.cartelUploadedAt?.toISOString() ?? null,
      viewUrl: `/api/contracts/${id}/cartel`,
    });
  } catch (e) {
    return serverError("Error al cargar el cartel", e);
  }
}

/** Devuelve los datos del cartel cargado (metadatos). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, PERMISSION_KEY, "view")) {
    return forbidden();
  }

  const { id } = await params;
  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        cartelFileName: true,
        cartelMimeType: true,
        cartelStoragePath: true,
        cartelUploadedAt: true,
      },
    });
    if (!contract) return notFound();

    // ?file=1 → entrega el archivo (para el botón «Ver cartel»)
    const quiereArchivo = req.nextUrl.searchParams.get("file") === "1";
    if (!quiereArchivo) {
      return ok({
        hasCartel: Boolean(contract.cartelStoragePath),
        fileName: contract.cartelFileName,
        mimeType: contract.cartelMimeType,
        uploadedAt: contract.cartelUploadedAt?.toISOString() ?? null,
        viewUrl: contract.cartelStoragePath ? `/api/contracts/${id}/cartel?file=1` : null,
      });
    }

    if (!contract.cartelStoragePath) return notFound();
    const abs = resolveUnderRoot(CONTRACT_CARTEL_ROOT, contract.cartelStoragePath);
    if (!abs) return notFound();
    const buf = await readFile(abs).catch(() => null);
    if (!buf) return notFound();

    const mime = contract.cartelMimeType || "application/octet-stream";
    const inline =
      req.nextUrl.searchParams.get("download") !== "1" &&
      (mime.startsWith("image/") || mime === "application/pdf");

    return new Response(buf, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(
          contract.cartelFileName || "cartel"
        )}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return serverError("Error al leer el cartel", e);
  }
}

/** Quita el cartel del contrato. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, PERMISSION_KEY, "edit")) {
    return forbidden("No tiene permiso para quitar el cartel");
  }

  const { id } = await params;
  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { cartelStoragePath: true },
    });
    if (!contract) return notFound();

    if (contract.cartelStoragePath) {
      const abs = resolveUnderRoot(CONTRACT_CARTEL_ROOT, contract.cartelStoragePath);
      if (abs) await unlink(abs).catch(() => undefined);
    }
    await prisma.contract.update({
      where: { id },
      data: {
        cartelFileName: null,
        cartelMimeType: null,
        cartelStoragePath: null,
        cartelUploadedAt: null,
      },
    });
    return ok({ ok: true });
  } catch (e) {
    return serverError("Error al quitar el cartel", e);
  }
}
