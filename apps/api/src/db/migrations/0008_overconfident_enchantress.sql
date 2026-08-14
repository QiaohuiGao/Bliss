CREATE TABLE IF NOT EXISTS "schedule_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"task_id" text,
	"decision_id" text,
	"quest_key" text,
	"week_start" date,
	"slack_days" integer,
	"overload_minutes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"depends_on_task_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weddings" ADD COLUMN "weekly_capacity_hours" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "effort_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "computed_latest_start" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "planned_week_start" date;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "slack_days" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "on_critical_path" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_issues" ADD CONSTRAINT "schedule_issues_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_issues" ADD CONSTRAINT "schedule_issues_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "schedule_issues" ADD CONSTRAINT "schedule_issues_decision_id_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decisions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_issues_wedding_severity_idx" ON "schedule_issues" USING btree ("wedding_id","severity");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_dependencies_edge_unique" ON "task_dependencies" USING btree ("task_id","depends_on_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_dependencies_prerequisite_idx" ON "task_dependencies" USING btree ("depends_on_task_id");