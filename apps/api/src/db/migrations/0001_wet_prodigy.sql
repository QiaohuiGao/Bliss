CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"thread_id" text,
	"mode" text NOT NULL,
	"goal" text NOT NULL,
	"artifact_bundle_id" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"tools_version" text NOT NULL,
	"steps" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"stop_reason" text,
	"outcome" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_spans" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"parent_span_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micros" integer,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"agent_run_id" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"quest_key" text NOT NULL,
	"question_key" text NOT NULL,
	"state" text NOT NULL,
	"summary" text NOT NULL,
	"proposed_choice" text,
	"reason" text,
	"alternatives_considered" jsonb NOT NULL,
	"member_inputs" jsonb NOT NULL,
	"task_effects" jsonb NOT NULL,
	"memory_effects" jsonb NOT NULL,
	"external_actions" jsonb NOT NULL,
	"moment_candidate" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmed_by" text,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"quest_key" text NOT NULL,
	"question_key" text NOT NULL,
	"choice" text NOT NULL,
	"reason" text,
	"decided_by" text NOT NULL,
	"confidence" text NOT NULL,
	"was_contested" boolean DEFAULT false NOT NULL,
	"proposal_id" text NOT NULL,
	"supersedes_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"decision_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text,
	"idempotency_key" text,
	"result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_records" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"decision_id" text,
	"subject_type" text NOT NULL,
	"subject_id" text,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"source" text NOT NULL,
	"confidence_basis_points" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"evidence_message_ids" text[] NOT NULL,
	"created_by" text,
	"supersedes_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "moments" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"decision_id" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"title" text NOT NULL,
	"narrative" text NOT NULL,
	"source_message_ids" text[] NOT NULL,
	"created_by_agent_run_id" text,
	"saved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"saved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "planning_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"quest_key" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_by" text,
	"resolved_decision_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "thread_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"wedding_id" text NOT NULL,
	"author_type" text NOT NULL,
	"author_user_id" text,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "template_key" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source" text DEFAULT 'template' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "rationale" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "decision_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_thread_id_planning_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."planning_threads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_spans" ADD CONSTRAINT "agent_spans_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_thread_id_planning_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."planning_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_thread_id_planning_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."planning_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decisions" ADD CONSTRAINT "decisions_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_actions" ADD CONSTRAINT "external_actions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_claims" ADD CONSTRAINT "memory_claims_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_claims" ADD CONSTRAINT "memory_claims_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memory_claims" ADD CONSTRAINT "memory_claims_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_created_by_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("created_by_agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "moments" ADD CONSTRAINT "moments_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "planning_threads" ADD CONSTRAINT "planning_threads_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "planning_threads" ADD CONSTRAINT "planning_threads_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_planning_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."planning_threads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_wedding_started_idx" ON "agent_runs" USING btree ("wedding_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_spans_run_started_idx" ON "agent_spans" USING btree ("run_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "decision_proposals_thread_version_unique" ON "decision_proposals" USING btree ("thread_id","version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_proposals_wedding_status_idx" ON "decision_proposals" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "decisions_proposal_unique" ON "decisions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decisions_wedding_quest_created_idx" ON "decisions" USING btree ("wedding_id","quest_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "external_actions_idempotency_unique" ON "external_actions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_operation_key_unique" ON "idempotency_records" USING btree ("wedding_id","operation","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_claims_wedding_key_idx" ON "memory_claims" USING btree ("wedding_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "planning_threads_wedding_status_idx" ON "planning_threads" USING btree ("wedding_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "thread_messages_thread_created_idx" ON "thread_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_decision_template_unique" ON "tasks" USING btree ("decision_id","template_key");