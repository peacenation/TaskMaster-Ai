# Architecture

How TaskMaster is put together, and why. The reasoning behind each choice is
in the ADRs (`docs/adr/`); this is the map.

## Shape

One Next.js 16 application (App Router) on a serverless host, one PostgreSQL
database, two optional outside services:

```
Browser ──HTTPS──▶ Next.js (Vercel)
                    ├─ proxy.ts                 session-cookie gate on every route
                    ├─ pages (server components) ┐
                    ├─ server actions            ├─▶ lib/repo ──▶ Postgres (Supabase)
                    ├─ /api/* route handlers     ┘     RLS-scoped transaction per request
                    ├─ Better Auth ──────────────────▶ taskmaster_auth schema (own role)
                    ├─ /api/extract ─────────────────▶ Anthropic Claude API (optional)
                    └─ auth emails ──────────────────▶ Resend / Amazon SES (optional)
```

There is no client-side data store and no public API: pages render on the
server from the database, and mutations are server actions. Client
components handle only interaction (forms, the focus timer, the Brain Dump
flow).

## Layers

| Layer | Where | Rule |
|---|---|---|
| Routes | `app/` | Read the session, call repositories and domain functions, render. No SQL. |
| Domain | `lib/domain/` | Pure functions: extraction heuristics, date parsing, scoring, planning, Reality Check, insights. No I/O, injected clock. 99%+ test coverage. |
| Orchestration | `lib/capture/`, `lib/planning/`, `lib/execution/` | Combine domain and repositories for one use case (commit a Brain Dump, build Today, change a task's status). |
| Repositories | `lib/repo/` | The only code that touches application tables (ADR-005). |
| Database | `lib/db/`, `migrations/` | Drizzle schema, connections, SQL migrations including every RLS policy. |

## Data isolation (ADR-004)

Every user-owned table has a `user_id` and a forced row-level security policy
`user_id = app_current_user_id()`. That function reads a transaction-local
setting, which `withRepositories(userId, fn)` sets before running `fn` in one
transaction. The application connects as `taskmaster_app`, a role with no
superuser or `BYPASSRLS` privilege, so a missing `WHERE` clause returns
nothing rather than someone else's data.

`lib/db/isolation.test.ts` lists every table with an ownership column and
fails if one lacks forced RLS and a policy. It then checks that one user
cannot select, insert, update or delete another user's rows in each table.

Authentication data lives in a separate `taskmaster_auth` schema, reached only
through a third role, `taskmaster_auth_service`. Deleting the auth user
cascades to every application row through `users.auth_id`.

## Request lifecycle

1. `proxy.ts` lets public paths through (`/signin`, `/signup`, `/reset`,
   `/magic`, `/privacy`, `/design`, `/api/health`, `/api/auth/*`). Without a
   session cookie, it redirects pages to `/signin` and gives `/api/*` a 401.
2. The page or action calls `getCurrentUserId()`, which validates the session
   against the database. The session cookie cache is disabled, so sign-out and
   deletion take effect immediately.
3. All reads and writes for the request run in `withRepositories(userId, …)`:
   one transaction, scoped by RLS.

## Capture: Brain Dump → proposal → commit (ADR-006, 007, 011)

1. The raw text is **saved first** (`brain_dumps`), so nothing typed is lost.
2. `/api/extract` claims one slot of the per-user hourly AI quota
   (`ai_requests`, advisory-locked), then asks Claude for a structured
   proposal, validated against a Zod schema. On any failure — no key,
   timeout, rate limit, quota, refusal, invalid output — the built-in
   heuristic produces the proposal instead, and the UI says which engine
   ran. If the network fails, the browser runs the same heuristic locally.
3. The user reviews and edits; **nothing becomes a task until they confirm**.
   The commit writes all tasks, projects and events in one transaction.

## Decide: Today

`lib/planning/today.ts` scores open tasks (`lib/domain/prioritize.ts`:
deadline, priority, importance, goal link, neglect, dependencies; see
`docs/SCORING.md`), picks the Next Best Action for the time and energy
available right now, and fits a plan into 80% of today's time (20% buffer).
Flexible and Scheduled views render the same server-built plan. If the
must-do work doesn't fit, Reality Check states the arithmetic and offers
choices. It never moves anything on its own.

## Execute and review

Every status change writes a `task_events` row. That history drives Recovery
Check-In (missed planned work: keep / postpone / drop), Procrastination
Assist, the daily and weekly reviews, and `lib/domain/insights.ts` (up to
three suggestions, each with one action).

## Cross-cutting

- **Errors:** `instrumentation.ts` logs one scrubbed JSON line per server
  error: route, error class, Postgres code and digest. Never message, stack
  or content (ADR-010).
- **Secrets:** server-only environment variables; CI builds with sentinel
  values and fails if any reaches client output (ADR-009).
- **Headers:** CSP, HSTS, frame denial and related headers in production
  (`next.config.ts`).
- **Time:** dates are interpreted in the user's timezone, stored as UTC.

## Decisions

| ADR | Decision |
|---|---|
| 000 | PRD v2 is the source of truth |
| 001 | Next.js + Postgres + Drizzle |
| 002 | Transactional email via Resend or SES |
| 003 | Better Auth, email/password + magic link |
| 004 | RLS on a transaction-local user id |
| 005 | Repository boundary |
| 006–007, 011 | Server-side Claude with heuristic fallback |
| 008 | Testing strategy |
| 009 | Environments and secrets |
| 010 | Observability without personal data |
| 012 | Supabase for database hosting |
