import { prisma } from "@/modules/core/db/prisma";

export async function ensureHrDocumentSettingsRow() {
  return prisma.hrDocumentRequestSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

export async function getHrDocumentSettings() {
  return ensureHrDocumentSettingsRow();
}
