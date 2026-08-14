CREATE TABLE IF NOT EXISTS "agent_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"run_id" text NOT NULL,
	"user_id" text NOT NULL,
	"dimension" text NOT NULL,
	"rating" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_feedback_run_member_dimension_unique" ON "agent_feedback" USING btree ("run_id","user_id","dimension");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_feedback_wedding_created_idx" ON "agent_feedback" USING btree ("wedding_id","created_at");