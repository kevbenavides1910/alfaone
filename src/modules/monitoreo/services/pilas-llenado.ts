import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";
import type { MonitoreoImagenRef } from "./imagenes";
import { parseImagenesJson } from "./imagenes";

function parsePct(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(String(raw).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

/** Genera recomendaciones operativas según niveles de desmane / paneo. */
export function generarRecomendaciones(desmane: string | null | undefined, paneo: string | null | undefined): string {
  const d = parsePct(desmane);
  const p = parsePct(paneo);
  const tips: string[] = [];

  const evalNivel = (label: string, pct: number | null) => {
    if (pct == null) {
      tips.push(`${label}: sin dato — capturar nivel en campo.`);
      return;
    }
    if (pct <= 20) tips.push(`${label} crítico (${pct}%) — llenar de inmediato y notificar motorizado.`);
    else if (pct <= 40) tips.push(`${label} bajo (${pct}%) — programar llenado en las próximas 24 h.`);
    else if (pct <= 60) tips.push(`${label} medio (${pct}%) — monitoreo preventivo; coordinar relleno si hay ruta cerca.`);
    else if (pct <= 80) tips.push(`${label} adecuado (${pct}%) — mantener seguimiento diario.`);
    else tips.push(`${label} alto (${pct}%) — sin acción urgente.`);
  };

  evalNivel("Desmane", d);
  evalNivel("Paneo", p);

  if (d != null && p != null && d <= 40 && p <= 40) {
    tips.push("Ambas pilas bajas: priorizar esta finca en la ruta de llenado del día.");
  }

  return tips.join("\n");
}

function dayOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type PilaLlenadoInput = {
  fecha?: Date;
  finca: string;
  pilaFincaId?: string | null;
  desmane?: string | null;
  paneo?: string | null;
  observaciones?: string | null;
  imagenes?: MonitoreoImagenRef[];
  operadorName: string;
  operadorId?: string | null;
};

export async function upsertPilaLlenado(input: PilaLlenadoInput) {
  const fecha = dayOnly(input.fecha ?? new Date());
  const recomendaciones = generarRecomendaciones(input.desmane, input.paneo);

  const catalog = input.pilaFincaId
    ? await prisma.bandecoPilaFinca.findUnique({ where: { id: input.pilaFincaId } })
    : await prisma.bandecoPilaFinca.findUnique({ where: { finca: input.finca } });

  const imagenesJson = (input.imagenes ?? []) as unknown as Prisma.InputJsonValue;

  return prisma.bandecoPilaLlenado.upsert({
    where: { fecha_finca: { fecha, finca: input.finca } },
    create: {
      fecha,
      finca: input.finca,
      pilaFincaId: catalog?.id ?? input.pilaFincaId ?? null,
      desmane: input.desmane ?? null,
      paneo: input.paneo ?? null,
      observaciones: input.observaciones ?? null,
      recomendaciones,
      operadorName: input.operadorName,
      operadorId: input.operadorId ?? null,
      imagenes: imagenesJson,
    },
    update: {
      pilaFincaId: catalog?.id ?? input.pilaFincaId ?? null,
      desmane: input.desmane ?? null,
      paneo: input.paneo ?? null,
      observaciones: input.observaciones ?? null,
      recomendaciones,
      operadorName: input.operadorName,
      operadorId: input.operadorId ?? null,
      ...(input.imagenes !== undefined ? { imagenes: imagenesJson } : {}),
    },
  });
}

export async function upsertPilasLlenadoBatch(
  rows: Omit<PilaLlenadoInput, "operadorName" | "operadorId">[],
  operador: { name: string; id?: string | null },
) {
  const results = [];
  for (const row of rows) {
    results.push(
      await upsertPilaLlenado({
        ...row,
        operadorName: operador.name,
        operadorId: operador.id ?? null,
      }),
    );
  }
  return results;
}

export async function listPilasLlenado(fecha: Date) {
  const day = dayOnly(fecha);
  return prisma.bandecoPilaLlenado.findMany({
    where: { fecha: day },
    orderBy: { finca: "asc" },
  });
}

export async function buildReportePilasDia(fecha: Date) {
  const fincas = await prisma.bandecoPilaFinca.findMany({ orderBy: { finca: "asc" } });
  const llenados = await listPilasLlenado(fecha);
  const byFinca = new Map(llenados.map((l) => [l.finca, l]));

  const fechaLabel = fecha.toLocaleDateString("es-CR");
  const lines: string[] = [`REPORTE LLENADO DE PILAS — ${fechaLabel}`, ""];
  const recomendaciones: string[] = ["RECOMENDACIONES:", ""];

  for (const f of fincas) {
    const row = byFinca.get(f.finca);
    const desmane = row?.desmane ?? f.desmane;
    const paneo = row?.paneo ?? f.paneo;
    lines.push(
      [
        `FINCA: ${f.finca}`,
        desmane ? `DESMANE: ${desmane}` : null,
        paneo ? `PANEO: ${paneo}` : null,
        f.zonaMotorizado ? `ZONA: ${f.zonaMotorizado}` : null,
        row?.observaciones || f.observaciones ? `OBS: ${row?.observaciones ?? f.observaciones}` : null,
        row ? "✓ registrado hoy" : "⚠ sin registro diario",
      ]
        .filter(Boolean)
        .join(" | "),
    );

    const rec = row?.recomendaciones ?? generarRecomendaciones(desmane, paneo);
    if (rec) {
      recomendaciones.push(`• ${f.finca}`);
      recomendaciones.push(...rec.split("\n").map((t) => `  - ${t}`));
      recomendaciones.push("");
    }
  }

  return {
    reporte: lines.join("\n"),
    recomendaciones: recomendaciones.join("\n"),
    completo: [...lines, "", ...recomendaciones].join("\n"),
    llenados: llenados.map((l) => ({
      ...l,
      imagenes: parseImagenesJson(l.imagenes),
    })),
  };
}
