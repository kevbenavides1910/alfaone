CREATE INDEX IF NOT EXISTS "patrol_gps_tracks_deviceId_recordedAt_idx"
  ON "patrol_gps_tracks"("deviceId", "recordedAt");
