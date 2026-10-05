# Operations

Deploy, roll back, rotate secrets, restore, and watch production. The
architecture is in [`ARCHITECTURE.md`](ARCHITECTURE.md); database hosting
setup is in [`SUPABASE.md`](SUPABASE.md).

## Environments

| | Where | Database | Deployed by |
|---|---|---|---|
| Development | `npm run dev` | Local Postgres (`taskmaster_dev`) | You |
| Tests | CI, `npm run db:test`, `npm run e2e` | Throwaway local databases, recreated per run | CI |
| Preview | Vercel, one per pull request | **A separate staging Supabase project, never production** | Vercel Git integration |
| Production | Vercel, custom domain | Production Supabase project | `.github/workflows/deploy.yml` only |

`vercel.json` turns off Vercel's own deploys of `main`. Production ships only
through the deploy workflow: **CI green → migrate → build → deploy → health
check**. A deploy can never run code ahead of its migrations.

## Configuration

### Vercel (runtime) environment variables

Set **Production** and **Preview** separately. Preview points at staging.

| Variable | Value |
|---|---|
| `DATABASE_URL_APP` | `taskmaster_app` connection (from `db:supabase:setup`) |
| `DATABASE_URL_AUTH` | `taskmaster_auth_service` connection (from `db:auth:setup`) |
| `DATABASE_CA_CERT` | Supabase root CA, PEM text (Dashboard → Database → SSL). Gives verify-full TLS without a file |
| `DATABASE_POOL_MAX` | `3`: serverless instances multiply connections |
| `BETTER_AUTH_SECRET` | 48+ random bytes, hex (`openssl rand -hex 48`). Different per environment |
| `BETTER_AUTH_URL` | `https://<your domain>` |
| `AUTH_EMAIL_PROVIDER`, `AUTH_EMAIL_FROM`, `RESEND_API_KEY` | Verified sender and key, for magic links and resets |
| `ANTHROPIC_API_KEY` | Optional. Without it the built-in rules organise |
| `AI_HOURLY_LIMIT` | Optional, default `30` Claude calls per account per hour |

**Never set `DATABASE_URL` (the owner/`postgres` connection) in Vercel.**
The running app doesn't use it, so a compromised server would gain nothing
from it. Only the deploy workflow has it, as a GitHub secret. Never set
`AUTH_RATE_LIMIT=off` or `AUTH_EMAIL_PROVIDER=test` outside the e2e server.

### GitHub (deploy workflow)

Create the environment **production** (Settings → Environments). Add
required reviewers if each deploy should wait for approval.

- Environment secrets: `PRODUCTION_DATABASE_URL` (owner, session pooler,
  port 5432), `DATABASE_CA_CERT`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
  `VERCEL_PROJECT_ID` (from `vercel link` → `.vercel/project.json`).
- Repository variables: `PRODUCTION_URL` (e.g. `https://taskmaster.example`)
  and finally `DEPLOY_ENABLED=true`, which switches the workflow on.

## First production launch (in order)

1. **Rotate the database passwords** of `postgres` (Supabase dashboard) and
   `taskmaster_auth_service`/`taskmaster_app` (`ALTER ROLE … PASSWORD`), then
   update `.env.local` and the secret stores. Do this for any credential that
   has ever appeared in a terminal, log or chat.
2. **Migrate.** Run locally with the production owner URL:
   `npm run db:migrate:deploy -- --confirm`. Or let the first workflow run do
   it. Then run `npm run db:supabase:setup` and `npm run db:auth:setup` once,
   so both restricted roles get default privileges for future tables. Check
   with `npm run db:check`.
3. **Vercel project:** import the repository, set the variables above, add
   the custom domain (Vercel issues TLS automatically), and set the Preview
   variables to the staging project.
4. **GitHub:** the environment, secrets and variables above. Then *Actions →
   Deploy → Run workflow*, or push to `main`.
5. **Monitoring** (below). Verify an alert by triggering one.
6. **Demo account:** with production `DATABASE_URL_APP`/`DATABASE_URL_AUTH`
   and `BETTER_AUTH_SECRET` in your shell,
   `DEMO_PASSWORD=… npm run db:seed:demo -- --confirm`.

## Deploying

Merge to `main`. CI runs. When it passes, Deploy:

1. checks out the exact commit CI tested,
2. `npm run db:migrate:deploy`: applies new migrations (already-applied
   ones are skipped) and refreshes role grants,
3. `vercel build --prod` and `vercel deploy --prebuilt --prod`,
4. polls `/api/health` for a minute and fails the run if it never returns
   `{"ok":true}`.

Runs are serialised (`concurrency: production-deploy`). To redeploy without
a code change, run the workflow by hand.

### Writing migrations

- `npm run db:generate -- --name <what>` after changing `lib/db/schema.ts`.
  Add RLS (`ENABLE` + `FORCE` + policy) for any new user-owned table. The
  isolation test fails until you do.
- **Expand, then contract.** A migration must work with both the code
  currently live and the code being deployed: add columns nullable or with
  defaults; drop or rename only in a later release, once no live code uses
  them. This is what makes app rollback safe.
- Never edit an applied migration. `lib/migrations-journal.test.ts` fails if
  journal timestamps aren't increasing. Drizzle silently skips a migration
  dated before the last applied one.

## Rolling back

**Application (target: under 5 minutes).** Vercel → Deployments → the last
good production deployment → *Instant Rollback*. Or run
`vercel rollback <deployment-url> --token …`. This is safe because migrations
are expand-only: the previous code still works with the newer schema. Then
revert the bad commit on `main`. The next deploy ships the revert.

**Database schema.** Migrations are forward-only. Undo a bad one with a new
migration that reverses it, deployed the normal way. Don't hand-edit
production.

**Data.** Supabase takes daily backups on paid plans; point-in-time recovery
is an add-on. Check your plan *before* launch, because the free plan has no
downloadable backups. To restore: Dashboard → Database → Backups → restore
into a **new** project, verify, then repoint `DATABASE_URL_*` and redeploy.
For one user's data, compare their export from Settings against the
restored copy rather than restoring the whole database.

**Rehearse it:** deploy a harmless change, roll back, time it, and record
the date and duration here. Not yet done; it needs the live project.

## Rotating secrets

| Secret | How | Effect |
|---|---|---|
| `taskmaster_app` / `taskmaster_auth_service` password | `ALTER ROLE <role> PASSWORD '<new>'` as owner → update Vercel var → redeploy | Brief errors between the two steps. Do it in a quiet period, or create a new role first, switch, then drop the old one |
| `postgres` (owner) password | Supabase dashboard → update GitHub secret `PRODUCTION_DATABASE_URL` | None for users |
| `BETTER_AUTH_SECRET` | New value in Vercel → redeploy | Everyone is signed out once |
| `ANTHROPIC_API_KEY`, `RESEND_API_KEY` | Create the new key, update Vercel, redeploy, revoke the old key | None |
| `VERCEL_TOKEN` | New token → GitHub secret → revoke the old one | None |

## Monitoring

- **Uptime:** point an uptime monitor (Better Stack, UptimeRobot,
  Checkly…) at `GET /api/health` every minute, alerting a person by email
  or SMS. It returns 200 `{"ok":true}` only when the app is up *and* the
  application role can reach the database, otherwise 503.
- **Errors:** every server error is one log line
  `{"event":"request.error","route":…,"errorName":…,"postgresCode":…,"digest":…}`
  with no user content (`instrumentation.ts`). Add a Vercel log drain or
  alert on `request.error`. To use Sentry instead, forward
  `buildErrorReport(...)` from `instrumentation.ts`, never the raw error,
  because Postgres messages contain row values.
- **Also logged:** `extraction.fallback` (why Claude wasn't used:
  `quota`, `rate_limited`, `timeout`…) and `health.database_unreachable`.
- **Verify alerts deliberately:** on a preview deployment, set
  `DATABASE_URL_APP` to a wrong password → `/api/health` returns 503 → the
  monitor must alert. Restore it afterwards. An alert nobody receives is not
  monitoring.

## Kill switches and limits

| Lever | Use |
|---|---|
| `AI_EXTRACTION=off` | Stops every Claude call immediately (cost spike, provider incident, data concern). Capture keeps working on built-in rules, and `/privacy` reports AI as off |
| `AI_HOURLY_LIMIT` | Per-account cap on Claude calls; over it, built-in rules organise and the user is told why |
| Better Auth rate limiting | On in every environment, counted in the database so it holds across serverless instances |
