import { prisma } from "@/modules/core/db/prisma";
import { FeFacturaController } from "@/modules/facturacion-electronica/controllers/factura.controller";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

const feController = new FeFacturaController(prisma);

export function facturacionElectronicaTools(): SyntraTool[] {
  return [
    {
      permission: { key: "facturacionElectronica.facturas", level: "view" },
      definition: toolDef(
        "list_fe_facturas",
        "Lista comprobantes electrónicos emitidos (FE CR) por empresa, tipo y estado.",
        {
          type: "object",
          properties: {
            companyCode: { type: "string" },
            estado: {
              type: "string",
              enum: ["BORRADOR", "ENVIADO", "ACEPTADO", "RECHAZADO", "ANULADA"],
            },
            tipoDocumento: { type: "string" },
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando facturas electrónicas…",
      handler: async (session, args) => {
        const companyCode = await resolveFeCompanyCode(session, strArg(args, "companyCode") || undefined);
        const pageSize = intArg(args, "limit", 15, 25);
        const result = await feController.list(companyCode, {
          companyCode,
          estado: (strArg(args, "estado") || undefined) as
            | "BORRADOR"
            | "ENVIADO"
            | "ACEPTADO"
            | "RECHAZADO"
            | "ANULADA"
            | undefined,
          tipoDocumento: strArg(args, "tipoDocumento") || undefined,
          page: 1,
          pageSize,
        });
        return {
          facturas: result.items.map((f) => ({
            id: f.id,
            consecutivo: f.comprobante?.consecutivo ?? null,
            clave: f.comprobante?.claveNumerica ?? null,
            estado: f.estado,
            total: f.total?.toString?.() ?? f.total,
            fecha: f.fecha,
            cliente: f.cliente?.nombre ?? null,
          })),
          total: result.total,
          fuente: "Facturación electrónica CR",
        };
      },
    },
  ];
}
