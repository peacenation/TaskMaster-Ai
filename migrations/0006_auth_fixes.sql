-- Magic-link sign-in: Better Auth looks verification records up by id with
-- non-UUID values, which a uuid column rejects (500 on every magic link).
ALTER TABLE "taskmaster_auth"."verification" ALTER COLUMN "id" SET DATA TYPE text;
--> statement-breakpoint
-- Link app users to their login. users.ensure() accepted authId but never
-- wrote it, so users.auth_id stayed null and deleting an account left all of
-- the person's data behind (the ON DELETE CASCADE from migration 0004 had
-- nothing to follow). App user ids equal Better Auth user ids, so the
-- backfill is exact.
--
-- users has FORCE ROW LEVEL SECURITY, and a migration role without
-- BYPASSRLS would match zero rows here with no app.current_user_id set. As
-- the table owner, lift FORCE for this one statement; the migration runs in
-- a transaction, so it can't be left off.
ALTER TABLE "users" NO FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
UPDATE "users" SET "auth_id" = "id"
WHERE "auth_id" IS NULL AND "id" IN (SELECT "id" FROM "taskmaster_auth"."user");
--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
