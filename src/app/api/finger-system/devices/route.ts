import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError, created } from "@/lib/api/response";
import {
  createFingerDevice,
  listFingerDevices,
} from "@/modules/finger-system/services/finger-devices";
import { listFingerDevicesPreferOdoo } from "@/modules/finger-system/services/odoo-biometric-devices";
import type { FingerDeviceStatus } from "@prisma/client";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
      const status = sp.get("status") as FingerDeviceStatus | null;

      // Listado preferente desde Odoo (espejo local por IP para acciones ZK).
      if (!status) {
        const result = await listFingerDevicesPreferOdoo({
          q: sp.get("q") ?? undefined,
          isActive: sp.get("isActive") === "false" ? false : sp.get("isActive") === "true" ? true : undefined,
          page: Number.isNaN(page) ? 1 : page,
          pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
        });
        return ok(result);
      }

      const result = await listFingerDevices({
        q: sp.get("q") ?? undefined,
        company: sp.get("company") ?? undefined,
        status: status ?? undefined,
        isActive: sp.get("isActive") === "false" ? false : sp.get("isActive") === "true" ? true : undefined,
        page: Number.isNaN(page) ? 1 : page,
        pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
      });

      return ok({ ...result, source: "finger" });
    } catch (e) {
      return serverError("Error al listar dispositivos biométricos.", e);
    }
  },
  "fingerSystem.dispositivos",
  "view",
);

export const POST = withPermission(
  async (req: NextRequest) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (!body.name?.trim() || !body.ipAddress?.trim()) {
        return badRequest("Nombre e IP son obligatorios.");
      }

      const row = await createFingerDevice({
        name: body.name,
        ipAddress: body.ipAddress,
        port: body.port,
        brand: body.brand,
        model: body.model,
        serialNumber: body.serialNumber,
        company: body.company,
        location: body.location,
        description: body.description,
      });

      return created(row);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible registrar el dispositivo.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);
