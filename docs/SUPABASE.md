# Supabase database hosting

Supabase hosts TaskMaster's PostgreSQL database. Next.js continues to use
Drizzle and `pg` on the server. The existing single local user and transaction-local
`app.current_user_id` policies stay in place; Supabase Auth is not part of this change.

Selected project: **`cpfmxwvaddfixgwujekn`**, reported empty by the Product Owner.
[Project dashboard](https://supabase.com/dashboard/project/cpfmxwvaddfixgwujekn).
Connected on 2026-10-04: all checked-in migrations applied, restricted
application role provisioned, and read/write plus cross-user isolation verified.
Connection URLs remain private in `.env.local`. Verified TLS uses the Supabase
CA certificate at `.certs/supabase-ca.pem` (gitignored), referenced with
`sslmode=verify-full` and `sslrootcert`. Local database tests remain local.

## Connect a new project

1. Create a Supabase project. Use a fresh database for TaskMaster. If a project
   already has application tables, inspect it before running these migrations:
   TaskMaster creates tables such as `public.users`, `public.tasks` and `public.projects`.
2. In the dashboard's **Connect** dialog, copy the **Session pooler** PostgreSQL
   URL on port **5432**. Copy the actual endpoint rather than guessing it from
   the region. Session pooling supports IPv4 and is appropriate for the current
   locally running Next.js server and migrations.
3. Before replacing the active connection strings, preserve their local values
   in `.env.local`:

   ```dotenv
   LOCAL_DATABASE_URL=your-original-local-admin-url
   LOCAL_DATABASE_URL_APP=your-original-local-application-url
   DATABASE_URL=postgresql://postgres.PROJECT_REF:ENCODED_PASSWORD@YOUR_POOLER_HOST:5432/postgres?sslmode=require
   ```

   Replace the placeholders privately in this gitignored file. Use your database
   password, percent-encoded for a URL; Supabase API keys are not database passwords.
   Keep any existing Claude settings. For certificate verification, download the
   project's root certificate and use `sslmode=verify-full&sslrootcert=/absolute/path/to/certificate`.

4. Apply the checked-in migrations, then provision the restricted application role:

   ```sh
   npm run db:migrate
   npm run db:supabase:setup
   npm run db:check
   ```

   Setup creates `taskmaster_app` with a generated password, no superuser,
   role-creation, database-creation or RLS-bypass privileges, and grants access
   to TaskMaster's eleven tables and its context helper. It writes
   `DATABASE_URL_APP` into `.env.local` without printing credentials. The setup
   can be re-run with the existing matching application connection string;
   it does not reset an existing role's password. Re-run setup when new
   TaskMaster tables need application grants.

   `db:check` is read-only: it verifies connectivity, role flags, forced RLS
   and that no rows can be read without user context. It supplements the full
   cross-user isolation tests that run locally.

5. Restart `npm run dev`. Open Today, capture and commit a small test item,
   and reload to confirm that the app reads it from the hosted database.
   Existing local tasks are not copied by schema migrations; data transfer
   is a separate explicit step.

For database-only usage, disable the Supabase **Data API** in the dashboard's
API settings; TaskMaster accesses PostgreSQL directly through its server repositories.
The application remains a single-user development app until authentication is built.

## Local tests and seed data

`npm run db:test` uses `LOCAL_DATABASE_URL` and `LOCAL_DATABASE_URL_APP` when
provided, creates/migrates **`taskmaster_test`**, and runs destructive fixtures
only there. Both URLs must refer to your local Postgres installation. If the
active app URLs point to Supabase and local URLs are missing, the test runner
stops before connecting. Run `npm run db:bootstrap` if local Postgres needs setup.

`npm run db:seed` resets data and is restricted to localhost. It refuses to
seed or truncate Supabase. To seed local sample data after switching the app,
use local connection URLs in the command's environment rather than changing
the hosted database. Unit tests do not require either database.

## Switch back

Restore `DATABASE_URL` and `DATABASE_URL_APP` from the two saved local values
and restart Next.js. No Supabase tables or local tasks are removed by switching.

## Sources

- [Supabase PostgreSQL connections, pooling, custom-role usernames and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase roles and passwords](https://supabase.com/docs/guides/database/postgres/roles)
- [Supabase with Drizzle; disabling the Data API](https://supabase.com/docs/guides/database/drizzle)
