ALTER TABLE "events"
ADD COLUMN IF NOT EXISTS "latitude" double precision,
ADD COLUMN IF NOT EXISTS "longitude" double precision;

-- インデックスの追加（位置情報での検索を最適化）
CREATE INDEX IF NOT EXISTS "events_coordinates_idx" ON "events" ("latitude", "longitude");
