import bcrypt from "bcryptjs";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import { isEmployeeEstadoActivo } from "@/modules/empleados/business/employee-identity";
import { signDeviceToken } from "@/modules/syntra/auth/device-token";
import {
  assetImeiFromAttributes,
  findPhoneAssetByImei,
  resolveDevicePositionLabel,
} from "@/modules/syntra/services/patrol-inventory-phone-service";

export type LoginInput = {
  employeeCode: string;
  password?: string;
  imei: string;
};

async function findActiveEmployee(rawCode: string, normalizedCode: string) {
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [
        { codigoEmpleado: normalizedCode },
        { codigoEmpleadoRaw: rawCode.trim() },
      ],
    },
  });

  if (!employee || !isEmployeeEstadoActivo(employee.estado)) {
    return null;
  }

  return employee;
}

async function upsertPatrolDeviceFromInventory(input: {
  imei: string;
  employeeCode: string;
  assetId: string;
  positionId: string;
  label: string;
  positionName: string;
}) {
  const passwordHash = await bcrypt.hash(input.employeeCode, 10);

  return prisma.patrolDevice.upsert({
    where: { imei: input.imei },
    create: {
      imei: input.imei,
      employeeCode: input.employeeCode,
      passwordHash,
      label: input.label,
      locationDesc: input.positionName,
      positionId: input.positionId,
      assetId: input.assetId,
      isActive: true,
      lastLoginAt: new Date(),
    },
    update: {
      employeeCode: input.employeeCode,
      passwordHash,
      label: input.label,
      locationDesc: input.positionName,
      positionId: input.positionId,
      assetId: input.assetId,
      isActive: true,
      lastLoginAt: new Date(),
    },
  });
}

export async function loginPatrolDevice(input: LoginInput) {
  const imei = input.imei.trim();
  const employeeCode = normalizeEmployeeCode(input.employeeCode);
  const passwordCode = normalizeEmployeeCode(input.password ?? input.employeeCode);

  if (!employeeCode || passwordCode !== employeeCode) {
    return { ok: false as const, message: "Credenciales inválidas" };
  }

  const employee = await findActiveEmployee(input.employeeCode, employeeCode);
  if (!employee) {
    return {
      ok: false as const,
      message: "Empleado no encontrado o inactivo. Debe existir en el módulo Empleados (RRHH).",
    };
  }

  const phone = await findPhoneAssetByImei(imei);
  if (!phone) {
    return {
      ok: false as const,
      message: "Teléfono no registrado en inventario. Registre el celular con su IMEI en Inventario.",
    };
  }

  const canonicalImei = assetImeiFromAttributes(phone.attributes) || imei;

  const routeAuthorization = !phone.currentPositionId
    ? await prisma.patrolRoutePhone.findFirst({
        where: { assetId: phone.id, route: { isActive: true } },
        include: { route: { select: { name: true, code: true } } },
      })
    : null;

  if (!phone.currentPositionId || !phone.currentPosition) {
    if (!routeAuthorization) {
      return {
        ok: false as const,
        message:
          "El teléfono no está asignado a un puesto en inventario ni autorizado en una ruta activa.",
      };
    }
  }

  const device = await upsertPatrolDeviceFromInventory({
    imei: canonicalImei,
    employeeCode,
    assetId: phone.id,
    positionId: phone.currentPositionId ?? "",
    label: phone.name?.trim() || phone.code,
    positionName:
      phone.currentPosition?.name ??
      (routeAuthorization
        ? `Ruta ${routeAuthorization.route.code} · ${routeAuthorization.route.name}`
        : ""),
  });

  const token = signDeviceToken({
    deviceId: device.id,
    imei: device.imei,
    employeeCode,
  });

  const locationLabel = await resolveDevicePositionLabel(device);

  return {
    ok: true as const,
    token,
    device: { ...device, locationDesc: locationLabel },
  };
}
