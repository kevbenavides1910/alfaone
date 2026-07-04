/**
 * Emisión de prueba FE en producción (KBA / staging Tribu).
 * Uso: docker cp scripts/fe-emit-prueba.mjs security_contracts_app:/tmp/fe-emit-prueba.mjs
 *      docker exec security_contracts_app node /tmp/fe-emit-prueba.mjs
 */
const { PrismaClient } = require("@prisma/client");

const COMPANY = "KBA";
const SUBTOTAL = 1_500_000;
const IVA = 195_000;
const TOTAL = SUBTOTAL + IVA;

async function loadServices(prisma) {
  const runtime = require("/app/.next/server/webpack-runtime.js");
  const emisionMod = runtime((runtime.s = 32444));
  const facturaMod = runtime((runtime.s = 38597));
  return {
    emision: new emisionMod.P(prisma),
    facturas: new facturaMod.u(prisma),
  };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // Corregir terminal: Tribu usa 00001, no 10000
    const pv = await prisma.fePuntoVenta.findFirst({
      where: { sucursal: { empresa: { companyCode: COMPANY } }, deletedAt: null },
      include: { sucursal: true },
    });
    if (!pv) throw new Error("Punto de venta no encontrado");
    if (pv.codigo !== "1") {
      await prisma.fePuntoVenta.update({ where: { id: pv.id }, data: { codigo: "1" } });
      console.log("Punto venta actualizado: 10000 -> 1");
    }

    await prisma.feEmpresa.updateMany({
      where: { companyCode: COMPANY },
      data: { claveSituacion: "1" },
    });

    const cliente = await prisma.feCliente.findFirst({
      where: { empresa: { companyCode: COMPANY }, deletedAt: null },
    });
    if (!cliente) throw new Error("Cliente FE no encontrado");

    const { emision, facturas } = await loadServices(prisma);

    const factura = await facturas.create(
      (await prisma.feEmpresa.findFirstOrThrow({ where: { companyCode: COMPANY } })).id,
      {
        tipoDocumento: "FACTURA_ELECTRONICA",
        puntoVentaId: pv.id,
        clienteId: cliente.id,
        fecha: new Date(),
        moneda: "CRC",
        tipoCambio: 1,
        condicionVenta: "CONTADO",
        medioPago: "TRANSFERENCIA_DEPOSITO",
        subtotal: SUBTOTAL,
        totalDescuentos: 0,
        totalImpuestos: IVA,
        totalOtrosCargos: 0,
        totalIvaDevuelto: 0,
        total: TOTAL,
        observaciones: "Prueba emision FE staging",
        detalles: [
          {
            codigoCabys: "8311100000000",
            descripcion: "Servicios Profesionales",
            cantidad: 1,
            unidadMedida: "Unid",
            precioUnitario: SUBTOTAL,
            montoDescuento: 0,
            codigoImpuesto: "01",
            tarifaImpuesto: 13,
            montoImpuesto: IVA,
            totalLinea: TOTAL,
          },
        ],
      },
      "fe-emit-script"
    );

    console.log("Factura creada:", factura.id, "estado:", factura.estado);

    const result = await emision.procesarEnvioFactura(factura.id, COMPANY, "fe-emit-script");
    console.log("Envio resultado:", JSON.stringify(result, null, 2));

    const updated = await prisma.feFactura.findFirst({
      where: { id: factura.id },
      include: { comprobante: true },
    });
    console.log("Estado final:", updated?.estado);
    console.log("Consecutivo:", updated?.comprobante?.consecutivo);
    console.log("Clave:", updated?.comprobante?.claveNumerica);
    console.log("Hacienda:", updated?.comprobante?.estadoHaciendaActual);
    if (updated?.comprobante?.mensajeHacienda) {
      const buf = Buffer.from(updated.comprobante.mensajeHacienda, "base64");
      const txt = buf.toString("utf8");
      const det = txt.match(/<DetalleMensaje>([\s\S]*?)<\/DetalleMensaje>/);
      console.log("Detalle Hacienda:", (det?.[1] ?? txt).slice(0, 800));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("FALLo:", e.message || e);
  process.exit(1);
});
