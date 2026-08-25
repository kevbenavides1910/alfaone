import { prisma } from "@/modules/core/db/prisma";
import {
  mdbFindUserByBadge,
  mdbMaxUserId,
} from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";

export async function assertAttWriteAllowed(): Promise<void> {
  const settings = await prisma.appFingerSettings.findUnique({ where: { id: "default" } });
  if (settings?.attReadOnly !== false) {
    throw new Error(
      "La base biométrica está en modo solo lectura. Active escritura en configuración Finger System antes de continuar.",
    );
  }
}

/** Reserva el siguiente USERID libre según MAX(USERID)+1 en ATT2016. */
export async function allocateNextAttUserId(): Promise<number> {
  return withAtt2016MdbRead(async (mdb) => {
    const maxId = await mdbMaxUserId(mdb);
    return maxId + 1;
  });
}

export async function validateBadgeInAtt2016(
  badgeNumber: string,
  excludeAttUserId?: number,
): Promise<{ ok: true } | { ok: false; message: string; attUserId?: number }> {
  const existing = await withAtt2016MdbRead(async (mdb) => mdbFindUserByBadge(mdb, badgeNumber));
  if (existing && existing.attUserId !== excludeAttUserId) {
    return {
      ok: false,
      message: `El badge ${badgeNumber} ya existe en ATT2016 (USERID ${existing.attUserId}).`,
      attUserId: existing.attUserId,
    };
  }
  return { ok: true };
}

export async function validateBadgeInPostgres(
  badgeNumber: string,
  excludeLinkId?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const existing = await prisma.fingerEmployeeLink.findFirst({
    where: {
      badgeNumber,
      ...(excludeLinkId ? { NOT: { id: excludeLinkId } } : {}),
    },
    select: { id: true, employee: { select: { nombre: true, codigoEmpleado: true } } },
  });
  if (existing) {
    return {
      ok: false,
      message: `El badge ${badgeNumber} ya está vinculado a ${existing.employee.nombre} (${existing.employee.codigoEmpleado}).`,
    };
  }
  return { ok: true };
}
