# TaskMasterAi

A planning app that turns a messy Brain Dump into a realistic day: it extracts
tasks, recommends the next best action, says plainly when the plan doesn't fit,
and helps you recover when the day goes sideways.

Web: Next.js 16 · React 19 · TypeScript · PostgreSQL 17 with row-level
security · Drizzle ORM · Supabase Auth · Anthropic Claude (optional) · Playwright.
Mobile: Flutter (Android + iOS) on the same backend via `/api/v1`.

A monorepo (npm workspaces):

```
apps/web/                 Next.js app — web UI, server logic, database, and the /api/v1 JSON API
apps/mobile/              Flutter app (Android + iOS), a client of /api/v1
packages/api-contract/    openapi.yaml — the /api/v1 contract both sides follow
android/                  Legacy Trusted Web Activity wrapper — retired once the Flutter app ships
docs/                     Product, architecture, operations, plans
```

- Product spec: [`docs/PRD_v2.md`](docs/PRD_v2.md) (single source of truth)
- How it's built: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Deploying and running it: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Accessibility, security and performance evidence: [`docs/HARDENING.md`](docs/HARDENING.md)
- Plan and progress: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
- Mobile app, API and the next features: [`docs/MOBILE_AND_PLATFORM_PLAN.md`](docs/MOBILE_AND_PLATFORM_PLAN.md)

## Run it locally

You need **Node.js 22**, **PostgreSQL 17** (on macOS: `brew install postgresql@17
&& brew services start postgresql@17`), and **Docker** with the
[Supabase CLI](https://supabase.com/docs/guides/local-development) (`brew install
supabase/tap/supabase`) for local sign-in. No cloud account.

```sh
git clone https://github.com/peacenation/TaskMaster-Ai.git
cd TaskMaster-Ai
npm install

# 1. Local database and a non-superuser app role (RLS is skipped for superusers).
npm run db:bootstrap
cp apps/web/.env.example apps/web/.env.local
# Paste the two lines db:bootstrap printed into apps/web/.env.local:
#   DATABASE_URL=postgresql://<you>@localhost:5432/taskmaster_dev
#   DATABASE_URL_APP=postgresql://taskmaster_app:taskmaster_app_local_dev@localhost:5432/taskmaster_dev
# and set the same two values as LOCAL_DATABASE_URL / LOCAL_DATABASE_URL_APP
# (the test scripts always use those, so tests never touch a cloud database).

# 2. Schema.
npm run db:migrate

# 3. Local sign-in: Supabase Auth + a mail catcher (Docker). Copy the API URL,
#    Publishable key and Secret key it prints into apps/web/.env.local as
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and
#    SUPABASE_SECRET_KEY. (`npm run supabase:status` prints them again.)
cp supabase/.env.example supabase/.env
npm run supabase:start

# 4. Start.
npm run dev
```

Open <http://localhost:3000> and create an account. The confirmation email
lands in the local mail catcher at <http://127.0.0.1:54324>; its link takes you
to the Brain Dump. Try: *"Finish the report by Thursday, call the dentist, book the garage
clear-out at some point"*.

**Optional:**

- **AI organising.** Set `ANTHROPIC_API_KEY` in `apps/web/.env.local`. Without it,
  TaskMaster's built-in rules organise the Brain Dump and the app says so.
  `npm run ai:smoke` makes one real call to check the key.
- **Email and Google** are Supabase Auth settings: locally in
  `supabase/config.toml` (emails go to the mail catcher; Google uses
  placeholders unless you put real credentials in `supabase/.env`), hosted in
  the Supabase dashboard (`docs/OPERATIONS.md` → Supabase Auth).
- **Demo data.** `DEMO_PASSWORD=choose-one npm run db:seed:demo` creates
  `demo@taskmaster.example` with a realistic week of tasks, history and goals.

## Check your work

| Command | What it runs |
|---|---|
| `npm run typecheck` / `lint` / `format:check` | Static checks |
| `npm test` | 250 unit tests; `test:coverage` fails below 85% domain coverage |
| `npm run db:test` | RLS isolation, repositories, auth: against a separate `taskmaster_test` database |
| `npm run e2e` | Playwright: every PRD §2.10 criterion, WCAG 2.1 AA (axe), security headers, performance budgets, desktop + phone. Builds for production and uses its own `taskmaster_e2e` database |
| `npm run check:client-bundle` | Builds with sentinel secrets and fails if any reaches the browser |

Root scripts run in the web workspace; run anything else there with
`npm run <script> -w @taskmaster/web`. `npm run api:lint` validates the
OpenAPI contract.

The test scripts refuse to run against anything but `localhost`. CI
(`.github/workflows/ci.yml`) runs all of the above on every push and pull
request.

## Mobile app

Needs Flutter (stable) — and Xcode for iOS, Android Studio / the Android SDK
for Android. With the web app running (`npm run dev`):

```sh
npm run mobile:get                                  # flutter pub get
npm run mobile:run                                  # Android emulator → http://10.0.2.2:3000
cd apps/mobile && flutter run --dart-define=API_BASE_URL=http://localhost:3000   # iOS simulator
npm run mobile:analyze && npm run mobile:test       # what CI runs
```

Sign in with an account created on the web. Design tokens in
`apps/mobile/lib/theme/tokens.dart` mirror `apps/web/app/globals.css`.

## Web project layout (`apps/web/`)

```
app/            Routes (App Router). Pages are server components; app/actions/ holds server actions
app/api/        extract (AI proxy), account export/delete, auth, health; v1/ is the mobile JSON API
components/     UI, grouped by area: capture, planning, execution, tasks, auth, ui (design system)
lib/domain/     Pure engine: extraction heuristics, dates, scoring, planning, insights. No I/O
lib/repo/       Repositories: the only way app code reaches the database (RLS-scoped)
lib/db/         Drizzle schema, connections, isolation test
lib/ai/         Claude client, prompt, response schema
migrations/     SQL migrations (drizzle-kit), including every RLS policy
e2e/            Playwright suite
scripts/        Database setup, test harness, deploy migrations, demo seed
```
