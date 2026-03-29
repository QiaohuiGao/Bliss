DO $$ BEGIN
 CREATE TYPE "public"."guest_count_mode" AS ENUM('micro', 'intimate', 'classic', 'grand');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."location_mode" AS ENUM('urban', 'suburban', 'rural');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."planning_style" AS ENUM('full_diy', 'mixed', 'vendor_led', 'full_service');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."timeline_mode" AS ENUM('fast', 'medium', 'comfortable', 'relaxed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'complete', 'skipped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."guest_priority" AS ENUM('must_invite', 'nice_to_have');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."guest_side" AS ENUM('partner_a', 'partner_b', 'mutual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."rsvp_status" AS ENUM('pending', 'yes', 'no');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."budget_category" AS ENUM('venue', 'catering', 'photography', 'music', 'florals', 'attire', 'stationery', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mood" AS ENUM('great', 'okay', 'overwhelmed', 'stressed', 'lost');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"display_name" text,
	"email" text NOT NULL,
	"push_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weddings" (
	"id" text PRIMARY KEY NOT NULL,
	"partner_a_id" text NOT NULL,
	"partner_b_id" text,
	"wedding_date" timestamp,
	"guest_count_mode" "guest_count_mode" DEFAULT 'intimate' NOT NULL,
	"planning_style" "planning_style" DEFAULT 'mixed' NOT NULL,
	"timeline_mode" "timeline_mode" DEFAULT 'comfortable' NOT NULL,
	"location_mode" "location_mode" DEFAULT 'suburban' NOT NULL,
	"vibe_tags" text[] DEFAULT '{}' NOT NULL,
	"priority_tags" text[] DEFAULT '{}' NOT NULL,
	"current_stage" integer DEFAULT 1 NOT NULL,
	"partner_a_name" text,
	"partner_b_name" text,
	"invite_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"stage" integer NOT NULL,
	"title" text NOT NULL,
	"why_it_matters" text NOT NULL,
	"how_to_do_it" text NOT NULL,
	"done_definition" text NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"assigned_to" text,
	"due_guidance" text NOT NULL,
	"is_deliverable" boolean DEFAULT false NOT NULL,
	"celebration_trigger" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guests" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"address" text,
	"side" "guest_side" DEFAULT 'mutual' NOT NULL,
	"priority" "guest_priority" DEFAULT 'must_invite' NOT NULL,
	"rsvp_status" "rsvp_status" DEFAULT 'pending' NOT NULL,
	"dietary_notes" text,
	"plus_one" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "budget_items" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"category" "budget_category" NOT NULL,
	"label" text NOT NULL,
	"estimated_cents" integer DEFAULT 0 NOT NULL,
	"actual_cents" integer DEFAULT 0 NOT NULL,
	"is_diy" boolean DEFAULT false NOT NULL,
	"vendor_name" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stress_check_ins" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"user_id" text NOT NULL,
	"mood" "mood" NOT NULL,
	"context_tag" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "celebrations" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"trigger_key" text NOT NULL,
	"shown_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weddings" ADD CONSTRAINT "weddings_partner_a_id_users_id_fk" FOREIGN KEY ("partner_a_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "weddings" ADD CONSTRAINT "weddings_partner_b_id_users_id_fk" FOREIGN KEY ("partner_b_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guests" ADD CONSTRAINT "guests_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stress_check_ins" ADD CONSTRAINT "stress_check_ins_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stress_check_ins" ADD CONSTRAINT "stress_check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "celebrations" ADD CONSTRAINT "celebrations_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
