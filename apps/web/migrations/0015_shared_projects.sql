CREATE TABLE "project_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	CONSTRAINT "project_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_user_unique" UNIQUE("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invites" ADD CONSTRAINT "project_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_invites_project_id_idx" ON "project_invites" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_invites_email_idx" ON "project_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "project_members_user_id_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Shared projects: access is "your own rows, plus rows in projects you're a
-- member of". The membership checks are SECURITY DEFINER so a policy on
-- projects can consult project_members (and vice versa) without recursing
-- through each other's policies. They run as the migration owner, which
-- bypasses RLS (a superuser locally; Supabase's postgres has BYPASSRLS),
-- and only ever answer about app_current_user_id().
CREATE OR REPLACE FUNCTION can_access_project(pid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT pid IS NOT NULL AND app_current_user_id() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = pid AND p.user_id = app_current_user_id())
    OR EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = pid AND m.user_id = app_current_user_id())
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_user_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT lower(email) FROM users WHERE id = app_current_user_id()
$$;
--> statement-breakpoint
-- Names of the people on a project, for those who are on it. Only id, name
-- and email: other columns of users (preferences, billing) stay private.
CREATE OR REPLACE FUNCTION project_people(pid uuid)
RETURNS TABLE (user_id uuid, name text, email text, is_owner boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.name, u.email, true
  FROM projects p JOIN users u ON u.id = p.user_id
  WHERE p.id = pid AND can_access_project(pid)
  UNION ALL
  SELECT u.id, u.name, u.email, false
  FROM project_members m JOIN users u ON u.id = m.user_id
  WHERE m.project_id = pid AND can_access_project(pid)
$$;
--> statement-breakpoint
-- Callable only by the application role, never by Supabase's API roles.
REVOKE ALL ON FUNCTION can_access_project(uuid), app_current_user_email(), project_people(uuid) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'taskmaster_app') THEN
    GRANT EXECUTE ON FUNCTION can_access_project(uuid), app_current_user_email(), project_people(uuid) TO taskmaster_app;
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY "projects_isolation" ON "projects";
--> statement-breakpoint
CREATE POLICY "projects_owner" ON "projects"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
-- Members can see a shared project; only its owner can change or delete it.
CREATE POLICY "projects_member_read" ON "projects" FOR SELECT
  USING (can_access_project("id"));
--> statement-breakpoint
DROP POLICY "tasks_isolation" ON "tasks";
--> statement-breakpoint
CREATE POLICY "tasks_owner" ON "tasks"
  USING ("user_id" = app_current_user_id())
  WITH CHECK ("user_id" = app_current_user_id());
--> statement-breakpoint
-- Everyone on a project can see and work on its tasks.
CREATE POLICY "tasks_shared" ON "tasks"
  USING ("project_id" IS NOT NULL AND can_access_project("project_id"))
  WITH CHECK ("project_id" IS NOT NULL AND can_access_project("project_id"));
--> statement-breakpoint
ALTER TABLE "project_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "project_members_read" ON "project_members" FOR SELECT
  USING (can_access_project("project_id"));
--> statement-breakpoint
-- Joining needs an open invitation to your own email address.
CREATE POLICY "project_members_join" ON "project_members" FOR INSERT
  WITH CHECK (
    "user_id" = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM project_invites i
      WHERE i.project_id = project_members.project_id
        AND lower(i.email) = app_current_user_email()
        AND i.accepted_at IS NULL AND i.declined_at IS NULL AND i.expires_at > now()
    )
  );
--> statement-breakpoint
-- Leave a project yourself, or remove someone from a project you own.
CREATE POLICY "project_members_leave" ON "project_members" FOR DELETE
  USING (
    "user_id" = app_current_user_id()
    OR EXISTS (SELECT 1 FROM projects p WHERE p.id = project_members.project_id AND p.user_id = app_current_user_id())
  );
--> statement-breakpoint
ALTER TABLE "project_invites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "project_invites" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "project_invites_read" ON "project_invites" FOR SELECT
  USING (
    "user_id" = app_current_user_id()
    OR lower("email") = app_current_user_email()
    OR can_access_project("project_id")
  );
--> statement-breakpoint
-- Only a project's owner invites people to it.
CREATE POLICY "project_invites_create" ON "project_invites" FOR INSERT
  WITH CHECK (
    "user_id" = app_current_user_id()
    AND EXISTS (SELECT 1 FROM projects p WHERE p.id = project_invites.project_id AND p.user_id = app_current_user_id())
  );
--> statement-breakpoint
-- The invitee answers it; the inviter can withdraw it.
CREATE POLICY "project_invites_answer" ON "project_invites" FOR UPDATE
  USING (lower("email") = app_current_user_email() OR "user_id" = app_current_user_id())
  WITH CHECK (lower("email") = app_current_user_email() OR "user_id" = app_current_user_id());
--> statement-breakpoint
CREATE POLICY "project_invites_withdraw" ON "project_invites" FOR DELETE
  USING ("user_id" = app_current_user_id());
