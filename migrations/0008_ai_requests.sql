CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_requests_user_created_idx" ON "ai_requests" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_requests_isolation" ON "ai_requests"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
