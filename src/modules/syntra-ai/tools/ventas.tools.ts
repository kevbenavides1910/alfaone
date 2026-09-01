import { listOportunidades } from "@/modules/ventas/services/oportunidades-list";
import { listPresupuestos } from "@/modules/ventas/services/presupuestos-list";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function ventasTools(): SyntraTool[] {
  return [
    {
      permission: { key: "ventas.presupuestos", level: "view" },
      definition: toolDef(
        "list_presupuestos",
        "Busca presupuestos de ventas por licitación, nombre o texto.",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            licitacionNo: { type: "string" },
            estado: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Buscando presupuestos de ventas…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 15, 25);
        const result = await listPresupuestos({
          q: strArg(args, "q") || undefined,
          licitacionNo: strArg(args, "licitacionNo") || undefined,
          estado: (strArg(args, "estado") || undefined) as "BORRADOR" | "ENVIADO" | "ADJUDICADO" | "PERDIDO" | undefined,
          page: 1,
          pageSize: limit,
        });
        return {
          presupuestos: result.rows.map((p) => ({
            id: p.id,
            licitacion: p.licitacionNo,
            nombre: p.nombre,
            compania: p.compania,
            estado: p.estado,
            total: p.totalMensual,
            oportunidad: p.oportunidad?.cliente ?? null,
          })),
          total: result.total,
          fuente: "Ventas — presupuestos",
        };
      },
    },
    {
      permission: { key: "ventas.oportunidades", level: "view" },
      definition: toolDef(
        "list_oportunidades",
        "Busca oportunidades comerciales (licitaciones, clientes, fechas SICOP).",
        {
          type: "object",
          properties: {
            q: { type: "string" },
            cliente: { type: "string" },
            estado: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Buscando oportunidades comerciales…",
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 15, 25);
        const result = await listOportunidades({
          q: strArg(args, "q") || undefined,
          cliente: strArg(args, "cliente") || undefined,
          estado: (strArg(args, "estado") || undefined) as
            | "PROSPECTO"
            | "EN_PROCESO"
            | "ADJUDICADA"
            | "PERDIDA"
            | "CANCELADA"
            | undefined,
          page: 1,
          pageSize: limit,
        });
        return {
          oportunidades: result.rows.map((o) => ({
            id: o.id,
            licitacion: o.licitacionNo,
            cliente: o.cliente,
            estado: o.estado,
            fechaPresentacion: o.fechaPresentacion,
            montoContratacion: o.montoContratacion,
          })),
          resumenEstado: result.resumenEstado,
          total: result.total,
          fuente: "Ventas — oportunidades",
        };
      },
    },
  ];
}
