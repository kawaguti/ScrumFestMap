BEGIN;

-- Drop duplicate migration files
DROP TABLE IF EXISTS "_prisma_migrations";

-- Ensure latitude and longitude columns exist before merging
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "latitude" text;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "longitude" text;

-- Add coordinates column and merge data
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "coordinates" text;
UPDATE "events" SET "coordinates" = CONCAT(latitude, ', ', longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Drop old columns after data migration
ALTER TABLE "events" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "events" DROP COLUMN IF EXISTS "longitude";

COMMIT;