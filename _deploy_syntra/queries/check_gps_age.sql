SELECT NOW() AS server_now, current_setting('TIMEZONE') AS tz;
SELECT MAX("recordedAt") AS last_track, NOW() - MAX("recordedAt") AS age FROM patrol_gps_tracks;
SELECT "lastGpsAt", NOW() - "lastGpsAt" AS age FROM patrol_devices WHERE imei = '000000000000001';
