/**
 * Valida cálculo de línea 1.1 del Excel PANI contra el motor de la app.
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/audit-pani-excel-linea.ts
 */
import { PrismaClient } from "@prisma/client";
import { calcularLinea } from "../src/modules/ventas/business/presupuesto-calculator";
import { loadPresupuestoCatalog } from "../src/modules/ventas/services/presupuesto-catalog";
import { PANI_EXCEL_2026 } from "../src/modules/ventas/business/pani-excel-reference";

const prisma = new PrismaClient();

const EXCEL_LINEA_11 = {
  mo: 2972950.0578496186,
  ga: 200352.95369565213,
  inDirecto: 58275.29069166667,
  mensual: 3475407.1070576156,
  conIva: 3927210.0309751057,
};

async function main() {
  const catalog = await loadPresupuestoCatalog();
  const config = {
    anioBase: 2026,
    polizaInsPct: PANI_EXCEL_2026.polizaInsPct,
    ivaPct: PANI_EXCEL_2026.ivaPct,
    margenUtilidadPct: PANI_EXCEL_2026.margenUtilidadPct,
    imprevistosPct: PANI_EXCEL_2026.imprevistosPct,
  };

  const result = calcularLinea(
    {
      numeroLinea: "1.1",
      descripcion: "Oficinas Centrales",
      jornadaCodigo: "MO1",
      equipamiento: "AF",
      cantidadPuestos: 1,
      factorOficiales: 3.89,
    },
    catalog,
    config
  );

  console.log("=== Auditoría línea 1.1 PANI ===");
  console.log("Excel vs App");
  const rows = [
    ["MO (H)", EXCEL_LINEA_11.mo, result.costoMo],
    ["GA (J)", EXCEL_LINEA_11.ga, result.costoGa],
    ["IN-D (L)", EXCEL_LINEA_11.inDirecto, result.costoInDirecto],
    ["Mensual (T)", EXCEL_LINEA_11.mensual, result.precioMensual],
    ["Con IVA (V)", EXCEL_LINEA_11.conIva, result.precioConIva],
  ];
  for (const [label, esperado, obtenido] of rows) {
    const diff = Math.abs(Number(esperado) - Number(obtenido));
    const ok = diff < 1 ? "OK" : "DIFF";
    console.log(`${ok} ${label}: excel=${esperado} app=${obtenido} Δ=${diff.toFixed(2)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
