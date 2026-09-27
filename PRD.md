# TaskMaster — Implementation Plan Summary

> This file exists so automated tooling that fetches `PRD.md` from the repo
> root has a single place to find the current implementation plan. It does
> **not** replace or override the project's real source of truth:
>
> - Product scope, priorities, acceptance criteria: [`docs/PRD_v2.md`](docs/PRD_v2.md)
> - Full phased build plan, effort, and cost model: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
> - Architecture decision records: [`docs/adr/`](docs/adr/)
>
> Where this file and the documents above ever disagree, the documents above
> win. This file only restates facts already decided there.

---

## Implementation plan — phases and what each produces

| Phase | Produces |
|---|---|
| 0 — Foundations & spec reconciliation | A buildable repo and a locked scope |
| 1 — Design system | Design tokens, styled primitives, and a design preview (`design.html`) |
| 2 — Architecture decisions & scaffold | ADRs, a running app shell, CI |
| 3 — Data model, migrations & security | Schema in Postgres, row-level security proven |
| 4 — Domain engine & test harness | Pure planning logic with passing tests |
| 5 — Capture: Brain Dump → review → commit | Messy text becomes structured, reviewable work |
| 6 — Decide: plan, prioritise, Next Best Action | A daily plan and a recommended next action with a reason |
| 7 — Execute: focus, complete, recover | The capture-to-completion loop closes end to end |
| 8 — Accounts, cloud persistence, cross-device | Real sign-up/sign-in and data that persists across devices |
| 9 — Projects, goals, recurring responsibilities | Structure beyond a single day |
| 10 — Reality Check, reviews, insights | Overload detection and weekly/daily review |
| 11 — Hardening: accessibility, performance, security, E2E | A release candidate |
| 12 — Deploy, document, hand over | A live URL and a maintainable repo |

Full detail, effort estimates, and exit criteria per phase: `docs/IMPLEMENTATION_PLAN.md` §4.

## App framework & database

- **App framework:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4
- **Database:** PostgreSQL 17, via Drizzle ORM

**Both the application and the database run locally for the current
milestone.** `npm run dev` serves the app on `localhost`; Postgres is
installed locally via Homebrew (no Docker). No cloud services, no accounts,
nothing deployed yet.

## Accounts & file storage

- **Authentication tool:** none is wired up in the current milestone. This
  is a single local page with no sign-up/sign-in flow yet — there's only one
  local user. The production choice is already decided in advance:
  **Better Auth**, self-hosted, with a Drizzle adapter. `user_id` columns
  are created on every user-scoped table now so adding real auth in Phase 8
  needs no data migration later.
- **File storage:** not needed, and none is chosen. TaskMaster's data model
  (User, Task, Project, Goal, Plan, PlanItem, BrainDump — see
  `docs/PRD_v2.md` §1.10) has no attachment or file entity, and no phase in
  the roadmap requires file uploads.

## Reviewed choice

**Choice reviewed:** the transactional email provider for account email
(magic links, password resets) — Amazon SES vs. Resend.

**What we decided:** Resend for now, since no AWS account currently exists,
with Amazon SES documented as the preferred switch the moment one does. The
choice sits behind a swappable provider interface either way, so picking one
doesn't touch authentication logic later (`docs/adr/ADR-002-transactional-email.md`).

**Why it suits the product:** it keeps SES's sandbox mode and production-access
approval process off the critical path before the core Brain Dump → Plan →
Focus loop has even shipped, while leaving the cheaper, higher-deliverability
option available later without a rewrite.
