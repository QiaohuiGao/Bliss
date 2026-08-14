CREATE TABLE IF NOT EXISTS "vendor_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"search_id" text NOT NULL,
	"provider_vendor_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"source_url" text NOT NULL,
	"city" text,
	"state" text,
	"price_level" text,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"agent_run_id" text,
	"provider" text NOT NULL,
	"query" jsonb NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_shortlist_items" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"decision_id" text NOT NULL,
	"candidate_id" text NOT NULL,
	"rank" integer NOT NULL,
	"rationale" text NOT NULL,
	"pros" text[] NOT NULL,
	"concerns" text[] NOT NULL,
	"status" text DEFAULT 'considering' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "vendor_effects" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_candidates" ADD CONSTRAINT "vendor_candidates_search_id_vendor_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."vendor_searches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_searches" ADD CONSTRAINT "vendor_searches_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_searches" ADD CONSTRAINT "vendor_searches_thread_id_planning_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."planning_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_searches" ADD CONSTRAINT "vendor_searches_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_shortlist_items" ADD CONSTRAINT "vendor_shortlist_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_shortlist_items" ADD CONSTRAINT "vendor_shortlist_items_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendor_shortlist_items" ADD CONSTRAINT "vendor_shortlist_items_candidate_id_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."vendor_candidates"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_candidates_search_provider_unique" ON "vendor_candidates" USING btree ("search_id","provider_vendor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_candidates_wedding_category_idx" ON "vendor_candidates" USING btree ("wedding_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_searches_wedding_created_idx" ON "vendor_searches" USING btree ("wedding_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_shortlist_decision_candidate_unique" ON "vendor_shortlist_items" USING btree ("decision_id","candidate_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_shortlist_wedding_status_idx" ON "vendor_shortlist_items" USING btree ("wedding_id","status");