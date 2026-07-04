/**
 * Importa contactos de facturación (cobro) desde Excel a contratos existentes (idempotente por contrato+correo).
 * Uso: npm run db:import-client-contacts -- cargas/contactos_carga_masiva.xlsx
 */
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { readFirstSheetAsObjects } from "../src/modules/core/import/xlsx-read";
import {
  billingContactRowsFromSheet,
  buildContractLookup,
  isHeaderOrEmptyContactRow,
  resolveContractForLicitacion,
} from "../src/modules/presupuestos/import/client-contact-rows";

const prisma = new PrismaClient();

async function main() {
  const fileArg = process.argv[2] ?? "cargas/contactos_carga_masiva.xlsx";
  const filePath = path.resolve(process.cwd(), fileArg);
  const buf = readFileSync(filePath);
  const rows = readFirstSheetAsObjects(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
    preferredName: "Contratos",
  });

  const admin = await prisma.user.findFirst({
    where: { email: "admin@seguridadgrupocr.com" },
    select: { id: true },
  });
  if (!admin) {
    console.error("No existe usuario admin@seguridadgrupocr.com — ejecute npm run db:seed primero.");
    process.exit(1);
  }

  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, licitacionNo: true },
  });
  const contractLookup = buildContractLookup(contracts);

  const existingContacts = await prisma.contractClientContact.findMany({
    select: { contractId: true, email: true },
  });
  const existingByContractEmail = new Set(
    existingContacts.map((c) => `${c.contractId}::${c.email.trim().toLowerCase()}`)
  );

  const errors: { sheetRow: number; message: string }[] = [];
  const warnings: { sheetRow: number; message: string }[] = [];
  let created = 0;
  let skipped = 0;
  let rowsProcessed = 0;

  let sheetRow = 2;
  for (const row of rows) {
    if (isHeaderOrEmptyContactRow(row)) {
      sheetRow++;
      continue;
    }

    rowsProcessed++;
    const parsed = billingContactRowsFromSheet(row, sheetRow);
    if (!parsed.ok) {
      errors.push({ sheetRow: parsed.sheetRow, message: parsed.message });
      sheetRow++;
      continue;
    }

    for (const w of parsed.warnings) {
      warnings.push({ sheetRow, message: w });
    }

    const contract = resolveContractForLicitacion(parsed.contacts[0].licitacionNo, contractLookup);
    if (!contract) {
      errors.push({
        sheetRow,
        message: `No hay contrato con licitación «${parsed.contacts[0].licitacionNo}»`,
      });
      sheetRow++;
      continue;
    }

    const maxSort = await prisma.contractClientContact.aggregate({
      where: { contractId: contract.id },
      _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? -1) + 1;

    for (const contact of parsed.contacts) {
      const dedupeKey = `${contract.id}::${contact.email.trim().toLowerCase()}`;
      if (existingByContractEmail.has(dedupeKey)) {
        skipped++;
        continue;
      }

      await prisma.contractClientContact.create({
        data: {
          contractId: contract.id,
          name: contact.name,
          jobTitle: null,
          isBillingContact: true,
          isContractAdmin: false,
          phone: contact.phone,
          phone2: contact.phone2,
          email: contact.email,
          sortOrder: nextSort++,
          createdById: admin.id,
        },
      });
      existingByContractEmail.add(dedupeKey);
      created++;
    }

    sheetRow++;
  }

  console.log("\n=== Importación de contactos de facturación ===");
  console.log(`Archivo: ${filePath}`);
  console.log(`Filas procesadas: ${rowsProcessed}`);
  console.log(`Contactos creados: ${created}`);
  console.log(`Omitidos (ya existían): ${skipped}`);
  console.log(`Errores: ${errors.length}`);
  console.log(`Advertencias: ${warnings.length}`);

  if (warnings.length > 0) {
    console.log("\nPrimeras advertencias:");
    for (const w of warnings.slice(0, 15)) {
      console.log(`  Fila ${w.sheetRow}: ${w.message}`);
    }
    if (warnings.length > 15) console.log(`  … y ${warnings.length - 15} más`);
  }

  if (errors.length > 0) {
    console.log("\nErrores:");
    for (const e of errors) {
      console.log(`  Fila ${e.sheetRow}: ${e.message}`);
    }
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
