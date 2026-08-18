import { prisma } from "@/modules/core/db/prisma";
import type { FingerDeviceStatus, Prisma } from "@prisma/client";
import { createZKTecoAdapter } from "@/modules/finger-system/integrations/biometric/zkteco-adapter";

export type FingerDeviceFilters = {
  q?: string;
  company?: string;
  status?: FingerDeviceStatus;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
};

export type FingerDeviceRow = {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  status: FingerDeviceStatus;
  lastOnlineAt: string | null;
  lastSyncAt: string | null;
  employeeCount: number;
  fingerprintCount: number;
  punchCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  status: FingerDeviceStatus;
  lastOnlineAt: Date | null;
  lastSyncAt: Date | null;
  employeeCount: number;
  fingerprintCount: number;
  punchCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FingerDeviceRow {
  return {
    ...row,
    lastOnlineAt: row.lastOnlineAt?.toISOString() ?? null,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFingerDevices(filters: FingerDeviceFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FingerDeviceWhereInput = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
      { serialNumber: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.company?.trim()) {
    where.company = filters.company.trim().toUpperCase();
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const [total, rows] = await Promise.all([
    prisma.fingerDevice.count({ where }),
    prisma.fingerDevice.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(mapRow),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getFingerDevice(id: string): Promise<FingerDeviceRow | null> {
  const row = await prisma.fingerDevice.findUnique({ where: { id } });
  return row ? mapRow(row) : null;
}

export async function createFingerDevice(input: {
  name: string;
  ipAddress: string;
  port?: number;
  brand?: string;
  model?: string;
  serialNumber?: string;
  company?: string;
  location?: string;
  description?: string;
}) {
  const row = await prisma.fingerDevice.create({
    data: {
      name: input.name.trim(),
      ipAddress: input.ipAddress.trim(),
      port: input.port ?? 4370,
      brand: input.brand?.trim() || "ZKTeco",
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      company: input.company?.trim().toUpperCase() || null,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
    },
  });
  return mapRow(row);
}

export async function updateFingerDevice(
  id: string,
  input: Partial<{
    name: string;
    ipAddress: string;
    port: number;
    brand: string;
    model: string;
    serialNumber: string;
    company: string;
    location: string;
    description: string;
    isActive: boolean;
  }>,
) {
  const row = await prisma.fingerDevice.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress.trim() } : {}),
      ...(input.port !== undefined ? { port: input.port } : {}),
      ...(input.brand !== undefined ? { brand: input.brand.trim() || "ZKTeco" } : {}),
      ...(input.model !== undefined ? { model: input.model.trim() || null } : {}),
      ...(input.serialNumber !== undefined ? { serialNumber: input.serialNumber.trim() || null } : {}),
      ...(input.company !== undefined ? { company: input.company.trim().toUpperCase() || null } : {}),
      ...(input.location !== undefined ? { location: input.location.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return mapRow(row);
}

export async function deleteFingerDevice(id: string) {
  await prisma.fingerDevice.delete({ where: { id } });
  return { deleted: true, id };
}

export async function probeFingerDevice(id: string) {
  const device = await prisma.fingerDevice.findUnique({ where: { id } });
  if (!device) throw new Error("Dispositivo no encontrado.");

  const adapter = createZKTecoAdapter({
    ipAddress: device.ipAddress,
    port: device.port,
  });

  let status: FingerDeviceStatus = "OFFLINE";
  let message = "Sin respuesta";
  let latencyMs: number | null = null;

  try {
    await adapter.connect();
    const info = await adapter.getDeviceInfo();
    status = "ONLINE";
    message = "Dispositivo responde en TCP 4370.";
    latencyMs = typeof info.latencyMs === "number" ? info.latencyMs : null;
  } catch (e) {
    status = "OFFLINE";
    message = e instanceof Error ? e.message : "Error de conexión";
  } finally {
    await adapter.disconnect().catch(() => undefined);
  }

  const now = new Date();
  const updated = await prisma.fingerDevice.update({
    where: { id },
    data: {
      status,
      lastOnlineAt: status === "ONLINE" ? now : device.lastOnlineAt,
      lastSyncAt: now,
    },
  });

  return {
    device: mapRow(updated),
    probe: { status, message, latencyMs },
  };
}

export async function probeAllFingerDevices() {
  const devices = await prisma.fingerDevice.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { name: "asc" },
  });

  const results = [];
  for (const d of devices) {
    results.push(await probeFingerDevice(d.id));
  }

  return {
    total: results.length,
    online: results.filter((r) => r.probe.status === "ONLINE").length,
    results,
  };
}
