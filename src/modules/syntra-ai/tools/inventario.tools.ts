import { listAssets } from "@/modules/inventario/services/assets";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

export function inventarioTools(): SyntraTool[] {
  return [
    {
      permission: { key: "inventario.assets", level: "view" },
      definition: toolDef(
        "search_assets",
        "Busca activos del inventario por código, nombre, marca, modelo o contrato.",
        {
          type: "object",
          properties: {
            q: { type: "string", description: "Texto a buscar." },
            contractId: { type: "string", description: "Filtrar por contrato." },
            status: {
              type: "string",
              enum: ["IN_STOCK", "ASSIGNED", "PENDING_RETURN", "RETIRED"],
            },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) => {
        const q = strArg(args ?? {}, "q");
        return q ? `Buscando activos «${q.slice(0, 40)}»…` : "Buscando activos…";
      },
      handler: async (_session, args) => {
        const limit = intArg(args, "limit", 20, 25);
        const rows = await listAssets({
          q: strArg(args, "q") || null,
          contractId: strArg(args, "contractId") || null,
          status: (typeof args.status === "string" ? args.status : null) as
            | "IN_STOCK"
            | "ASSIGNED"
            | "PENDING_RETURN"
            | "RETIRED"
            | null,
          limit,
        });
        return {
          activos: rows.map((a) => ({
            id: a.id,
            codigo: a.code,
            nombre: a.name,
            marca: a.brand,
            modelo: a.model,
            estado: a.status,
            contrato: a.currentPosition?.location?.contract
              ? {
                  licitacion: a.currentPosition.location.contract.licitacionNo,
                  cliente: a.currentPosition.location.contract.client,
                }
              : null,
          })),
          total: rows.length,
          fuente: "Inventario Alfa One",
        };
      },
    },
  ];
}
