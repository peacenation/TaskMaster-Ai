# TaskMaster

A planning app that turns a messy Brain Dump into a realistic day: it extracts
tasks, recommends the next best action, says plainly when the plan doesn't fit,
and helps you recover when the day goes sideways.

Next.js 16 · React 19 · TypeScript · PostgreSQL 17 with row-level security ·
Drizzle ORM · Better Auth · Anthropic Claude (optional) · Playwright.

- Product spec: [`docs/PRD_v2.md`](docs/PRD_v2.md) (single source of truth)
- How it's built: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Deploying and running it: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Accessibility, security and performance evidence: [`docs/HARDENING.md`](docs/HARDENING.md)
- Plan and progress: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)

## Run it locally

You need **Node.js 22** and **PostgreSQL 17** (on macOS: `brew install postgresql@17
&& brew services start postgresql@17`). No Docker, no cloud account.

```sh
git clone https://github.com/peacenation/TaskMaster-Ai.git
cd TaskMaster-Ai
npm install

# 1. Local database and a non-superuser app role (RLS is skipped for superusers).
npm run db:bootstrap
cp .env.example .env.local
# Paste the two lines db:bootstrap printed into .env.local:
#   DATABASE_URL=postgresql://<you>@localhost:5432/taskmaster_dev
#   DATABASE_URL_APP=postgresql://taskmaster_app:taskmaster_app_local_dev@localhost:5432/taskmaster_dev
# and set the same two values as LOCAL_DATABASE_URL / LOCAL_DATABASE_URL_APP
# (the test scripts always use those, so tests never touch a cloud database).

# 2. Schema, then the authentication role. This writes DATABASE_URL_AUTH and a
#    generated BETTER_AUTH_SECRET into .env.local.
npm run db:migrate
npm run db:auth:setup

# 3. Start.
npm run dev
```

Open <http://localhost:3000>, create an account, and you'll land on the Brain
Dump. Try: *"Finish the report by Thursday, call the dentist, book the garage
clear-out at some point"*.

**Optional:**

- **AI organising.** Set `ANTHROPIC_API_KEY` in `.env.local`. Without it,
  TaskMaster's built-in rules organise the Brain Dump and the app says so.
  `npm run ai:smoke` makes one real call to check the key.
- **Email** (magic links, password reset). Set `RESEND_API_KEY` and
  `AUTH_EMAIL_FROM`. Email-and-password sign-up works without it.
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

The test scripts refuse to run against anything but `localhost`. CI
(`.github/workflows/ci.yml`) runs all of the above on every push and pull
request.

## Project layout

```
app/            Routes (App Router). Pages are server components; app/actions/ holds server actions
app/api/        extract (AI proxy), account export/delete, auth, health
components/     UI, grouped by area: capture, planning, execution, tasks, auth, ui (design system)
lib/domain/     Pure engine: extraction heuristics, dates, scoring, planning, insights. No I/O
lib/repo/       Repositories: the only way app code reaches the database (RLS-scoped)
lib/db/         Drizzle schema, connections, isolation test
lib/ai/         Claude client, prompt, response schema
migrations/     SQL migrations (drizzle-kit), including every RLS policy
e2e/            Playwright suite
scripts/        Database setup, test harness, deploy migrations, demo seed
docs/           PRD, plan, architecture, operations, ADRs
```
