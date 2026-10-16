ALTER TABLE "project_invites" ADD COLUMN "project_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_invites" ADD COLUMN "inviter_name" text DEFAULT '' NOT NULL;