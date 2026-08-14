CREATE TABLE IF NOT EXISTS "agent_artifact_bundles" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_key" text NOT NULL,
	"mode" text NOT NULL,
	"prompt_version" text NOT NULL,
	"tools_version" text NOT NULL,
	"domain_pack_version" text NOT NULL,
	"policy_version" text NOT NULL,
	"model_policy_version" text NOT NULL,
	"eval_suite_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_deployments" (
	"id" text PRIMARY KEY NOT NULL,
	"pack_key" text NOT NULL,
	"bundle_id" text NOT NULL,
	"stage" text NOT NULL,
	"allocation_basis_points" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_release_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"pack_key" text NOT NULL,
	"deployment_id" text NOT NULL,
	"bundle_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_release_controls" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"killed" boolean DEFAULT false NOT NULL,
	"reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_deployments" ADD CONSTRAINT "agent_deployments_bundle_id_agent_artifact_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."agent_artifact_bundles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_release_assignments" ADD CONSTRAINT "agent_release_assignments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_release_assignments" ADD CONSTRAINT "agent_release_assignments_deployment_id_agent_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."agent_deployments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_release_assignments" ADD CONSTRAINT "agent_release_assignments_bundle_id_agent_artifact_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."agent_artifact_bundles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_artifact_bundles_pack_created_idx" ON "agent_artifact_bundles" USING btree ("pack_key","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_deployments_pack_status_created_idx" ON "agent_deployments" USING btree ("pack_key","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_release_assignments_wedding_pack_unique" ON "agent_release_assignments" USING btree ("wedding_id","pack_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_release_assignments_deployment_idx" ON "agent_release_assignments" USING btree ("deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_release_controls_scope_key_unique" ON "agent_release_controls" USING btree ("scope","key");