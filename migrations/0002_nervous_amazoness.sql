CREATE TABLE IF NOT EXISTS "event_history" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_history_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"modified_at" timestamp DEFAULT now() NOT NULL,
	"modified_column" text NOT NULL,
	"old_value" text,
	"new_value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "latitude" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "longitude" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_history" ADD CONSTRAINT "event_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_history" ADD CONSTRAINT "event_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
