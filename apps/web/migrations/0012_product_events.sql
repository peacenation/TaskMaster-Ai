CREATE TABLE "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_events_user_dedupe_unique" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_events_name_time_idx" ON "product_events" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "product_events_user_id_idx" ON "product_events" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "product_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "product_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "product_events_isolation" ON "product_events"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
