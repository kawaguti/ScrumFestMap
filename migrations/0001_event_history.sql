CREATE TABLE IF NOT EXISTS "event_history" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "event_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "modified_at" timestamp DEFAULT now() NOT NULL,
  "modified_column" text NOT NULL,
  "old_value" text,
  "new_value" text NOT NULL,
  CONSTRAINT "event_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "event_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- インデックスの追加
CREATE INDEX IF NOT EXISTS "event_history_event_id_idx" ON "event_history" ("event_id");
CREATE INDEX IF NOT EXISTS "event_history_user_id_idx" ON "event_history" ("user_id");
CREATE INDEX IF NOT EXISTS "event_history_modified_at_idx" ON "event_history" ("modified_at");
