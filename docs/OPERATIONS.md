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

**Monorepo:** the web app lives in `apps/web`. In the Vercel project set
**Settings → Build and Deployment → Root Directory** to `apps/web` (deploys
run the Vercel CLI from the repo root and rely on this setting). Database
scripts run from the root (`npm run db:…`) or inside `apps/web`.

`vercel.json` turns off Vercel's own deploys of `main`. Production ships only
through the deploy workflow: **CI green → migrate → build → deploy → health
check**. A deploy can never run code ahead of its migrations.

## Configuration

### Vercel (runtime) environment variables

Set **Production** and **Preview** separately. Preview points at staging.

| Variable | Value |
|---|---|
| `DATABASE_URL_APP` | `taskmaster_app` connection (from `db:supabase:setup`) |
| `DATABASE_CA_CERT` | Supabase root CA, PEM text (Dashboard → Database → SSL). Gives verify-full TLS without a file |
| `DATABASE_POOL_MAX` | `3`: serverless instances multiply connections |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` (Production: the production project; Preview: staging) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API Keys → publishable. Public by design |
| `SUPABASE_SECRET_KEY` | Same page → secret key. **Server-only**; used for account deletion. Never prefix with `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY` | Optional. Without it the built-in rules organise |
| `AI_HOURLY_LIMIT` | Optional, default `30` Claude calls per account per hour |
| `CALENDAR_ENCRYPTION_KEY` | Recommended: any long random string (`openssl rand -base64 32`). Encrypts saved calendar addresses. Without it they're encrypted with a key derived from `SUPABASE_SECRET_KEY`, so rotating that secret means users reconnect calendars |

The same variables apply on **Netlify** (Site configuration → Environment
variables), where the app is currently hosted.

**Never set `DATABASE_URL` (the owner/`postgres` connection) in Vercel.**
The running app doesn't use it, so a compromised server would gain nothing
from it. Only the deploy workflow has it, as a GitHub secret.

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
   `taskmaster_app` (`ALTER ROLE … PASSWORD`), then
   update `.env.local` and the secret stores. Do this for any credential that
   has ever appeared in a terminal, log or chat.
2. **Migrate.** Run locally with the production owner URL:
   `npm run db:migrate:deploy -- --confirm`. Or let the first workflow run do
   it. Then run `npm run db:supabase:setup` once, so the restricted role gets
   default privileges for future tables. Check with `npm run db:check`.
   Configure Supabase Auth ([below](#supabase-auth)).
3. **Vercel project:** import the repository, set the variables above, add
   the custom domain (Vercel issues TLS automatically), and set the Preview
   variables to the staging project.
4. **GitHub:** the environment, secrets and variables above. Then *Actions →
   Deploy → Run workflow*, or push to `main`.
5. **Monitoring** (below). Verify an alert by triggering one.
6. **Demo account:** with production `DATABASE_URL_APP`,
   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in your shell,
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

### Deploying on Netlify

Netlify builds and deploys on every push to `main`, but **does not run
migrations**. Apply them first, from `apps/web`, with the production owner
URL in your shell:

```bash
DATABASE_URL='<production owner URL, session pooler :5432>' \
DATABASE_CA_CERT="$(cat prod-ca-2021.crt)" \
  npm run db:migrate:deploy -- --confirm
```

Migrations are expand-only (below), so running them before the new code
ships is always safe. Code that needs a migration (e.g. calendar tables,
0010) fails until it has run.

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
| `taskmaster_app` password | `ALTER ROLE <role> PASSWORD '<new>'` as owner → update Vercel var → redeploy | Brief errors between the two steps. Do it in a quiet period, or create a new role first, switch, then drop the old one |
| `postgres` (owner) password | Supabase dashboard → update GitHub secret `PRODUCTION_DATABASE_URL` | None for users |
| `SUPABASE_SECRET_KEY` | Dashboard → API Keys → create a new secret key → Vercel → redeploy → delete the old key | None |
| Supabase JWT signing key | Dashboard → JWT Keys → rotate | Sessions refresh onto the new key; none for users |
| `ANTHROPIC_API_KEY` | Create the new key, update Vercel, redeploy, revoke the old key | None |
| Resend SMTP key | New key in Resend → Supabase dashboard → Auth → SMTP → revoke the old one | None |
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

## Product metrics

The PRD's MVP success metrics (§2.9) come from `product_events`: names,
counts and ids only, never task or Brain Dump text (see `/privacy`).

```bash
npm run metrics                     # last 30 days, local database
npm run metrics -- --days 7
DATABASE_URL='<production owner URL>' npm run metrics   # production
```

It reports onboarding completion, time to first value, Brain Dump
conversion, the AI correction rate, plan activation, Next Best Action
acceptance and overrides, and repeat planning. Set targets only once a few
weeks of real data exist (PRD §2.9).

## Kill switches and limits

| Lever | Use |
|---|---|
| `AI_EXTRACTION=off` | Stops every Claude call immediately (cost spike, provider incident, data concern). Capture keeps working on built-in rules, and `/privacy` reports AI as off |
| `AI_HOURLY_LIMIT` | Per-account cap on Claude calls; over it, built-in rules organise and the user is told why |
| Supabase Auth rate limits | Dashboard → Authentication → Rate Limits (sign-ins, emails, token refreshes per IP). Hosted, so they hold across serverless instances |

## Supabase Auth

Sign-in is Supabase Auth (ADR-013). Configure **each** project (staging and
production) in the dashboard. Local development gets the same settings from
`supabase/config.toml`.

1. **Authentication → URL Configuration.**
   - Site URL: `https://<your domain>`.
   - Redirect URLs: `https://<your domain>/**`. For staging, also the preview domain pattern (e.g. `https://*-<team>.vercel.app/**`).
   - The app only ever redirects to `/auth/confirm` and `/auth/callback` on its own origin.
2. **Authentication → Sign In / Providers → Email:**
   - **Confirm email: on**. This is required: it is what makes Google account linking safe.
   - Minimum password length 10.
   - Leaked-password protection: on.
   - Secure password change: on.
3. **Emails → SMTP:** custom SMTP through Resend (`smtp.resend.com`, port 465, user `resend`, the API key as password, a verified sender). The built-in SMTP sends only a few emails an hour.
4. **Emails → Templates:**
   - Paste `supabase/templates/confirmation.html`, `magic_link.html` and `recovery.html` into *Confirm signup*, *Magic link* and *Reset password*.
   - Use the subjects from `supabase/config.toml`.
   - The links go to the app's `/auth/confirm` with a token hash, so they work when opened in another browser or the mail app.
5. **Sign In / Providers → Google:** enable it with the client ID and secret from Google Cloud.
   - In Google Cloud (OAuth client, *Web application*), the authorised redirect URI is **Supabase's** callback: `https://<ref>.supabase.co/auth/v1/callback`.
   - The consent screen asks for scopes `openid`, `email`, `profile` only.
   - The app shows "Continue with Google" automatically once Google is enabled here.
6. **Sign In / Providers → Allow manual linking: on**, for Settings → Connect Google.
7. **Data API:** migration `0009` revokes the `anon`/`authenticated` roles from every app table. Verify once per project:

   ```sql
   select has_table_privilege('anon', 'public.tasks', 'select');  -- false
   ```

**How it behaves**

- **Linking Google:** Supabase links a Google sign-in to an existing account only through a confirmed email.
- **Google-only accounts** have no password. Deleting one requires a Google sign-in from the last 10 minutes (Settings → Confirm with Google).
- **Every request** asks the Auth server whether the session is still valid, so sign-out, password reset and deletion take effect at once.

### Moving existing accounts from Better Auth (one-off)

Rehearse on staging first. On production, in this order:

```sh
cd apps/web
npm run auth:migrate -- --confirm            # 1. dry run: lists who moves
npm run auth:migrate -- --confirm --apply    # 2. create the logins (old app still live; harmless)
# 3. deploy the Supabase Auth version (migration 0009 runs in the deploy workflow)
npm run auth:migrate -- --confirm --apply --send-reset --site=https://<your domain>   # 4. email password users
```

Step 4 must come after the deploy: the reset links point to `/auth/confirm`,
which only the new version serves.

- Each login is recreated in Supabase Auth **with the same ID**, email confirmed, so all data stays attached.
- Password users get one "set a new password" email; Better Auth's password hashes can't be imported.
- Google users just sign in with Google.
- Re-running is safe: existing logins are skipped.

Once production is confirmed working, a later migration drops the `taskmaster_auth` schema (take a backup first).
