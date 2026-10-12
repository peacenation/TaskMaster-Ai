ALTER TABLE "brain_dumps" ADD COLUMN "committed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD COLUMN "times_per_period" integer DEFAULT 1 NOT NULL;