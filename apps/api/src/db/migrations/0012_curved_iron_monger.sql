ALTER TABLE "planning_threads" ADD COLUMN "question_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "planning_threads_wedding_question_idx" ON "planning_threads" USING btree ("wedding_id","quest_key","question_key");
