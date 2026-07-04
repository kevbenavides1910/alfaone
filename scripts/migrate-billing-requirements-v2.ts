/**
 * Normaliza requisitos de facturación en todos los contratos:
 * - CCSS, INS, RT, FID, Civil, FODESAF → sin adjunto
 * - Agrega "Certificaciones" (con adjunto)
 * - Elimina "Pólizas" genérico
 *
 * Uso: npm run db:migrate-billing-requirements-v2
 */
import { PrismaClient } from "@prisma/client";
import {
  normalizeRequirementKey,
} from "../src/modules/presupuestos/business/contractBillingRequirementsDefaults";

const prisma = new PrismaClient();

const NO_EVIDENCE_KEYS = new Set([
  normalizeRequirementKey("CCSS certificación"),
  normalizeRequirementKey("INS"),
  normalizeRequirementKey("RT"),
  normalizeRequirementKey("FID"),
  normalizeRequirementKey("Civil"),
  normalizeRequirementKey("Poliza Civil"),
  normalizeRequirementKey("FODESAF"),
]);

const REMOVE_KEYS = new Set([normalizeRequirementKey("Pólizas")]);

const CERTIFICACIONES_LABEL = "Certificaciones";
const CERTIFICACIONES_KEY = normalizeRequirementKey(CERTIFICACIONES_LABEL);
const CERTIFICACIONES_ALIASES = new Set([
  CERTIFICACIONES_KEY,
  normalizeRequirementKey("CERTIFICACIONES Y EVIDENCIAS"),
]);

async function syncOpenFacturaRequisitos(contractId: string): Promise<void> {
  const reqs = await prisma.contractBillingRequirement.findMany({
    where: { contractId },
    orderBy: { sortOrder: "asc" },
  });
  if (reqs.length === 0) return;

  const openFacturas = await prisma.facturaMensual.findMany({
    where: {
      contractId,
      status: { notIn: ["FACTURADO", "COBRADO"] },
    },
    include: { emisiones: { select: { id: true }, orderBy: { sortOrder: "asc" } } },
  });

  for (const factura of openFacturas) {
    const emisionIds =
      factura.emisiones.length > 0 ? factura.emisiones.map((e) => e.id) : [null as string | null];

    for (const emisionId of emisionIds) {
      const existing = await prisma.facturaRequisito.findMany({
        where: {
          facturaMensualId: factura.id,
          facturaMensualEmisionId: emisionId,
        },
        select: { requirementName: true },
      });
      const existingNames = new Set(existing.map((r) => r.requirementName));
      const toCreate = reqs.filter((req) => !existingNames.has(req.description));
      if (toCreate.length === 0) continue;

      await prisma.facturaRequisito.createMany({
        data: toCreate.map((req) => ({
          facturaMensualId: factura.id,
          facturaMensualEmisionId: emisionId,
          requirementName: req.description,
          sortOrder: req.sortOrder,
          status: "PENDIENTE" as const,
          requiresEvidenceCopied: req.requiresEvidence,
        })),
      });
    }
  }
}

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, licitacionNo: true },
    orderBy: { licitacionNo: "asc" },
  });

  let removedPolizas = 0;
  let updatedEvidence = 0;
  let renamedCertificaciones = 0;
  let addedCertificaciones = 0;
  let syncedContracts = 0;

  for (const contract of contracts) {
    const reqs = await prisma.contractBillingRequirement.findMany({
      where: { contractId: contract.id },
      orderBy: { sortOrder: "asc" },
    });

    let changed = false;
    const toDelete = reqs.filter((r) => REMOVE_KEYS.has(normalizeRequirementKey(r.description)));
    if (toDelete.length > 0) {
      await prisma.contractBillingRequirement.deleteMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
      });
      removedPolizas += toDelete.length;

      await prisma.facturaRequisito.deleteMany({
        where: {
          requirementName: { in: toDelete.map((r) => r.description) },
          facturaMensual: {
            contractId: contract.id,
            status: { notIn: ["FACTURADO", "COBRADO"] },
          },
        },
      });
      changed = true;
    }

    const remaining = reqs.filter((r) => !toDelete.some((d) => d.id === r.id));

    for (const req of remaining) {
      const key = normalizeRequirementKey(req.description);
      let nextDescription = req.description;
      let nextEvidence = req.requiresEvidence;

      if (CERTIFICACIONES_ALIASES.has(key) && req.description !== CERTIFICACIONES_LABEL) {
        nextDescription = CERTIFICACIONES_LABEL;
        nextEvidence = true;
        renamedCertificaciones++;
      } else if (key === CERTIFICACIONES_KEY) {
        nextEvidence = true;
      } else if (NO_EVIDENCE_KEYS.has(key)) {
        nextEvidence = false;
      }

      if (nextDescription !== req.description || nextEvidence !== req.requiresEvidence) {
        await prisma.contractBillingRequirement.update({
          where: { id: req.id },
          data: {
            description: nextDescription,
            requiresEvidence: nextEvidence,
          },
        });

        if (nextDescription !== req.description) {
          await prisma.facturaRequisito.updateMany({
            where: {
              requirementName: req.description,
              facturaMensual: {
                contractId: contract.id,
                status: { notIn: ["FACTURADO", "COBRADO"] },
              },
            },
            data: { requirementName: nextDescription },
          });
        }

        if (nextEvidence !== req.requiresEvidence) {
          await prisma.facturaRequisito.updateMany({
            where: {
              requirementName: nextDescription,
              facturaMensual: {
                contractId: contract.id,
                status: { notIn: ["FACTURADO", "COBRADO"] },
              },
            },
            data: { requiresEvidenceCopied: nextEvidence },
          });
        }

        updatedEvidence++;
        changed = true;
      }
    }

    if (changed) {
      const finalReqs = await prisma.contractBillingRequirement.findMany({
        where: { contractId: contract.id },
        select: { description: true, sortOrder: true },
      });
      const hasCertificaciones = finalReqs.some(
        (r) => normalizeRequirementKey(r.description) === CERTIFICACIONES_KEY
      );
      if (!hasCertificaciones) {
        const maxSort = finalReqs.reduce((max, r) => Math.max(max, r.sortOrder), -1);
        await prisma.contractBillingRequirement.create({
          data: {
            contractId: contract.id,
            description: CERTIFICACIONES_LABEL,
            requiresEvidence: true,
            sortOrder: maxSort + 1,
          },
        });
        addedCertificaciones++;
      }

      await syncOpenFacturaRequisitos(contract.id);
      syncedContracts++;
    }
  }

  console.log("\n=== Migración requisitos de facturación v2 ===");
  console.log(`Contratos procesados: ${contracts.length}`);
  console.log(`Contratos actualizados: ${syncedContracts}`);
  console.log(`Requisitos "Pólizas" eliminados: ${removedPolizas}`);
  console.log(`Requisitos renombrados a Certificaciones: ${renamedCertificaciones}`);
  console.log(`Requisitos "Certificaciones" agregados: ${addedCertificaciones}`);
  console.log(`Requisitos con evidencia actualizada: ${updatedEvidence}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
