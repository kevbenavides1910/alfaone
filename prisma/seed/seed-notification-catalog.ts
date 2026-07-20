/**
 * Siembra catálogo de tipos y reglas por rol.
 * npx tsx prisma/seed/seed-notification-catalog.ts
 */
import { seedNotificationCatalog } from "../../src/modules/notifications/services/notification-preferences";

seedNotificationCatalog()
  .then(() => {
    console.log("OK: catálogo de notificaciones");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
