/**
 * Importa catálogos y datos históricos del Sistema de Alarmas Bandeco desde .xlsm
 * Uso: npm run db:import-bandeco -- "cargas/Sistema de Alarmas Bandeco BETA 1.1.2 (1).xlsm"
 */
import path from "path";
import { PrismaClient } from "@prisma/client";
import { importBandecoFromXlsm } from "../src/modules/bandeco/services/import-xlsm";

const prisma = new PrismaClient();

async function main() {
  const fileArg =
    process.argv[2] ?? "cargas/Sistema de Alarmas Bandeco BETA 1.1.2 (1).xlsm";
  const filePath = path.resolve(process.cwd(), fileArg);

  console.log(`Importando Bandeco desde: ${filePath}`);
  const stats = await importBandecoFromXlsm(filePath, prisma);

  console.log("Importación completada:");
  console.log(`  Códigos de alarma: ${stats.alarmCodes}`);
  console.log(`  Pantallas:         ${stats.pantallas}`);
  console.log(`  Puestos:           ${stats.puestos}`);
  console.log(`  Cámaras:           ${stats.camaras}`);
  console.log(`  Cuentas apertura:  ${stats.aperturaCuentas}`);
  console.log(`  Pilas por finca:   ${stats.pilaFincas}`);
  console.log(`  Activaciones:      ${stats.activaciones}`);
  console.log(`  Aperturas/cierres: ${stats.aperturasCierres}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
