CREATE TABLE IF NOT EXISTS "decision_proposal_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"wedding_id" text NOT NULL,
	"proposal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposal_approvals" ADD CONSTRAINT "decision_proposal_approvals_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposal_approvals" ADD CONSTRAINT "decision_proposal_approvals_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_proposal_approvals" ADD CONSTRAINT "decision_proposal_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "decision_proposal_approvals_proposal_member_unique" ON "decision_proposal_approvals" USING btree ("proposal_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_proposal_approvals_wedding_proposal_idx" ON "decision_proposal_approvals" USING btree ("wedding_id","proposal_id");