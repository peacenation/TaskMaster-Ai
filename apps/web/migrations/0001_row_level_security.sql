-- Row-level security on every user-scoped table.
--
-- Keyed on a session-local GUC, not Supabase's auth.uid() — this project
-- is self-hosted Postgres with Better Auth (deferred to Phase 8), not
-- Supabase, so auth.uid() does not exist here. See
-- docs/adr/ADR-004-row-level-security.md and docs/ERD.md.
--
-- The application sets this once per transaction, before any query:
--   SET LOCAL app.current_user_id = '<uuid>';
-- lib/db/client.ts's withUserContext() wrapper is the only place this
-- should ever be called from.
--
-- CRITICAL: Postgres superusers and any role with the BYPASSRLS attribute
-- ignore every policy below, regardless of FORCE ROW LEVEL SECURITY. The
-- default local Homebrew role is a superuser. The application, the seed
-- script's verification step, and the isolation test MUST connect as the
-- dedicated non-superuser role created by scripts/db-bootstrap.sh
-- (DATABASE_URL_APP), never the admin role (DATABASE_URL).
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_isolation" ON "users"
  USING ("id" = app_current_user_id())
  WITH CHECK ("id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "goals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "goals_isolation" ON "goals"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "projects_isolation" ON "projects"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "brain_dumps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "brain_dumps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "brain_dumps_isolation" ON "brain_dumps"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tasks_isolation" ON "tasks"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "task_dependencies" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_dependencies_isolation" ON "task_dependencies"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "task_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "task_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "task_events_isolation" ON "task_events"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "recurrence_rules" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "recurrence_rules" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "recurrence_rules_isolation" ON "recurrence_rules"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plans" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "plans_isolation" ON "plans"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
ALTER TABLE "plan_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "plan_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "plan_items_isolation" ON "plan_items"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
