ALTER TABLE "patrol_routes"
  ADD COLUMN IF NOT EXISTS "randomizePointOrder" BOOLEAN NOT NULL DEFAULT false;
