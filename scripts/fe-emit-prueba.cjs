/**
 * Emisión de prueba FE en producción (KBA / staging Tribu).
 * Uso: docker cp scripts/fe-emit-prueba.cjs security_contracts_app:/app/scripts/
 *      docker exec -w /app security_contracts_app node scripts/fe-emit-prueba.cjs
 */
const { PrismaClient } = require("@prisma/client");

const COMPANY = "KBA";
const SUBTOTAL = 1_500_000;
const IVA = 195_000;
const TOTAL = SUBTOTAL + IVA;

async function main() {
  const prisma = new PrismaClient();
  try {
    const pv = await prisma.fePuntoVenta.findFirst({
      where: { sucursal: { empresa: { companyCode: COMPANY } }, deletedAt: null },
      include: { sucursal: true },
    });
    if (!pv) throw new Error("Punto de venta no encontrado");
    if (pv.codigo !== "1") {
      await prisma.fePuntoVenta.update({ where: { id: pv.id }, data: { codigo: "1" } });
      console.log("Punto venta actualizado:", pv.codigo, "-> 1");
    } else {
      console.log("Punto venta OK:", pv.codigo);
    }

    const empresa = await prisma.feEmpresa.findFirstOrThrow({ where: { companyCode: COMPANY } });
    // TicoFactura staging usa situacion=1 en la clave
    if (empresa.claveSituacion !== "1") {
      await prisma.feEmpresa.update({ where: { id: empresa.id }, data: { claveSituacion: "1" } });
      console.log("claveSituacion actualizada -> 1");
    } else {
      console.log("claveSituacion OK: 1");
    }

    const cliente = await prisma.feCliente.findFirst({
      where: { empresa: { companyCode: COMPANY }, deletedAt: null },
    });
    if (!cliente) throw new Error("Cliente FE no encontrado");

    const factura = await prisma.feFactura.create({
      data: {
        empresaId: empresa.id,
        puntoVentaId: pv.id,
        clienteId: cliente.id,
        tipoDocumento: "FACTURA_ELECTRONICA",
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
        createdById: "fe-emit-script",
        updatedById: "fe-emit-script",
        detalles: {
          create: [
            {
              numeroLinea: 1,
              codigoCabys: "8311100000000",
              descripcion: "Servicios Profesionales",
              cantidad: 1,
              unidadMedida: "Unid",
              precioUnitario: SUBTOTAL,
              montoDescuento: 0,
              codigoImpuesto: "08",
              tarifaImpuesto: 13,
              montoImpuesto: IVA,
              totalLinea: TOTAL,
            },
          ],
        },
      },
    });

    console.log("Factura creada:", factura.id, "estado:", factura.estado);

    const job = await prisma.feJobQueue.create({
      data: {
        jobType: "REINTENTO_ENVIO",
        payload: JSON.stringify({ facturaId: factura.id, companyCode: COMPANY }),
        runAt: new Date(),
        empresaId: empresa.id,
        maxAttempts: 5,
      },
    });
    console.log("Job encolado:", job.id);

    const secret = process.env.SYNTRA_CRON_SECRET;
    if (!secret) throw new Error("SYNTRA_CRON_SECRET no definido en el contenedor");

    const cronRes = await fetch("http://127.0.0.1:3000/api/fe/cron/jobs", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120_000),
    });
    const cronOut = await cronRes.text();
    console.log("Cron jobs HTTP", cronRes.status, cronOut);

    await new Promise((r) => setTimeout(r, 3000));

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
  console.error("FALLO:", e.message || e);
  process.exit(1);
});
