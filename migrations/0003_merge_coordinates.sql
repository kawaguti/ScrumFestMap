
ALTER TABLE "events" ADD COLUMN "coordinates" text;
UPDATE "events" SET "coordinates" = CONCAT(latitude, ', ', longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
ALTER TABLE "events" DROP COLUMN "latitude";
ALTER TABLE "events" DROP COLUMN "longitude";
