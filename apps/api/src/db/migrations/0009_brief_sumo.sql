ALTER TABLE "external_actions" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "lease_id" text;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "last_error_code" text;--> statement-breakpoint
ALTER TABLE "external_actions" ADD COLUMN "last_error_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "external_actions_worker_due_idx" ON "external_actions" USING btree ("status","next_attempt_at","lease_expires_at");