CREATE TABLE IF NOT EXISTS "moment_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"moment_id" text NOT NULL,
	"wedding_id" text NOT NULL,
	"kind" text DEFAULT 'memory' NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moment_assets" ADD CONSTRAINT "moment_assets_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "public"."moments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moment_assets" ADD CONSTRAINT "moment_assets_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "moment_assets_moment_sort_idx" ON "moment_assets" USING btree ("moment_id","sort_order");