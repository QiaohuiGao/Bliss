DO $$ BEGIN
 CREATE TYPE "public"."budget_tier" AS ENUM('under_20k', '20k_40k', '40k_75k', 'over_75k');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."guest_count_range" AS ENUM('under_50', '50_100', '100_150', '150_250', 'over_250');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."member_role" AS ENUM('owner', 'partner');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."planner_type" AS ENUM('full', 'partial', 'day_of', 'venue_only', 'none');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."wedding_type" AS ENUM('traditional', 'micro', 'elopement', 'destination', 'courthouse');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."module_status" AS ENUM('locked', 'active', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_status_v2" AS ENUM('todo', 'done', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"display_name" text,
	"email" text NOT NULL,
	"avatar_url" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"time_zone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wedding_members" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weddings" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_date" date,
	"state" char(2),
	"city" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"wedding_type" "wedding_type" DEFAULT 'traditional' NOT NULL,
	"cultures" text[] DEFAULT '{}' NOT NULL,
	"guest_count_exact" integer,
	"guest_count_range" "guest_count_range",
	"styles" text[] DEFAULT '{}' NOT NULL,
	"budget_tier" "budget_tier",
	"budget_total_cents" integer,
	"budget_min_cents" integer,
	"budget_max_cents" integer,
	"venue_preferences" text[] DEFAULT '{}' NOT NULL,
	"has_planner" boolean DEFAULT false NOT NULL,
	"planner_type" "planner_type" DEFAULT 'none' NOT NULL,
	"special_needs" text[] DEFAULT '{}' NOT NULL,
	"invite_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weddings_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modules" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"template_key" text,
	"i18n_key" text,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"sort_order" integer NOT NULL,
	"status" "module_status" DEFAULT 'locked' NOT NULL,
	"is_optional" boolean DEFAULT false,
	"is_custom" boolean DEFAULT false,
	"culture" text,
	"estimated_days" integer,
	"suggested_deadline" date,
	"user_deadline" date,
	"actual_started_at" timestamp,
	"completed_at" timestamp,
	"prerequisites" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sub_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"i18n_key" text,
	"title" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_optional" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"vendor_name" text,
	"contact_info" text,
	"price_quote_cents" integer,
	"website" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"sub_module_id" text NOT NULL,
	"wedding_id" text NOT NULL,
	"i18n_key" text,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "task_status_v2" DEFAULT 'todo' NOT NULL,
	"is_optional" boolean DEFAULT false,
	"assignee_id" text,
	"due_date" date,
	"lead_time_days" integer,
	"rating" integer,
	"notes" text,
	"cost_cents" integer,
	"cost_category" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"trigger_key" text NOT NULL,
	"i18n_key" text,
	"params" jsonb,
	"shown_at" timestamp,
	"triggered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "module_celebrations" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"wedding_id" text NOT NULL,
	"days_taken" integer,
	"tasks_completed" integer,
	"photos_uploaded" integer,
	"encouragement_key" text,
	"encouragement_params" jsonb,
	"shown_at" timestamp,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_feed" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wedding_members" ADD CONSTRAINT "wedding_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modules" ADD CONSTRAINT "modules_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_modules" ADD CONSTRAINT "sub_modules_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_photos" ADD CONSTRAINT "task_photos_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_vendors" ADD CONSTRAINT "task_vendors_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sub_module_id_sub_modules_id_fk" FOREIGN KEY ("sub_module_id") REFERENCES "public"."sub_modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "milestones" ADD CONSTRAINT "milestones_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "module_celebrations" ADD CONSTRAINT "module_celebrations_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "module_celebrations" ADD CONSTRAINT "module_celebrations_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
