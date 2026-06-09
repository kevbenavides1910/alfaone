import { ok } from "@/lib/api/response";
import { withPermission } from "@/lib/permissions/middleware";
import { listPositionsWithInventoryPhones } from "@/modules/syntra/services/patrol-inventory-phone-service";

export const GET = withPermission(async () => {
  const rows = await listPositionsWithInventoryPhones();
  return ok(rows);
}, "recorridos.asignaciones", "view");
