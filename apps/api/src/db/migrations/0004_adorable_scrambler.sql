CREATE TABLE IF NOT EXISTS "scheduled_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"external_action_id" text NOT NULL,
	"kind" text NOT NULL,
	"trigger_at" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"fired_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "approved_payload" jsonb;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_triggers" ADD CONSTRAINT "scheduled_triggers_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_triggers" ADD CONSTRAINT "scheduled_triggers_external_action_id_external_actions_id_fk" FOREIGN KEY ("external_action_id") REFERENCES "public"."external_actions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_triggers_action_unique" ON "scheduled_triggers" USING btree ("external_action_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_triggers_due_idx" ON "scheduled_triggers" USING btree ("status","trigger_at");