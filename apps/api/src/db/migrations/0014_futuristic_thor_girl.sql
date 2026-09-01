CREATE TABLE IF NOT EXISTS "thread_run_leases" (
	"thread_id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"lease_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "thread_run_leases" ADD CONSTRAINT "thread_run_leases_thread_id_planning_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."planning_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "thread_run_leases" ADD CONSTRAINT "thread_run_leases_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_run_leases_wedding_expiry_idx" ON "thread_run_leases" USING btree ("wedding_id","expires_at");