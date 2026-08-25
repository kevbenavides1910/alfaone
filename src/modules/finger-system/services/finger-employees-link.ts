import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import {
  insertAtt2016UserInfo,
  updateAtt2016UserInfo,
} from "@/modules/finger-system/services/att2016-employees-write";
import {
  validateBadgeInAtt2016,
  validateBadgeInPostgres,
} from "@/modules/finger-system/services/att2016-userid";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";
import { getFingerEmployeeLink } from "@/modules/finger-system/services/finger-employees-list";

function clientIp(reqHeaders: Headers | undefined): string | null {
  if (!reqHeaders) return null;
  return (
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    reqHeaders.get("x-real-ip") ||
    null
  );
}

async function resolveEmployee(employeeId?: string, employeeCodigo?: string) {
  if (employeeId) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, codigoEmpleado: true, nombre: true, company: true, fingerEmployeeLink: { select: { id: true } } },
    });
  }
  if (employeeCodigo?.trim()) {
    const code = normalizeEmployeeCode(employeeCodigo) || employeeCodigo.trim();
    return prisma.employee.findFirst({
      where: {
        OR: [
          { codigoEmpleado: code },
          { codigoEmpleado: employeeCodigo.trim() },
        ],
      },
      select: { id: true, codigoEmpleado: true, nombre: true, company: true, fingerEmployeeLink: { select: { id: true } } },
    });
  }
  return null;
}

export async function createFingerEmployeeLink(params: {
  employeeId?: string;
  employeeCodigo?: string;
  badgeNumber?: string;
  pushToAtt?: boolean;
  userId: string;
  headers?: Headers;
}) {
  const employee = await resolveEmployee(params.employeeId, params.employeeCodigo);
  if (!employee) {
    throw new Error("Empleado no encontrado en el directorio RRHH.");
  }
  if (employee.fingerEmployeeLink) {
    throw new Error("Este empleado ya tiene un vínculo biométrico.");
  }

  const badgeNumber =
    normalizeEmployeeCode(params.badgeNumber ?? employee.codigoEmpleado) ||
    employee.codigoEmpleado.trim();

  const pgBadge = await validateBadgeInPostgres(badgeNumber);
  if (!pgBadge.ok) throw new Error(pgBadge.message);

  let attUserId: number | null = null;

  if (params.pushToAtt) {
    const attBadge = await validateBadgeInAtt2016(badgeNumber);
    if (attBadge.ok) {
      const att = await insertAtt2016UserInfo({
        badgeNumber,
        name: employee.nombre,
        userId: params.userId,
        ipAddress: clientIp(params.headers),
      });
      attUserId = att.attUserId;
    } else if (attBadge.attUserId) {
      attUserId = attBadge.attUserId;
    } else {
      throw new Error(attBadge.message);
    }
  }

  const link = await prisma.fingerEmployeeLink.create({
    data: {
      employeeId: employee.id,
      attUserId,
      badgeNumber,
      company: employee.company ?? null,
      lastSyncAt: attUserId ? new Date() : null,
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.employee_link.create",
    entityType: "FingerEmployeeLink",
    entityId: link.id,
    ipAddress: clientIp(params.headers),
    metadata: { attUserId, badgeNumber, pushToAtt: params.pushToAtt ?? false },
  });

  return getFingerEmployeeLink(link.id);
}

export async function updateFingerEmployeeLink(
  id: string,
  params: {
    badgeNumber?: string;
    pushToAtt?: boolean;
    userId: string;
    headers?: Headers;
  },
) {
  const existing = await prisma.fingerEmployeeLink.findUnique({
    where: { id },
    include: { employee: { select: { nombre: true, codigoEmpleado: true } } },
  });
  if (!existing) throw new Error("Vínculo biométrico no encontrado.");

  const badgeNumber = params.badgeNumber
    ? normalizeEmployeeCode(params.badgeNumber) || params.badgeNumber.trim()
    : existing.badgeNumber;

  if (!badgeNumber) throw new Error("El badge es obligatorio.");

  if (badgeNumber !== existing.badgeNumber) {
    const pgBadge = await validateBadgeInPostgres(badgeNumber, id);
    if (!pgBadge.ok) throw new Error(pgBadge.message);
  }

  let attUserId = existing.attUserId;

  if (params.pushToAtt) {
    if (attUserId) {
      await updateAtt2016UserInfo({
        attUserId,
        badgeNumber,
        name: existing.employee.nombre,
        userId: params.userId,
        ipAddress: clientIp(params.headers),
      });
    } else {
      const attBadge = await validateBadgeInAtt2016(badgeNumber);
      if (attBadge.ok) {
        const att = await insertAtt2016UserInfo({
          badgeNumber,
          name: existing.employee.nombre,
          userId: params.userId,
          ipAddress: clientIp(params.headers),
        });
        attUserId = att.attUserId;
      } else if (attBadge.attUserId) {
        attUserId = attBadge.attUserId;
      } else {
        throw new Error(attBadge.message);
      }
    }
  }

  await prisma.fingerEmployeeLink.update({
    where: { id },
    data: {
      badgeNumber,
      attUserId,
      lastSyncAt: params.pushToAtt ? new Date() : existing.lastSyncAt,
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.employee_link.update",
    entityType: "FingerEmployeeLink",
    entityId: id,
    ipAddress: clientIp(params.headers),
    metadata: { badgeNumber, attUserId, pushToAtt: params.pushToAtt ?? false },
  });

  return getFingerEmployeeLink(id);
}

export async function pushFingerEmployeeLinkToAtt(
  id: string,
  params: { userId: string; headers?: Headers },
) {
  return updateFingerEmployeeLink(id, {
    pushToAtt: true,
    userId: params.userId,
    headers: params.headers,
  });
}

export async function deleteFingerEmployeeLink(
  id: string,
  params: { userId: string; headers?: Headers },
) {
  const existing = await prisma.fingerEmployeeLink.findUnique({ where: { id } });
  if (!existing) throw new Error("Vínculo biométrico no encontrado.");

  await prisma.fingerEmployeeLink.delete({ where: { id } });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.employee_link.delete",
    entityType: "FingerEmployeeLink",
    entityId: id,
    ipAddress: clientIp(params.headers),
    metadata: { attUserId: existing.attUserId, badgeNumber: existing.badgeNumber },
  });

  return { deleted: true, id };
}

export async function previewNextAttUserId() {
  const { allocateNextAttUserId } = await import("@/modules/finger-system/services/att2016-userid");
  const nextUserId = await allocateNextAttUserId();
  return { nextUserId };
}
