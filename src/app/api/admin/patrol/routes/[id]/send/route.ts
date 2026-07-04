import { ok, notFound, serverError } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { prisma } from "@/modules/core/db/prisma";
import { resolveDevicePositionLabel } from "@/modules/syntra/services/patrol-inventory-phone-service";
import { getPatrolRoutesForDevice } from "@/modules/syntra/services/patrol-routes-service";
import { assetImeiFromAttributes } from "@/modules/syntra/services/patrol-inventory-phone-service";

type Params = { id: string };

export const POST = withPermission<Params>(async (_req, { params }) => {
  try {
    const route = await prisma.patrolRoute.findUnique({
      where: { id: params.id },
      include: { authorizedPhones: { where: { isPrimary: true } } },
    });
    if (!route) return notFound("Ruta no encontrada");

    if (!route.isActive) {
      return ok({ sent: false, reason: "La ruta está inactiva" });
    }

    if (route.authorizedPhones.length === 0) {
      return ok({ sent: false, reason: "No hay celulares autorizados en esta ruta" });
    }

    const primaryPhone = route.authorizedPhones[0];
    const asset = await prisma.asset.findUnique({ where: { id: primaryPhone.assetId } });
    if (!asset) {
      return ok({ sent: false, reason: "Activo no encontrado en inventario" });
    }

    const imei = assetImeiFromAttributes(asset.attributes);
    const device = await prisma.patrolDevice.findUnique({ where: { imei } });
    if (!device) {
      return ok({ sent: false, reason: `No hay dispositivo registrado para el IMEI ${imei}. El empleado debe hacer login primero.` });
    }

    const routes = await getPatrolRoutesForDevice(device.id);

    if (routes.COD_ERROR === "1" && routes.Table.length === 0) {
      return ok({ sent: false, reason: routes.DES_ERROR });
    }

    const locationDesc = await resolveDevicePositionLabel(device);

    return ok({
      sent: true,
      imei,
      deviceId: device.id,
      locationDesc,
      routeCode: route.code,
      pointsCount: routes.Table.length,
      message: `Ruta ${route.code} enviada correctamente al IMEI ${imei}`,
    });
  } catch (e) {
    return serverError("Error al enviar ruta", e);
  }
}, "recorridos.rutas", "edit");