CREATE TABLE IF NOT EXISTS "media_upload_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"created_by" text NOT NULL,
	"provider" text NOT NULL,
	"purpose" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"original_filename" text NOT NULL,
	"object_key" text NOT NULL,
	"asset_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attached_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_upload_intents" ADD CONSTRAINT "media_upload_intents_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "media_upload_intents" ADD CONSTRAINT "media_upload_intents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_upload_intents_wedding_status_idx" ON "media_upload_intents" USING btree ("wedding_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_upload_intents_object_key_unique" ON "media_upload_intents" USING btree ("object_key");