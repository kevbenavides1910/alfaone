import { prisma } from "@/modules/core/db/prisma";
import { hasPermission } from "@/lib/permissions/check";
import { FeFacturaController } from "@/modules/facturacion-electronica/controllers/factura.controller";
import { FeGastoProveedorController } from "@/modules/facturacion-electronica/controllers/gasto-proveedor.controller";
import { resolveFeCompanyCode } from "@/modules/facturacion-electronica/middleware/require-fe-empresa-access";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg, strArg } from "./shared";

const feController = new FeFacturaController(prisma);
const gastoController = new FeGastoProveedorController(prisma);

function monthRangeIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return {
    desde: `${y}-${m}-01`,
    hasta: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

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
    {
      permission: { key: "facturacionElectronica.facturas", level: "view" },
      definition: toolDef(
        "query_fe_iva_por_tarifa",
        "Resumen de base gravable (total ventas/compras) e IVA por tarifa % para declaración. tipo=ventas|compras.",
        {
          type: "object",
          properties: {
            companyCode: { type: "string" },
            tipo: { type: "string", enum: ["ventas", "compras"] },
            desde: { type: "string", description: "YYYY-MM-DD" },
            hasta: { type: "string", description: "YYYY-MM-DD" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: (args) =>
        `Consultando IVA por tarifa (${strArg(args, "tipo") || "ventas"})…`,
      handler: async (session, args) => {
        const companyCode = await resolveFeCompanyCode(session, strArg(args, "companyCode") || undefined);
        const defaults = monthRangeIso();
        const desdeRaw = strArg(args, "desde") || defaults.desde;
        const hastaRaw = strArg(args, "hasta") || defaults.hasta;
        const desde = new Date(`${desdeRaw}T00:00:00`);
        const hasta = new Date(`${hastaRaw}T23:59:59`);
        const tipo = (strArg(args, "tipo") || "ventas").toLowerCase();

        if (tipo === "compras") {
          if (!hasPermission(session, "facturacionElectronica.gastos", "view")) {
            return { error: "Sin permiso para consultar gastos de proveedor" };
          }
          const result = await gastoController.resumen(companyCode, desde, hasta);
          return {
            tipo: "compras",
            desde: desdeRaw,
            hasta: hastaRaw,
            cantidad: result.cantidad,
            ivaPorTarifa: result.ivaPorTarifa,
            fuente: "FE gastos de proveedor (aceptados)",
          };
        }

        const result = await feController.resumenIva(companyCode, desde, hasta);
        return {
          tipo: "ventas",
          desde: desdeRaw,
          hasta: hastaRaw,
          cantidadFacturas: result.cantidadFacturas,
          cantidadNotasCredito: result.cantidadNotasCredito,
          cantidadNotasDebito: result.cantidadNotasDebito,
          ivaPorTarifa: result.ivaPorTarifa,
          fuente: "FE comprobantes aceptados (ventas − NC + ND)",
        };
      },
    },
  ];
}
