SELECT COUNT(*) AS tracks FROM patrol_gps_tracks;
SELECT imei, "lastGpsAt", "lastGpsLatitude", "lastGpsLongitude" FROM patrol_devices ORDER BY "lastGpsAt" DESC NULLS LAST LIMIT 5;
SELECT imei, latitude, longitude, "recordedAt" FROM patrol_gps_tracks ORDER BY "recordedAt" DESC LIMIT 5;
