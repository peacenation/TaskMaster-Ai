ALTER TABLE "users" DROP CONSTRAINT "users_auth_id_user_id_fk";
--> statement-breakpoint
-- ADR-013: sign-in moves to Supabase Auth. Everything below only runs in a
-- Supabase database (staging, production); plain local Postgres skips it.
--
-- 1. Deleting a login deletes the person's data. The account-delete route
--    already removes data first; this trigger also covers users deleted
--    from the Supabase dashboard or admin API. RLS is FORCEd on users, so
--    it sets the RLS user for its own statement before deleting.
-- 2. The Data API (PostgREST) must not reach app tables. The publishable key
--    ships to every browser and grants the anon/authenticated roles; the
--    app never uses the Data API, so those roles get nothing here.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.taskmaster_delete_app_user() RETURNS trigger
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
      BEGIN
        PERFORM set_config('app.current_user_id', OLD.id::text, true);
        DELETE FROM public.users WHERE id = OLD.id;
        RETURN OLD;
      END
      $body$
    $fn$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.taskmaster_delete_app_user() FROM PUBLIC';
    EXECUTE 'DROP TRIGGER IF EXISTS taskmaster_delete_app_user ON auth.users';
    EXECUTE 'CREATE TRIGGER taskmaster_delete_app_user AFTER DELETE ON auth.users '
      'FOR EACH ROW EXECUTE FUNCTION public.taskmaster_delete_app_user()';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'taskmaster_auth') THEN
      EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA taskmaster_auth FROM anon, authenticated';
      EXECUTE 'REVOKE USAGE ON SCHEMA taskmaster_auth FROM anon, authenticated';
    END IF;
  END IF;
END
$$;
