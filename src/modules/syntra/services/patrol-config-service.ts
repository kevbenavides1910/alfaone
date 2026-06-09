import { prisma } from "@/modules/core/db/prisma";

export async function getSyntraRemoteConfig() {
  const row = await prisma.appSyntraSettings.findUnique({ where: { id: "default" } });
  return {
    enable_geofences: row?.enableGeofences ?? false,
    enable_gps_track: true,
    gps_track_interval: 60,
    geofence_radius_m: row?.geofenceRadiusM ?? 100,
    routes_sync_minutes: row?.routesSyncMinutes ?? 360,
    reports_sync_minutes: row?.reportsSyncMinutes ?? 30,
    use_syntra_api: true,
    api_domain: "https://one.grupocorporativoalfa.com",
    api_prefix: "/api/syntra",
  };
}
