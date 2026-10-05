# TaskMaster Documentation Index

## Authoritative document

> **[`PRD_v2.md`](PRD_v2.md) is the single source of truth.**

Scope, feature priorities, architecture and acceptance criteria are taken from
v2.0 only. Where any other document disagrees, v2.0 wins.

The architecture in v2.0 §1.8–§1.9 is settled: **cloud-based responsive web
application**, authenticated accounts, relational cloud database, cross-device
persistence, server-side AI calls. There is no local-only, browser-storage or
account-free variant in scope.

## First build milestone — single local page (superseded)

> **Superseded (2026-10-05):** accounts, Supabase hosting and a deploy
> pipeline are now built. See `ARCHITECTURE.md` and `OPERATIONS.md`. Kept
> for history.

> **The app and the database both run locally, for now.** `npm run dev` on
> `localhost`, PostgreSQL on `localhost`. No cloud services, no accounts, no
> deployment. The only permitted outbound call is an optional AI provider
> request, and the app works fully without it.

| Concern | Choice | Detail |
|---|---|---|
| **Framework** | **Next.js 16, App Router** | + React 19, TypeScript `strict`, Tailwind CSS v4. One page at `/`; `/api/extract` and `/api/breakdown` as AI proxies so no provider key reaches the browser |
| **Database** | **PostgreSQL 17, local** | Installed via Homebrew, **not** Docker. Drizzle ORM, drizzle-kit migrations committed as SQL. `user_id` nullable on every user-scoped table, defaulted to a seeded local user |
| **Authentication** | **None in this milestone** | A single local page has one user. `user_id` columns are created now so authentication needs no data migration later. Production choice: **Better Auth** (Drizzle adapter, self-hosted) |
| **File storage** | **None** | The v2 §1.10 data model has no attachment or media entity, and no phase requires uploads. Not built rather than scaffolded empty |

Full reasoning, alternatives and revisit triggers:
[`adr/ADR-001-prototype-stack.md`](adr/ADR-001-prototype-stack.md).

**This milestone does not revise the target architecture.** ADR-000 still
governs: the finished product is cloud-based, authenticated, and
cross-device. A local prototype is milestone one, not the destination.

## Documents

**Start here:** [`../README.md`](../README.md) (run it locally),
[`ARCHITECTURE.md`](ARCHITECTURE.md), [`OPERATIONS.md`](OPERATIONS.md) (deploy,
rollback, rotation, monitoring), [`HARDENING.md`](HARDENING.md) (accessibility,
security, performance evidence).

**Database-hosting update (2026-10-04):** Supabase database hosting is now
approved, with the app still running locally and authentication deferred.
[Setup guide](SUPABASE.md) and [ADR-012](adr/ADR-012-supabase-database-hosting.md)
update the earlier local-database-only milestone described above.

| Document | Status | Purpose |
|---|---|---|
| [`PRD_v2.md`](PRD_v2.md) | **Authoritative** (v2.2) | Product scope, P0/P1/P2 priorities, data model, NFRs, per-phase acceptance criteria |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Active | 13-phase build plan, architecture decision summary, effort and cost model |
| [`adr/`](adr/) | Active | Architecture decision records |
| [`archive/PRD_v1.md`](archive/PRD_v1.md) | **Superseded** | v1 product vision and feature catalogue. History only — do not build from it |

## Architecture decision records

| ADR | Subject | Status |
|---|---|---|
| [ADR-000](adr/ADR-000-scope-and-source-of-truth.md) | Scope and source of truth | Accepted |
| [ADR-001](adr/ADR-001-prototype-stack.md) | Prototype technology stack and local-first execution | Accepted |
| [ADR-002](adr/ADR-002-transactional-email.md) | Transactional email provider | Accepted |

### Current standing decisions

| # | Decision |
|---|---|
| D1–D3, D8 | v2.0 is the authoritative spec; build the cloud architecture; keep storage behind a repository interface; the immediate milestone is a single local page |
| D4–D6 | Domain logic is pure and framework-free; design system precedes architecture using portable CSS tokens |
| D7 | PRD v1 archived, not deleted |
| D9–D12 | Transactional email sits behind a provider interface; **Amazon SES where an AWS account exists, otherwise Resend**; sending email is not email integration; no email is wired up in the current milestone |
| D13 | **Anthropic Claude** is the production AI platform, via the native SDK with prompt caching and tool-use structured extraction. Prioritisation, planning, capacity and Reality Check stay deterministic. Recorded in PRD §2.7.2 |

## Why v1 was archived

PRD v1 and PRD v2.0 gave **directly contradictory architecture instructions**.
v1 §23.4 stated a local-only prototype where "a database is **not** required"
and authentication is "not required". v2.0 §2.2 marks user accounts, cloud
persistence and cross-device access as **P0**.

Building to v1 would have failed 4 of v2.0's 22 acceptance criteria immediately.

v1 was not deleted. Its §1–§22 remain a useful record of product thinking, and
most of that substance was carried into v2.0. It was moved to `archive/` and
banner-marked so that nobody — human or AI agent — opens it and builds against
the wrong architecture by mistake.

This is recorded as decision **D1** in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) §1.2
and in [ADR-000](adr/ADR-000-scope-and-source-of-truth.md).
