import bcrypt from "bcryptjs";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  findPhoneAssetAtPosition,
  findPhoneAssetByImei,
  type InventoryPhone,
} from "@/modules/syntra/services/patrol-inventory-phone-service";

function assetImei(attributes: unknown): string {
  if (!attributes || typeof attributes !== "object") return "";
  const imei = (attributes as Record<string, unknown>).imei;
  return imei == null ? "" : String(imei).trim();
}

export async function ensurePatrolDeviceForPhoneAsset(phone: NonNullable<InventoryPhone>) {
  if (!phone.currentPositionId || !phone.currentPosition) {
    throw new Error("PHONE_WITHOUT_POSITION");
  }

  const imei = assetImei(phone.attributes);
  if (!imei) {
    throw new Error("PHONE_WITHOUT_IMEI");
  }

  const passwordHash = await bcrypt.hash(normalizeEmployeeCode("0"), 10);

  return prisma.patrolDevice.upsert({
    where: { imei },
    create: {
      imei,
      employeeCode: "0",
      passwordHash,
      label: phone.name?.trim() || phone.code,
      locationDesc: phone.currentPosition.name,
      positionId: phone.currentPositionId,
      assetId: phone.id,
      isActive: true,
    },
    update: {
      label: phone.name?.trim() || phone.code,
      locationDesc: phone.currentPosition.name,
      positionId: phone.currentPositionId,
      assetId: phone.id,
      isActive: true,
    },
  });
}

export async function ensurePatrolDeviceForPosition(positionId: string) {
  const phone = await findPhoneAssetAtPosition(positionId);
  if (!phone) return null;
  return ensurePatrolDeviceForPhoneAsset(phone);
}

export async function ensurePatrolDeviceForImei(imei: string) {
  const phone = await findPhoneAssetByImei(imei);
  if (!phone) return null;
  return ensurePatrolDeviceForPhoneAsset(phone);
}
