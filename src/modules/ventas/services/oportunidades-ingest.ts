import { prisma } from "@/modules/core/db/prisma";
import type { OportunidadIngestInput } from "../validations/oportunidad.schema";
import { createOportunidad } from "./oportunidades";
import { normalizeLicitacionNo } from "./normalize-licitacion";

export type IngestResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  createdIds: string[];
  updatedLicitaciones: string[];
  skippedLicitaciones: string[];
};

function toItems(input: OportunidadIngestInput): Record<string, unknown>[] {
  if ("licitaciones" in input) {
    return input.licitaciones.map((item) => ({ ...item, source: "n8n" }));
  }
  return [{ ...input, source: "n8n" }];
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalDecimal(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const cleaned = value.replace(/\[.*?\]/, "").replace(/\./g, "").replace(/,/g, ".").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? cleaned : null;
}

function extractCurrency(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/\[([A-Z]+)\]/);
  return match ? match[1] : null;
}

/** Registra o actualiza licitaciones (upsert por numero de licitacion). */
export async function ingestOportunidades(input: OportunidadIngestInput): Promise<IngestResult> {
  const items = toItems(input);
  const result: IngestResult = {
    total: items.length,
    created: 0,
    updated: 0,
    skipped: 0,
    createdIds: [],
    updatedLicitaciones: [],
    skippedLicitaciones: [],
  };

  for (const item of items) {
    const licitacionNo = normalizeLicitacionNo(String(item.licitacionNo));
    const existing = await prisma.ventasOportunidad.findUnique({ where: { licitacionNo } });

    if (!existing) {
      const { created, row } = await createOportunidad(item as never);
      if (created) {
        result.created += 1;
        result.createdIds.push(row.id);
        if (item.inicioRecepcion || item.montoContratacion) {
          await prisma.ventasOportunidad.update({
            where: { id: row.id },
            data: {
              inicioRecepcion: parseOptionalDate(item.inicioRecepcion),
              cierreRecepcion: parseOptionalDate(item.cierreRecepcion),
              montoContratacion: parseOptionalDecimal(item.montoContratacion),
              monedaContratacion: extractCurrency(item.montoContratacion),
              fechaAclaracion: parseOptionalDate(item.fechaAclaracion),
              fechaObjeciones: parseOptionalDate(item.fechaObjeciones),
              sicopUpdatedAt: new Date(),
            },
          });
        }
      } else {
        result.skipped += 1;
        result.skippedLicitaciones.push(licitacionNo);
      }
    } else {
      const hasDetail = item.inicioRecepcion || item.cierreRecepcion || item.montoContratacion || item.fechaAclaracion || item.fechaObjeciones;
      if (hasDetail) {
        await prisma.ventasOportunidad.update({
          where: { id: existing.id },
          data: {
            inicioRecepcion: parseOptionalDate(item.inicioRecepcion),
            cierreRecepcion: parseOptionalDate(item.cierreRecepcion),
            montoContratacion: parseOptionalDecimal(item.montoContratacion),
            monedaContratacion: extractCurrency(item.montoContratacion),
            fechaAclaracion: parseOptionalDate(item.fechaAclaracion),
            fechaObjeciones: parseOptionalDate(item.fechaObjeciones),
            enlace: item.enlace ? String(item.enlace).trim() : existing.enlace,
            sicopUpdatedAt: new Date(),
          },
        });
        result.updated += 1;
        result.updatedLicitaciones.push(licitacionNo);
      } else {
        result.skipped += 1;
        result.skippedLicitaciones.push(licitacionNo);
      }
    }
  }

  return result;
}
