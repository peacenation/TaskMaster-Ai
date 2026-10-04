# TaskMaster — Implementation Plan

> **Status:** Approved in part. Phases 0–12 estimated; the **immediate milestone
> is narrowed to a single local page** per Product Owner direction (2026-09-27).
> **Date:** 2026-09-27
> **Repo:** `peacenation/TaskMaster-Ai` (branch `main`)
> **Inputs:** `docs/PRD_v2.md` (v2.0 — authoritative),
> `docs/archive/PRD_v1.md` (v1 — superseded, history only)

---

## Immediate milestone — read this first

> **Scope: a single application page. The app and the database both run locally.
> The complete application is not being built now.**

| | |
|---|---|
| **What** | One page at `/`, plus `/api/extract` and `/api/breakdown` as AI proxies |
| **Framework** | Next.js 16 (App Router) + React 19 + TypeScript `strict` + Tailwind CSS v4 |
| **Database** | PostgreSQL 17, **local via Homebrew** (no Docker — not installed on this machine), Drizzle ORM + drizzle-kit |
| **Authentication** | **None.** `user_id` columns created now so auth needs no migration later. Production: Better Auth |
| **File storage** | **None.** No attachment entity exists in v2 §1.10 |
| **AI** | Optional **Anthropic Claude** call via the native SDK, server-side only, tool-use structured extraction + Zod validation, with a local heuristic fallback so the page works with no API key |
| **Running cost** | **$0/month** |

Recorded in [`adr/ADR-001-prototype-stack.md`](adr/ADR-001-prototype-stack.md).

**This does not revise the target architecture.** ADR-000 still governs: the
finished product is cloud-based, authenticated and cross-device. The pages
below describe the full plan; the single local page is the first milestone
within it. The domain engine, extraction pipeline, design system and schema all
carry forward — only auth, cloud persistence and multi-page navigation are
reached later.

---

## 0. How to read this document

Every phase has five fixed fields:

| Field | Meaning |
|---|---|
| **Goal** | The one sentence that, if true, means the phase succeeded |
| **Outputs** | Concrete artefacts that exist when the phase is done — files, ADRs, migrations, passing commands |
| **Exit criteria** | The gate. Nothing starts until this passes |
| **Effort** | Realistic hours, low–high |
| **Cost** | Derived from effort at three rate bands (§10) |

Effort numbers are **estimates made from the PRD only**, against a codebase that
does not yet exist. There is no historical velocity data for this repo, so treat
the low end as "clean execution, no surprises" and the high end as "realistic
including the rework that always happens." See §11 for confidence and what would
move the numbers.

---

## 1. Current state of the repository

```
TaskMasterAi/
├── .git                      # initialised, main tracking origin/main
├── .gitignore                # Node/Next.js ignores
└── docs/
    ├── PRD.md                # v1 — 1,525 lines
    └── PRD_v2.md  # v2.0 — 1,293 lines
```

**There is no application code.** No `package.json`, no framework, no database
schema, no CI, no test runner, no design tokens. Everything in §3 onward is
greenfield.

### 1.1 The two documents are not the same document

This matters because they give **contradictory architecture instructions**, and I
had to pick one to cost the build.

| Question | v1 (`archive/PRD_v1.md`) | v2.0 (`PRD_v2.md`) |
|---|---|---|
| Structure | Flat catalogue of 49 features | 4 delivery phases with P0/P1/P2 |
| Architecture | Local prototype (§23.4) | Cloud web app, auth + cloud DB (§1.8) |
| User accounts | Explicitly *not required* (§23.4) | **P0** (§2.2) |
| Database | "A database is **not** required" (§23.4) | **P0** — "Cloud Persistence" (§2.2) |
| Cross-device | Not mentioned | **P0** (§2.2) |
| Storage | localStorage | Relational cloud DB |
| Acceptance | C1–C11, 11 criteria | 22 checklist items in §2.10, plus per-phase sets |

### 1.2 Decisions I made to reconcile them

These are recommendations, not settled fact. Each is cheap to reverse now and
expensive later, which is why they are written down explicitly.

| # | Decision | Rationale | Reversal cost |
|---|---|---|---|
| **D1** | **v2.0 is the source of truth** for product scope, priorities and acceptance criteria. v1 §23 is treated as historical assessment scope, not a build target. | v2 §7.8 records the restructure as a deliberate decision. v1's own §23 preamble says it "does not replace the product vision." v2 is the later, more considered document. | Low — v1 is retained in `docs/archive/` either way |
| **D1a** | **v1 archived, v2 banner-marked authoritative** — enacted, not proposed. `docs/README.md` indexes the set; ADR-000 records the reasoning. | Two documents with contradictory architecture instructions is a standing source of scope drift, which v2 §6 rates High/High. | Done — reversible by moving the file back |
| **D2** | **Build for v2 Phase 1 in full**, including accounts, cloud persistence and cross-device. | v2 §2.2 marks these P0. Shipping a localStorage prototype would fail 4 of the 22 §2.10 acceptance criteria on day one. | High — retrofitting auth + row-level security onto a client-store app is a rewrite of the data layer |
| **D3** | **Storage sits behind a repository interface** so the domain and UI layers never import a database client directly. | The single highest-leverage hedge available. Preserves the option to run fully local for demos/offline/dev-without-credentials, and would let a future cut fall back to v1 §23 scope without a rewrite. This is the "both, sequenced" answer without paying for two builds. | Already paid for in Phase 2 |
| **D4** | **Domain logic is pure and framework-free** — no React, no DB, no `Date.now()` inside scoring. All time injected. | This is what makes the prioritisation and planning engine testable at all, and it is where the PRD's real logic risk lives (§2.3). Also makes the Vitest suite in Phase 4 cheap. | High — retrofitting purity into impure scoring code is painful |
| **D5** | **Design system ships before architecture is locked** (per your requested ordering), and is therefore built on **framework-agnostic CSS custom properties**. | Honours the requested phase order without a false dependency. Tokens as CSS variables survive any framework choice, so Phase 1 work is not wasted if Phase 2 changes the styling approach. | Low |

### 1.3 Explicitly out of scope for this plan

v2 Phase 3 and Phase 4 (§4, §5): calendar and email integrations, OAuth token
management, commitment review queue, smart notifications, Waiting On,
delegation, billing and subscriptions, usage entitlements, collaboration, native
apps.

These are costed only as a forward estimate in §10.3. Building them now would
contradict v2 §7.7, which says a feature that does not help prove the Phase 1
hypothesis should be P1/P2 or moved later.

---

## 2. Architecture decision summary

Full reasoning lives in the ADRs produced by **Phase 2**. Condensed here so the
plan is readable on its own.

> **Immediate milestone: a single local page, app and database both running on
> `localhost`.** No cloud services, no accounts, no deployment. See
> [`adr/ADR-001-prototype-stack.md`](adr/ADR-001-prototype-stack.md). The target
> architecture below is unchanged — this is milestone one within it, not a
> reversal ([ADR-000](adr/ADR-000-scope-and-source-of-truth.md) D8).

### Named stack for the current milestone

| Concern | Name | Runs |
|---|---|---|
| **Framework** | **Next.js 16 (App Router) + React 19 + TypeScript strict** | `localhost` via `npm run dev` |
| **Database** | **PostgreSQL 17** (Homebrew, **no Docker**) + **Drizzle ORM** + drizzle-kit | `localhost:5432` |
| **Authentication** | **None in this milestone.** Production: **Better Auth** (Drizzle adapter) | — |
| **File storage** | **None.** No attachment entity exists in v2 §1.10 | — |
| Styling | Tailwind CSS v4 + CSS custom-property tokens | — |
| AI | **Anthropic Claude**, native SDK, **server-side only**, tool-use structured extraction + Zod validation, prompt caching on the stable prefix | Optional outbound call |
| AI fallback | Local heuristic extractor, always present | Fully local |

### Target architecture (unchanged by the milestone)

| Concern | Choice | Alternatives rejected | Why |
|---|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript** | Separate SPA + API server | One deployable, one language, server routes for AI proxy so no provider key reaches the browser (§1.9) |
| Language | **TypeScript, strict** | JavaScript | The AI boundary and the scoring engine both need compile-time guarantees |
| Styling | **Tailwind CSS + CSS custom-property tokens** | CSS Modules, vanilla-extract, component library | Utility classes keep the design system (§Phase 1) enforceable in code; tokens stay portable |
| Database | **PostgreSQL** — managed provider in production, Homebrew locally | PlanetScale, Neon, Firebase | v2 §1.10 is explicitly relational (`userId` foreign keys, `Plan`→`PlanItem`) |
| ORM + migrations | **Drizzle ORM + drizzle-kit** | Prisma, raw SQL | Migrations are plain SQL files in version control as §2.7 requires; light runtime; pairs with Postgres row-level security |
| Row security | **Postgres RLS keyed on the session user** | Application-only filtering | §1.11 makes per-user isolation a security requirement. Enforcing it in the database means a bug in app code cannot leak another user's tasks. Deferred with auth (ADR-001 §3); `user_id` columns are created from the first migration regardless |
| Auth | **Better Auth**, self-hosted, Drizzle adapter | Auth.js v5, Clerk, Supabase Auth | §1.11 rates data exposure **Critical**. Not hand-rolling auth is the single biggest security win available. Better Auth preferred for a first-class Drizzle adapter and no external identity provider; revisit at Phase 8 |
| AI provider | **Anthropic Claude** via native SDK | OpenAI, Gemini, Bedrock, local Llama | Chosen for prompt caching on this product's repeated-context extraction workload, faithful handling of ambiguous unorganised input, and the plain-English explanation requirement (§2.3/§2.6/§3.2). See PRD §2.7.2. Native SDK over a compatibility layer so caching and tool use stay available |
| AI validation | **Zod schema at the boundary** | Trust the model | §2.7: "The raw AI response must not directly mutate stored user data without validation." Top risk in the PRD risk table |
| AI fallback | **Local heuristic extractor, always present** | Hard dependency on the model | §2.7 requires the app to be usable and recoverable when AI fails; also the cheapest insurance against vendor outage |
| Unit tests | **Vitest** | Jest | Native TS/ESM, fast, minimal config |
| E2E tests | **Playwright** | Cypress | Parallel, good mobile-viewport emulation for the §1.11 responsive requirement |
| Observability | **Sentry** | Console logs | §1.9 requires application error observability; §2.7 requires not leaking private task content, so PII scrubbing must be configured. Deferred with deployment |
| Hosting | **Vercel** | Self-hosted | Lowest ops overhead; keeps the team on product rather than infrastructure. Deferred with deployment |

> **Version caveat:** exact framework versions and APIs must be verified at
> scaffold time. This plan deliberately avoids asserting version-specific API
> behaviour. Next.js in particular has had breaking changes between major
> versions; read the installed version's own docs rather than relying on prior
> knowledge.

---

## 3. Phase roadmap at a glance

Ordered. Each phase's exit gate is the next phase's entry condition.

```
Phase 0  Foundations & spec reconciliation      →  a buildable repo and a locked scope
Phase 1  Design system                          →  tokens + primitives + living styleguide
Phase 2  Architecture decisions & scaffold      →  ADRs, running app shell, CI
Phase 3  Data model, migrations & security      →  schema in Postgres, RLS proven
Phase 4  Domain engine & test harness           →  pure planning logic, green tests
Phase 5  Capture: Brain Dump → review → commit  →  messy text becomes structured work
Phase 6  Decide: plan, prioritise, NBA          →  "what should I do next, and why"
Phase 7  Execute: focus, complete, recover      →  the loop closes
Phase 8  Accounts, cloud persistence, devices  →  v2 P0 account criteria met
Phase 9  Projects, goals, responsibilities      →  structure beyond today
Phase 10 Reality Check, reviews, insights       →  overload and reflection handled
Phase 11 Hardening: a11y, perf, security, E2E   →  release candidate
Phase 12 Deploy, document, hand over            →  live URL and a maintainable repo
```

Phases 0–2 are preconditions for feature work. Phases 5–7 are the critical path
to the product hypothesis. Phase 8 is what makes the build compliant with v2.
Phases 9–10 are v2 Phase 2 scope, included here because the Reality Check is
load-bearing for the §1.11 realistic-planning requirement.

---

## 4. Phase detail

### Phase 0 — Foundations & spec reconciliation

**Goal:** The team agrees on what is being built, from what document, and the
repository can be built and verified by anyone.

| | |
|---|---|
| **Effort** | **6–10 h** |
| **Depends on** | — |

**Work**

1. Review both PRDs and record the D1–D5 decisions from §1.2 in an ADR (ADR-000).
2. Convert v2 §2.2 into a traceable requirement list; give every P0 item a
   stable ID (`CAP-01`, `PLAN-03`, `ACC-02`…). Every later phase cites these IDs
   so scope drift is visible in review.
3. Map the 22 items of v2 §2.10 acceptance criteria to the phase that will
   satisfy them, and flag the four that need explicit proof rather than
   assertion.
4. Add `README.md`, `CONTRIBUTING.md`, `AGENTS.md` (repo conventions for AI
   coding tools — the project will be worked on by agents as well as humans).
5. Add `.env.example` documenting every variable the build will need, with
   placeholder values only.
6. Branch protection intent and a commit convention recorded in `CONTRIBUTING.md`.
7. Confirm `.gitignore` covers what the chosen stack will generate.

**Outputs**

- `docs/ADR-000-scope-and-source-of-truth.md`
- `docs/REQUIREMENTS.md` — v2 §2.2 as an ID'd, phase-mapped checklist
- `README.md`, `CONTRIBUTING.md`, `AGENTS.md`
- `.env.example`

**Exit criteria**

- D1–D5 each have a named owner who has agreed to them
- Every v2 §2.2 P0 item appears exactly once in `docs/REQUIREMENTS.md` with a
  target phase
- Every §2.10 acceptance criterion is mapped to a phase
- A second person can read `docs/REQUIREMENTS.md` and state the build scope
  without reading either PRD

**Cost:** $300 – $1,500

---

### Phase 1 — Design system

**Goal:** A documented, coded design system exists, is enforced in code, and is
demonstrated in a living styleguide page — before any feature UI is built.

This phase is first by request and is also correct: v2 §2.8 requires the visual
direction to be finalised *during design* rather than invented per screen, and
retrofitting tokens across a built UI is one of the most expensive refactors in
front-end work.

| | |
|---|---|
| **Effort** | **16–24 h** |
| **Depends on** | Phase 0 |
| **PRD ref** | v2 §2.8, §2.4 |

**Work**

1. **Design tokens as CSS custom properties** in `globals.css`, under
   `@layer tokens`. Three tiers, deliberately separable:
   - *Primitive* — raw scales (`--color-green-500`, `--space-4`, `--radius-md`)
   - *Semantic* — intent (`--surface-page`, `--text-muted`,
     `--action-primary`, `--danger-subtle`, `--ai-suggestion`)
   - *Component* — only where a primitive pair is genuinely reusable
   Semantic tokens are what let a theme change without touching components.
2. **Colour.** v2 §2.8 requires "accessible contrast" and "AI recommendations
   visually distinguishable from confirmed user decisions." That second
   requirement is a real design constraint, not decoration: AI-suggested state
   needs its own token pair, checked against WCAG 2.1 AA (§1.11) in both light
   and dark.
3. **Typography scale**, mobile-first, with a readable measure for long-form task
   titles.
4. **Spacing, radii, elevation, motion.** One motion token set, respecting
   `prefers-reduced-motion`.
5. **Primitives** — the v2 §2.8 component list, minus the feature components
   that belong to later phases:
   `Button`, `Input`, `Textarea`, `Select`, `Modal`, `Badge`, `Card`,
   `Toast`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `Field`, `Chip`.
   Focus-visible rings, keyboard operability and touch-target size (≥44px,
   §2.8) are part of "done" for each, not a later pass.
6. **Living styleguide** at `/design` — every token and primitive rendered with
   its name and value, light/dark toggle, and the AI-vs-confirmed state
   comparison side by side. This doubles as design review artefact and as
   visual-regression test surface in Phase 11.
7. **Contrast + token audit** recorded in the styleguide page.

**Outputs**

- `src/app/globals.css` — full token set
- `src/components/ui/*` — primitives
- `src/app/design/page.tsx` — living styleguide
- `docs/DESIGN_SYSTEM.md` — token reference and usage rules

**Exit criteria**

- No hard-coded colour, spacing or radius value in any primitive
- Every primitive keyboard-operable with a visible focus ring
- Text contrast ≥ 4.5:1, large text and UI boundaries ≥ 3:1, verified and recorded
- `/design` renders every token and primitive
- Design review signed off before Phase 5 begins

**Cost:** $800 – $3,600

---

### Phase 2 — Architecture decisions & application scaffold

**Goal:** Every significant architectural choice is written down with its
alternatives and consequences, and a running application shell exists with CI
green.

| | |
|---|---|
| **Effort** | **14–20 h** |
| **Depends on** | Phase 1 |
| **PRD ref** | v2 §1.8, §1.9, §2.7 |

**Work**

1. **Write the ADRs** behind §2. Each records context, decision, alternatives
   with why they lost, and consequences:

   | ADR | Subject |
   |---|---|
   | ADR-001 | Framework and rendering model |
   | ADR-002 | Data store and ORM (Postgres + Drizzle) |
   | ADR-003 | Authentication and session handling |
   | ADR-004 | Per-user data isolation (RLS) |
   | ADR-005 | Repository/persistence boundary (decision D3) |
   | ADR-006 | AI integration: provider, structured output, validation |
   | ADR-007 | AI failure and fallback policy |
   | ADR-008 | Testing strategy and pyramid |
   | ADR-009 | Deployment, environments, secrets |
   | ADR-010 | Observability and PII handling |

2. **Scaffold** the application: framework, TypeScript strict, Tailwind wired to
   the Phase 1 tokens, ESLint, Prettier, path aliases.
3. **App shell** — responsive layout, the v2 §2.5 navigation (Today, Inbox,
   Projects, Focus, More/Settings), mobile and desktop breakpoints. Shell only;
   no feature screens.
4. **Repository interface** (D3) — the seam that keeps the domain and UI layers
   free of the database. Define it now, implement the Postgres adapter in
   Phase 3, and a local/in-memory adapter for dev and tests.
5. **CI** — install, typecheck, lint, unit test, build. Fails on any red.
6. **Environment management** — typed env access, validated at boot, server-only
   for secrets, with a hard runtime guard that no provider key can be imported
   into a client bundle.

**Outputs**

- `docs/adr/ADR-001` … `ADR-010`
- Running app shell at `/`, responsive, navigating
- CI pipeline green on a fresh clone
- `src/lib/repo/*` — persistence interface + in-memory adapter

**Exit criteria**

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass
  from a clean checkout
- App shell renders and navigates at 375px and 1440px
- A build artefact grep confirms no AI provider key in any client chunk
- Every ADR reviewed and accepted; each has a "revisit if" trigger

**Cost:** $700 – $3,000

---

### Phase 3 — Data model, migrations & row-level security

**Goal:** The v2 §1.10 data model exists in Postgres, is reproducible from
migrations in the repository, and it is *proven* that one user cannot read
another's data.

| | |
|---|---|
| **Effort** | **12–18 h** |
| **Depends on** | Phase 2 |
| **PRD ref** | v2 §1.10, §1.11, §2.7 |

**Work**

1. Translate v2 §1.10 into Drizzle schema, adding what the PRD implies but does
   not name:
   - `TaskEvent` (status history) — §3.3 requires event records; cheaper to
     start collecting in Phase 3 than backfill later
   - `TaskDependency` — §2.3 lists dependencies as a scoring signal
   - `RecurrenceRule` — §3.1 P0 recurring responsibilities
   - `BrainDump.proposalJson` — §2.7 review-before-commit needs the raw proposal
     retained so a failed save never loses the user's original text (§1.11
     Recoverability)
2. Migrations with `drizzle-kit`, all SQL committed. A second database
   reconstructable from the repository alone.
3. **RLS policies on every user-scoped table**, keyed on `auth.uid()`. Every
   insert, select, update and delete.
4. **Postgres adapter** implementing the Phase 2 repository interface.
5. **Seed script** with realistic sample data spanning several users, so
   isolation bugs surface immediately rather than in production.
6. Indexes for the queries the app actually makes: open tasks by user, tasks by
   project, tasks by due date, plan items by plan.

**Outputs**

- `src/lib/db/schema.ts`
- `migrations/*.sql` — committed, ordered
- `src/lib/repo/postgres.ts` — adapter
- `src/lib/db/seed.ts`
- `docs/ERD.md`

**Exit criteria**

- `migrate` from empty database reproduces the schema exactly
- **Isolation test passes:** authenticated as user A, every query against user
  B's rows returns nothing — for each table, each operation
- Seed runs against a local database with multiple users and no cross-user reads
- No table holding user data lacks an RLS policy (verified by inspection, and by
  a test that enumerates tables)

**Cost:** $600 – $2,700

---

### Phase 4 — Domain engine & test harness

**Goal:** The decision logic that defines the product — date understanding,
extraction, prioritisation, planning, next-best-action — exists as pure,
dependency-free, well-tested TypeScript.

This is the highest-risk phase per unit of hours and the one worth spending
time on. Every wrong recommendation erodes the trust v2 §1.5 and §6 are built
around, and the PRD's own risk table rates "AI gives poor priorities" as
Medium likelihood / High impact.

| | |
|---|---|
| **Effort** | **24–36 h** |
| **Depends on** | Phase 3 |
| **PRD ref** | v2 §2.3, §2.6, §7.4, §7.5 |

**Work**

1. **Test harness** — Vitest configured, coverage thresholds set, a `Clock`
   abstraction so every test controls "now". Per D4 no module calls `Date.now()`
   directly.
2. **`dates.ts` — deadline parser.** Natural language → date + confidence:
   explicit dates, "tomorrow", "next Tuesday", "by Friday", "end of month",
   "in two weeks", times ("Friday morning", "2pm"). Returns a confidence value so
   low-confidence dates are *proposed* rather than asserted (§2.6: expose
   uncertainty instead of pretending certainty). Ambiguity resolved against the
   user's timezone from preferences.
3. **`extract.ts` — heuristic extractor.** The zero-dependency path. Splits messy
   text, classifies each fragment as task / project / goal / note / idea /
   recurring, extracts deadlines and cadence ("3× a week"), strips filler.
   Output schema must be **byte-identical** to the AI path's schema — the UI must
   never branch on which engine produced a proposal.
4. **`prioritize.ts` — scoring engine.** The v2 §2.3 signals: user priority,
   urgency, importance, deadline proximity, overdue, dependencies, estimated
   duration, available time, project relevance, goal relevance. Two hard
   requirements:
   - It returns a **`reasons[]` array with every score** (§1.11 Explainability).
     Retrofitting explanations into a scoring function after the fact is the
     expensive way round.
   - It applies the anti-crowding rule from v2 §7.5 item 8: urgent work must not
     permanently displace important long-term work. Implemented as an explicit,
     visible mechanism, not an emergent side effect.
5. **`plan.ts` — daily planner.** Flexible mode (priority-ordered, no time
   boxes) and scheduled mode (realistic time blocks, buffer, never fills every
   available minute). Capacity calculation comparing planned minutes against
   stated availability.
6. **`nextBestAction.ts`** — the recommendation, with a short plain-English
   reason in the shape §2.3 gives: *"Work on the client proposal next. It is due
   tomorrow, is marked important, and two other tasks depend on it."*
7. **`breakdown.ts`** — decompose a large or vague task into steps.
8. **Golden test fixtures** from the PRD's own worked example (§1.1 / the
   quarterly-report scenario) and from v2's acceptance wording. The PRD
   containing executable examples is an asset; use them as the contract.

**Outputs**

- `src/lib/domain/{dates,extract,prioritize,plan,nextBestAction,breakdown}.ts`
- `src/lib/domain/*.test.ts`
- `src/lib/domain/__fixtures__/` — PRD-derived golden cases
- `docs/SCORING.md` — the scoring model in prose, so it can be reviewed and tuned
  without reading code

**Exit criteria**

- No domain module imports React, a database client, or reads ambient time
- Every branch of `dates.ts` and `prioritize.ts` covered; overall domain
  coverage ≥ 85%
- The PRD worked example parses to the expected structure, including the
  deadline and the implied project grouping
- The 20-minute / low-energy case produces a *different* recommendation than the
  unconstrained case — the PRD's stated behaviour
- `docs/SCORING.md` reviewed by someone who did not write the code

**Cost:** $1,200 – $5,400

---

### Phase 5 — Capture: Brain Dump → review → commit

**Goal:** A user pastes unstructured text and ends up with structured,
editable, confirmed work — the fastest route to the product's core value.

| | |
|---|---|
| **Effort** | **20–30 h** |
| **Depends on** | Phase 4 (and Phase 1 for UI) |
| **PRD ref** | v2 §2.2 Capture & Organisation, §2.4 Flow 1, §2.7 |

**Work**

1. **Brain Dump composer** — large free-text area, the v2 §1.7 opening prompt,
   paste-friendly, no formatting to fight. Persist the raw text to
   `BrainDump` *before* processing, so a failed or crashed AI call can never lose
   the user's words (§1.11 Recoverability — a named acceptance criterion in
   §2.10).
2. **`POST /api/extract`** — server-side AI proxy. Model configured by env.
   Requests **structured output** against a JSON schema rather than parsing prose
   (§2.7). Validate the response with **Zod** before it reaches any state.
   Provider key never leaves the server.
3. **Fallback orchestration** — try AI; on absence, timeout, error, rate limit or
   schema-validation failure, fall back to `extract.ts` and proceed. The user
   sees the same review screen either way, and is told which engine ran, because
   quality differs and §2.6 forbids pretending to certainty.
4. **Extraction review screen** — the heart of the "AI recommends, user decides"
   principle. Grouped proposals (tasks / projects / goals / deadlines / notes).
   Each row individually editable — title, date, project, importance — and
   individually removable. Low-confidence dates visibly marked as suggestions.
   Reordering. Nothing is written to the user's task list until they commit.
5. **Commit** — one transaction. On failure, the review state is preserved and
   the raw dump is still available.
6. **Quick Add** — single-item natural-language entry, e.g. *"Call John tomorrow
   at 2pm"*. Parse, show the interpretation, let the user correct or save
   immediately (§2.4 Flow 2).
7. **Manual task creation and editing** — a proper form, because §2.2 keeps it
   P0 and not every user wants to type at the app.
8. **Inbox** — universal destination; capture without deciding where it belongs.
   A queue of unprocessed items with a batch "organise these" path.
9. **Project grouping suggestions** — cluster by keyword and inferred context;
   user can rename, merge, split, or reject.

**Outputs**

- `src/app/api/extract/route.ts`
- `src/app/(app)/dump/` — composer
- `src/app/(app)/review/` — extraction review
- `src/app/(app)/inbox/`
- `src/app/(app)/tasks/[id]/` — manual create/edit
- `src/lib/ai/{client,schema,prompts}.ts`
- Structured-output contract shared by the AI and heuristic paths

**Exit criteria**

- A PRD worked example dumps to individually editable items, not one blob
- `dateutil`-style relative dates resolve correctly against a fixed clock
- **Killing the network mid-request preserves the raw dump and offers the
  heuristic path** — verified by test, not by inspection
- A malformed model response is rejected by Zod and falls back; it never reaches
  the database
- Nothing appears in the user's tasks without explicit commit
- Editing and removing any proposed item works and persists

**Cost:** $1,000 – $4,500

---

### Phase 6 — Decide: plan, prioritise, Next Best Action

**Goal:** Today answers *"what matters, what first, what can wait, what is
realistic"* and *"what should I do next, and why."*

| | |
|---|---|
| **Effort** | **20–30 h** |
| **Depends on** | Phase 5 |
| **PRD ref** | v2 §2.2 Dates/Priorities/Planning, §2.3, §2.4 Flow 3 |

**Work**

1. **Today screen** built on the Phase 4 engine. Four explicit answers
   (§2.2 Daily Plan): what matters today, what is first, what can wait, what is
   realistic. One obvious primary action (§2.8).
2. **Next Best Action card** — prominent, with the short reason always visible
   (not hidden behind a click) and an expandable fuller explanation. This is the
   product's signature element; it gets design attention, not just engineering.
3. **Priority display and override** — ranking shown with its signals, and the
   user can override any recommendation. Overrides persist and are *never*
   overwritten by a later recompute (§7.5 item 5). Show that an override is in
   effect, so the user is not confused by a ranking that disagrees with them.
4. **Plan mode toggle** — flexible vs scheduled (§2.2). Scheduled view places
   work in estimated blocks with buffer; it does not fill every minute.
5. **Available-time input** — "I have 20 minutes" filters to work that fits.
6. **Capacity status** — planned effort against available time, with a plain
   statement of the gap. Warning only at this stage; intervention is Phase 10.
7. **Task row / card component** — deadline, priority, project, estimate. The
   most-repeated element in the product, so it gets the most design iteration.
8. **Explain-my-plan** — every recommendation and every plan movement carries a
   short human-readable reason (§1.11 Explainability).

**Outputs**

- `src/app/(app)/today/`
- `src/components/NextBestAction.tsx`
- `src/components/TaskRow.tsx`
- `src/components/PlanView.tsx` — both modes
- `src/components/CapacityMeter.tsx`

**Exit criteria**

- A reasonable seeded dataset produces a defensible top recommendation with a
  correct, specific reason
- 20-minute / low-energy input changes the recommendation, as the PRD specifies
- User override of a priority survives a page reload *and* a plan rebuild
- Both plan modes render from the same data with no client-side re-planning
- Scheduled mode never produces back-to-back blocks with zero gap
- Keyboard-only user can reach and act on the Next Best Action

**Cost:** $1,000 – $4,500

---

### Phase 7 — Execute: focus, complete, recover

**Goal:** The loop closes. A user can start the recommended action, finish it,
and when the day goes sideways, decide what happens rather than watching the app
rearrange everything silently.

| | |
|---|---|
| **Effort** | **16–24 h** |
| **Depends on** | Phase 6 |
| **PRD ref** | v2 §2.2 Execution, §2.4 Flow 4, §2.4 Flow 5 |

**Work**

1. **Focus Mode** — one task, essential context, minimal distraction. Wider
   backlog out of the way unless requested (§2.4). Optional timer. Complete /
   postpone / drop. Deliberately simple: this is a surface where added controls
   defeat the purpose.
2. **Complete** — updates progress, removes the task from the open plan, updates
   counters, and promotes the next recommendation. §2.10 requires plan and
   progress to visibly change.
3. **Postpone** — moves work without deleting it (§2.2 P0). Records the event
   with a timestamp; that history is what Phase 10's patterns need.
4. **Task Breakdown** — the v2 §2.2 P1 item, reachable from a task, *not* from
   inside Focus Mode. Produces child tasks after review.
5. **Recovery Check-In** — when planned work is missed, ask what should happen
   to affected items: **Keep / Postpone / Drop**, per item, then rebuild. Never
   silently reschedule (v2 §7.5 item 1, §2.4 Flow 5). Surface affected items
   as a decision, not a fait accompli.
6. **Task event log** — every status transition written with timestamp, feeding
   the Phase 4 store and Phase 10 analysis.
7. **Optimistic updates with honest failure** — the UI responds instantly; if the
   write fails, say so and offer retry rather than losing the user's completion.

**Outputs**

- `src/app/(app)/focus/`
- `src/components/BreakdownModal.tsx`
- `src/components/RecoveryCheckIn.tsx`
- `src/lib/repo/events.ts`
- Focus Mode stays dependency-light by design

**Exit criteria**

- Full loop runs end to end: dump → plan → focus → complete → plan updates
- Completing a task visibly removes it from the open plan and updates counts
- Missing planned work opens a Recovery decision, never a silent reschedule
- Nothing is ever deleted without an explicit user action
- Focus Mode usable on a 375px viewport with no horizontal scroll
- The 20-min focus timer survives a page refresh

**Cost:** $800 – $3,600

---

### Phase 8 — Accounts, cloud persistence, cross-device

**Goal:** v2's account-related P0 criteria are met: sign up, sign in, sign out,
data persists in the cloud, and the same account works on phone and laptop.

| | |
|---|---|
| **Effort** | **20–30 h** |
| **Depends on** | Phase 3, Phase 5 |
| **PRD ref** | v2 §1.8, §1.9, §1.11, §2.2 Account & Core Product |

> This phase is where decision **D2** is paid for. It is placed after the core
> loop so that the product hypothesis is provable before the account work
> starts — but it is not optional. Four §2.10 acceptance criteria depend on it.

**Work**

1. **Auth screens** — sign up, sign in, sign out, password reset, magic link.
   Copy written to v2's tone: plain, no growth-hack framing.
2. **Session handling** — cookie-based sessions, route protection via
   middleware, redirect to sign-in from any protected route, no auth state
   flicker on load.
3. **Onboarding gate** — a first-time user is routed to the Brain Dump, never to
   an empty dashboard (§1.7). Existing users go to Today.
4. **Preferences** — timezone (critical for the Phase 4 date parser), available
   hours, default plan mode, notification baseline.
5. **Repository wiring** — swap the local adapter for the Postgres adapter
   behind the Phase 2 interface. Because D3 was honoured, this is
   configuration and adapter work, not a rewrite. **This is the moment D3 pays
   for itself; if Phase 5 was built against a database client directly, this
   phase becomes the expensive one.**
6. **Data export** — full JSON export of the user's own data (§1.9).
7. **Account and data deletion** — a real deletion, not a flag. Confirmation
   required, with the consequence stated plainly. §2.10 requires it.
8. **Cross-device verification** — sign in on a second browser profile, confirm
   tasks, plan and progress are present and current.

**Outputs**

- `src/app/(auth)/{signin,signup,reset}/`
- `src/middleware.ts`
- `src/app/(app)/settings/`
- Export and delete endpoints, both auth-protected
- Postman/curl-verified proof that unauthenticated requests cannot read data

**Exit criteria**

- Sign up → brain dump → plan → sign out → sign in on a second device → data
  present
- Unauthenticated request to any data endpoint returns unauthorized
- A signed-in user cannot read, write or delete another user's rows
- Account deletion removes the data, verifiable by direct database query
- Session survives reload; sign-out genuinely invalidates it
- Timezone preference changes deadline interpretation for the same input

**Cost:** $1,000 – $4,500

---

### Phase 9 — Projects, goals, recurring responsibilities

**Goal:** Work is structured beyond today, and repeating obligations stop
crowding the ordinary list.

| | |
|---|---|
| **Effort** | **18–26 h** |
| **Depends on** | Phase 8 |
| **PRD ref** | v2 §3.1 Goals & Responsibilities |

**Work**

1. **Projects** — list and detail, grouped tasks, outcome statement, progress
   derived from tasks.
2. **Goals** — CRUD, longer-horizon outcomes, and linkage from tasks and
   projects. Goal relevance is already a Phase 4 scoring input, so linkage has
   immediate effect on prioritisation rather than being decorative.
3. **Goal breakdown** — goals into milestones, projects and actions (§3.1 P1).
4. **Goal alignment** — surface when daily work is not moving an important goal
   (§3.1 P1). A single well-placed observation, not a dashboard.
5. **Recurring responsibilities** — cadence rules, generation of future
   instances, and a *separate surface* so they never inflate the ordinary task
   list (§3.1 P0). Rides on the `RecurrenceRule` and `TaskEvent` tables from
   Phase 3.
6. **Responsibility areas** — Work / Family / Home / Finance / Personal
   Development, for grouping and for later attention-distribution analysis.

**Outputs**

- `src/app/(app)/projects/`
- `src/app/(app)/goals/`
- Recurrence engine + separate recurring-responsibility view
- Goal-alignment observation component

**Exit criteria**

- A goal can be created, linked to a task, and that link changes the task's
  score
- Recurring items generate future instances on schedule and never appear as
  duplicated clutter in the daily plan
- Removing a recurrence rule stops future generation and leaves history intact
- A task can belong to a project and a goal simultaneously and renders correctly

**Cost:** $900 – $3,900

---

### Phase 10 — Reality Check, reviews, first insights

**Goal:** When the plan does not fit, TaskMaster says so plainly and offers
choices; and the user can review what happened.

| | |
|---|---|
| **Effort** | **16–24 h** |
| **Depends on** | Phase 6, Phase 9 |
| **PRD ref** | v2 §3.1 Realistic Planning, §3.2, §7.4 |

**Work**

1. **Advanced capacity awareness** (§3.1 P0) — compare planned effort against
   realistically available time, using Phase 8 preferences and Phase 9
   responsibilities.
2. **Reality Check** (§3.1 P0) — state the mismatch in the PRD's own register:
   *"You have about 9 hours of planned work and roughly 5 hours available.
   Something needs to move. I recommend postponing the garage task and reducing
   the scope of the presentation review. You decide."* Then offer
   **Postpone / Simplify / Delegate / Drop**, each with its trade-off stated.
   §7.4 requires the trade-off to be exposed; §7.5 item 6 requires the user to
   confirm. The AI may never apply a reduction itself.
3. **Procrastination Assist** (§3.1 P1) — detect repeated postponement from the
   Phase 7 event log, then ask one short question about the blocker and offer
   the interventions: break it down, clarify the next action, reduce scope,
   change timing, reconsider priority, remove.
4. **Daily Review** (§3.1 P1) — completed / missed / changed / carried forward.
   Must stay genuinely quick; if it feels like admin, it has failed its own
   principle.
5. **Weekly Review** (§3.1 P1) — goal progress, neglected priorities, upcoming
   deadlines, postponed work, and confirmation of next week's priorities.
6. **First insights** — two or three patterns, each phrased as a suggestion with
   a next action. Explicitly not statistics, per §3.1 P2 and v2's §1.5 warning
   against administration.

**Outputs**

- `src/components/RealityCheck.tsx`
- `src/components/ProcrastinationAssist.tsx`
- `src/app/(app)/reviews/{daily,weekly}/`
- `src/lib/insights/`

**Exit criteria**

- Overloaded day triggers Reality Check with a specific, correct arithmetic
  statement
- Every suggested reduction names its trade-off and requires confirmation
- No reduction is ever applied automatically — verified by test
- Three consecutive postponements of one task trigger Procrastination Assist
- Daily Review completable in under two minutes
- Every insight is a recommendation, not a bare metric

**Cost:** $800 – $3,600

---

### Phase 11 — Hardening: accessibility, performance, security, E2E

**Goal:** The build meets the non-functional requirements in v2 §1.11, and the
§2.10 acceptance criteria are proven by automated tests rather than asserted.

| | |
|---|---|
| **Effort** | **20–30 h** |
| **Depends on** | Phase 5–10 |
| **PRD ref** | v2 §1.11, §2.7, §2.10 |

**Work**

1. **Playwright E2E suite** mapping the 22 §2.10 acceptance criteria to tests,
   one per criterion, named so a failure points at the requirement it breaks.
2. **Accessibility audit to WCAG 2.1 AA** (§1.11) — automated pass plus manual
   keyboard and screen-reader pass on the core flows. Automated tooling finds
   perhaps a third of real issues; the manual pass is not optional.
3. **Performance** — §1.11 requires navigation and task interaction to feel
   immediate. Measure and fix: bundle budget, list virtualisation for large task
   sets, image handling, server/client split for each route, AI latency with
   visible processing state rather than a spinner that lies.
4. **Security review** — the PRD rates data exposure as Low/Medium likelihood
   and **Critical** impact. Verify: RLS on every table, no secrets in client
   bundles, auth on every route and API handler, input validation at all
   boundaries, rate limiting on AI endpoints, no task content in logs or error
   reports (§2.7), CSV/JSON export injection, and dependency audit.
5. **Error and empty states** — every screen has a real failure state and a real
   empty state. §2.8 lists both as required components.
6. **Visual regression** on `/design` and the core screens, catching unintended
   design-system drift.
7. **Load sanity check** — a user with 500+ tasks still gets a usable Today.

**Outputs**

- `e2e/*.spec.ts` — one per §2.10 criterion
- Accessibility report
- Security review checklist, signed
- Performance budget + measured report
- Error-monitoring configured with content scrubbing

**Exit criteria**

- All 22 §2.10 criteria pass as automated tests, each traceable to its line in
  the PRD
- No WCAG 2.1 AA violations in the core flows
- A security review with no open Critical or High findings
- Interaction latency within the agreed budget on a throttled connection
- `typecheck`, `lint`, `test`, `e2e`, `build` all green in CI

**Cost:** $1,000 – $4,500

---

### Phase 12 — Deploy, document, hand over

**Goal:** A live URL, a repository a new developer can pick up, and a
maintenance path that does not depend on this plan.

| | |
|---|---|
| **Effort** | **10–16 h** |
| **Depends on** | Phase 11 |
| **PRD ref** | v2 §1.9, §2.7 |

**Work**

1. **Environments** — development, preview per pull request, production.
   Promotion path documented and rehearsed.
2. **Secret management** — all credentials in the host's secret store, rotated
   once, with a documented rotation procedure. Nothing in the repository.
3. **Database migrations in the deploy path** — applied automatically on
   production deploy, with a tested rollback.
4. **Monitoring** — error tracking, uptime check, and an alert that reaches a
   human. An alert nobody receives is not monitoring.
5. **Documentation** — `README.md` (run, deploy, architecture), `docs/ARCHITECTURE.md`,
   `docs/SCORING.md` (from Phase 4), `docs/OPERATIONS.md` (deploy, rollback,
   rotate, restore).
6. **Custom domain and TLS**, and confirmation that the v2 §1.11 privacy
   disclosures are present and accurate about AI processing.
7. **Seed a demo account** for reviewers, with a realistic dataset, since v2
   §2.9 measures time-to-first-value and a demo path is how that gets evaluated.

**Outputs**

- Production URL on a custom domain
- Preview deployments per pull request
- `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`
- Verified migration and rollback path
- Demo account

**Exit criteria**

- A new developer can clone, install, and run locally from the README alone
- Deploy, rollback and secret rotation each performed and documented
- No production secret in the repository — verified by scanning history
- Monitoring alerts verified by triggering one deliberately
- A rollback rehearsal completes within the documented window

**Cost:** $500 – $2,400

---

## 5. Effort summary

| Phase | Name | Low (h) | High (h) | Share |
|---|---|---:|---:|---:|
| 0 | Foundations & spec reconciliation | 6 | 10 | 3% |
| 1 | Design system | 16 | 24 | 7% |
| 2 | Architecture decisions & scaffold | 14 | 20 | 7% |
| 3 | Data model, migrations & RLS | 12 | 18 | 6% |
| 4 | Domain engine & test harness | 24 | 36 | 11% |
| 5 | Capture: Brain Dump → commit | 20 | 30 | 9% |
| 6 | Decide: plan, prioritise, NBA | 20 | 30 | 9% |
| 7 | Execute: focus, complete, recover | 16 | 24 | 8% |
| 8 | Accounts, cloud, cross-device | 20 | 30 | 9% |
| 9 | Projects, goals, responsibilities | 18 | 26 | 8% |
| 10 | Reality Check, reviews, insights | 16 | 24 | 8% |
| 11 | Hardening: a11y, perf, security, E2E | 20 | 30 | 9% |
| 12 | Deploy, document, hand over | 10 | 16 | 5% |
| | **Total** | **212** | **318** | **100%** |

### 5.1 Where the hours actually go

Worth being explicit, because it is not where people expect:

| Layer | Phases | Hours (mid) | % |
|---|---|---:|---:|
| Decisions, design, scaffold | 0–2 | 45 | 17% |
| Data & security foundation | 3 | 15 | 6% |
| Domain logic + tests | 4 | 30 | 11% |
| Feature build (capture → insights) | 5–10 | 137 | 52% |
| Hardening & release | 11–12 | 38 | 14% |

**Roughly half the build is feature work, and about a third is everything that
makes the feature work trustworthy and releasable.** Budgets that fund only the
middle column produce a demo, not a product.

### 5.2 Calendar time

| Engagement | Calendar duration |
|---|---|
| One full-time engineer | 11–17 weeks |
| Two engineers (some parallelism) | 7–11 weeks |
| Fractional (~15 h/week) | 14–22 weeks |

Feature phases (5–10) are largely parallelisable across two people, since the
capture, plan and execute surfaces touch different files. Phases 0–4 and 11–12
benefit much less from a second pair of hands.

---

## 6. Critical path

If something slips, this is the order things will bunch up behind.

```
Phase 0 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
                                        ↓
                              (product hypothesis provable here)
                                        ↓
                              Phase 8 → Phase 11 → Phase 12
```

**Phase 4 is the schedule risk.** Everything user-visible depends on the
scoring and planning engine, it is the phase where the PRD's real algorithmic
uncertainty lives, and it cannot be meaningfully parallelised because the
interfaces are still moving. If it overruns, cut from Phases 9 and 10 — not
from 1, 2 or 4.

---

## 7. Scope tiers

Three defensible stopping points. Costs are mid-range at $85/h.

### Tier A — Core loop only (recommended first milestone)

Phases 0–8. Proves the v2 §7.7 hypothesis: messy workload in, trustworthy plan
and a confident next action out.

- **148–222 h · ~$12,600–$18,900 at $85/h**
- Satisfies **all 22** of the §2.10 acceptance criteria
- Omits the v2 Phase 2 scope: goals, recurring responsibilities, Reality Check,
  reviews, insights. Legitimately deferrable — §3.1 marks most of it P1, and
  §7.7 says a feature that does not help prove the Phase 1 hypothesis should
  move later

**This is the right stopping point for a first release.** It is a complete,
coherent, fully account-backed product, and it defers only what the PRD itself
classifies as Phase 2.

### Tier B — v2 Phase 1 + Phase 2 planning

Phases 0–10. Everything above, plus the intelligent-planning layer: overload
handled explicitly, goals, repeating obligations, reviews, first insights.

- **182–272 h · ~$15,500–$23,100 at $85/h**
- Adds the P0 items of v2 §3.1 (advanced capacity awareness, Reality Check,
  Keep/Postpone/Drop, Goals, Recurring Responsibilities) and the P1 review and
  procrastination-assist features

### Tier C — Full plan

Phases 0–12, including hardening and release done properly: WCAG 2.1 AA audit,
security review, performance budget, E2E coverage of all 22 acceptance criteria,
production deploy with rehearsed rollback and secret rotation.

- **212–318 h · ~$18,000–$27,000 at $85/h**
- The difference between Tier B and Tier C is ~30–46 h, and it is the difference
  between "it works" and "it is releasable and maintainable"

### 7.1 If the budget is constrained

Cut in this order. Each cut removes capability without breaking the core loop.

| Order | Cut | Saves | Consequence |
|---|---|---|---|
| 1 | Phase 10 reviews + insights | 16–24 h | No weekly reflection. Deferrable — §3.1 marks them P1 |
| 2 | Phase 9 goals + recurring | 18–26 h | Flat task/project model. Loses goal scoring signal |
| 3 | Phase 1 styleguide page (keep tokens + primitives) | 4–6 h | Loses a design-review artefact, not capability |
| 4 | Phase 6 scheduled plan mode | 4–6 h | Flexible mode only. Still a valid plan |

**Do not cut:** Phase 1 tokens (retrofit cost is severe), Phase 2 repository
interface (D3 — protects every later phase), Phase 4 tests (this is where the
product's correctness lives), Phase 3 RLS (security, and a §2.10 criterion),
Phase 8 (four §2.10 criteria).

---

## 8. Cost model

### 8.1 Build cost by tier

| Tier | Hours | @ $50 | @ $85 | @ $150 |
|---|---:|---:|---:|---:|
| **A — Core loop** | 148–222 | $7,400 – $11,100 | $12,580 – $18,870 | $22,200 – $33,300 |
| **B — + intelligent planning** | 182–272 | $9,100 – $13,600 | $15,470 – $23,120 | $27,300 – $40,800 |
| **C — Full plan** | 212–318 | $10,600 – $15,900 | $18,020 – $27,030 | $31,800 – $47,700 |

Rate bands:

- **$50/h** — junior developer, or offshore. Competent on well-specified work;
  Phases 4, 6 and 11 will need tighter review.
- **$85/h** — mid-level. The realistic default for a build of this shape.
- **$150/h** — senior or a consultancy. Worth it for Phases 1, 2 and 4
  specifically; the design system and the domain engine are the two places where
  seniority pays back.

**Mixed-skill note:** a realistic team is one senior for Phases 0–4 and 11–12
(88 h) and one mid-level for Phases 5–10 (137 h). At $150 and $85 respectively
that is ~$24,900 for the mid-range estimate, against ~$22,500 at a flat $85/h —
so seniority on the foundation and the domain engine costs roughly 10% more and
is worth it.

### 8.2 Cost by phase at $85/h

| Phase | Hours | Cost @ $85/h |
|---|---:|---:|
| 0 | 6–10 | $510 – $850 |
| 1 | 16–24 | $1,360 – $2,040 |
| 2 | 14–20 | $1,190 – $1,700 |
| 3 | 12–18 | $1,020 – $1,530 |
| 4 | 24–36 | $2,040 – $3,060 |
| 5 | 20–30 | $1,700 – $2,550 |
| 6 | 20–30 | $1,700 – $2,550 |
| 7 | 16–24 | $1,360 – $2,040 |
| 8 | 20–30 | $1,700 – $2,550 |
| 9 | 18–26 | $1,530 – $2,210 |
| 10 | 16–24 | $1,360 – $2,040 |
| 11 | 20–30 | $1,700 – $2,550 |
| 12 | 10–16 | $850 – $1,360 |
| **Total** | **212–318** | **$18,020 – $27,030** |

### 8.3 Running cost per month

| Item | Free tier | Paid | Notes |
|---|---:|---:|---|
| Vercel | $0 | $20/mo | **Not incurred in the current milestone** — nothing is deployed. Applies at Phase 12 |
| Managed Postgres (production) | $0 | $25/mo | **Not incurred in the current milestone** — Postgres runs locally via Homebrew at $0. Free tiers commonly pause after ~1 week of inactivity, unsuitable for a real demo |
| Sentry | $0 | $26/mo | **Not incurred in the current milestone** — applies at Phase 12 |
| Domain | — | ~$1/mo | ~$12/year |
| Email (auth magic links) | — | $0–20/mo | Free tier covers early usage |
| **Subtotal** | **$0** | **~$72/mo** | ~$860/year. **Current local milestone: $0/month all-in.** |

**Deliberately excluded** from the build: the AI provider, below.

### 8.4 AI cost — the number that actually scales

Using a small model with structured output, a representative brain dump:

| Item | Value |
|---|---|
| Input per brain dump | ~400 tokens (~300 words) |
| Output (structured proposal) | ~800 tokens |
| Blended cost per brain dump | **~$0.0005** |
| Per active user/month (10 dumps) | **~$0.005** |
| 1,000 active users | **~$5/mo** |
| 10,000 active users | **~$50/mo** |

**AI is not the cost centre people expect.** The drivers are instead:

- **Retry and validation overhead** — malformed responses retried, larger
  prompts with few-shot examples. Budget 2–3× the raw estimate initially.
- **Longer-horizon planning** (v2 Phase 2) — whole-week plans cost
  proportionally more context per call.
- **Email/calendar extraction** (v2 Phase 3) — volume-driven by inbox size, and
  the first feature where AI cost can genuinely surprise. Model routing and
  caching become necessary there, not before.

**Recommendation:** instrument token spend per feature from day one, with a
per-user budget alert. The PRD risk table rates "AI costs grow too quickly" as
Medium/High; it becomes a real risk only if it is unmeasured.

---

## 9. Risk register

The PRD has its own risk table (§6). These are the risks **to this build
plan**, which is a different list.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | AI extraction quality is the product's credibility; a poor first brain dump loses the user permanently | High | Critical | Review-before-commit is non-negotiable; heuristic fallback always available; measure the AI correction rate that v2 §2.9 already names |
| R2 | Phase 4 scoring engine underperforms and the product's central claim fails | Medium | Critical | Purity (D4) plus golden tests from the PRD's own examples; `docs/SCORING.md` reviewable by a non-coder; budget the most senior person here |
| R3 | Scope expansion — v2 §6 already rates this High/High | High | High | D1 fixes the source of truth; `docs/REQUIREMENTS.md` maps every feature to a phase; §7.1 of this plan names the cut order in advance |
| R4 | Auth/RLS defects leak user data | Low | **Critical** | RLS in the database, not the app; Phase 3 isolation test; Phase 11 security review; Phase 8 unauthenticated-access check |
| R5 | Phase 8 retrofit costs more than estimated because a phase leaked the DB client | Medium | High | D3 repository interface, enforced in Phase 2 code review |
| R6 | Design system drift as feature phases add one-off styles | Medium | Medium | Semantic tokens only; no hard-coded values; visual regression in Phase 11 |
| R7 | Estimates are wrong because there is no codebase to measure against | **High** | Medium | Ranges not points; §11 states what would tighten them; Phase 0 re-estimates after the scaffold |
| R8 | Key-person dependency — one developer holds all context | Medium | High | ADRs and `docs/SCORING.md` written for readers, not authors; Phase 12 handover gate |
| R9 | Provider lock-in or outage in the AI layer | Low | Medium | AI client behind a provider interface; heuristic fallback is a complete path, not a stub; PRD §2.7.2 requires validating structured extraction against the PRD's own worked examples before the pipeline is built on it |
| R10 | "Realistic planning" reads as nagging rather than help | Medium | Medium | v2 §1.5 and §7.3 both warn against administration; Reality Check must offer a choice, never a lecture |

---

## 10. Verification: how we know it worked

The plan is not done when the code is written. v2 §2.10 lists 22 acceptance
criteria; each maps to a phase and must end as a **passing automated test with
the criterion ID in the test name** (Phase 11).

Selected mappings:

| §2.10 criterion | Phase | Proof |
|---|---|---|
| Brain Dump produces separate proposed tasks, not one blob | 5 | E2E: dump fixture → N distinct items |
| User can review and edit extracted items before saving | 5 | E2E: edit, remove, confirm order; DB unchanged pre-commit |
| Explicit deadlines can be detected and corrected | 5 | Unit: relative-date suite; E2E: correction persists |
| Failed AI processing does not lose the original Brain Dump | 5 | Integration: abort mid-request; raw text recoverable |
| Next Best Action includes a short explanation | 6 | Snapshot: reason is non-empty and cites a real signal |
| User can override a recommended priority | 6 | E2E: override survives reload *and* plan rebuild |
| Completion updates the plan and progress | 7 | E2E: counts and plan both change |
| User can create an account and sign in/out | 8 | E2E: full auth cycle |
| User data persists securely across sessions | 8 | E2E + Phase 3 isolation test |
| Same account works on mobile and desktop | 8 | Playwright at 375px and 1440px |
| User can delete their account/data | 8 | E2E + direct database verification |
| Core flows usable on mobile and desktop | 11 | Playwright viewports, no horizontal scroll |
| Plan detects effort exceeding capacity | 10 | Unit: known fixture produces a correct Reality Check |

---

## 11. Confidence and what would tighten these numbers

**Confidence: moderate, and lower than I would like.** Stated plainly:

- The PRD is unusually detailed, with worked examples and explicit acceptance
  criteria. That genuinely helps — it is why the domain engine can be specified
  before it is built.
- There is **no code, no history, and no team**. Every number here is derived
  from the PRD plus general experience with this class of application. It is
  not derived from this project.
- Estimates assume a developer who already knows the stack. Onboarding a
  developer to Next.js + Drizzle + Postgres + Tailwind v4 would add real hours.
- Phases 1, 2 and 3 are the most predictable — conventional work with clear
  references. Phase 4 is the least predictable. Phase 11 is the most likely to
  surface surprises, because that is when other people's requirements meet the
  build.

**What would tighten this within one week:**

1. Approve D1–D5. This is the single largest lever — D2 and D3 alone swing the
   build by roughly 60 hours and ~$5,000.
2. Pick the tier from §7.
3. Build Phase 0 and Phase 2 only, then re-estimate Phases 3–12 against a real
   scaffold. A scaffold turns most of this document from estimate into
   measurement, and it costs ~20 hours to find out.

I would recommend doing exactly that rather than committing to the full 212–318
hours up front. Commit to Phase 0–2; re-estimate after.

---

## 12. Immediate next actions

1. **Review D1–D5** in §1.2. Five decisions; each is cheap now and expensive to
   reverse.
2. **Choose a tier** from §7.
3. **Confirm the rate basis** in §8.1, or confirm that hours are the unit you
   want.
4. **Approve or amend this plan**, then begin Phase 0.

### Completed since this plan was written

| Action | Outcome |
|---|---|
| **v1 archived** | `docs/PRD.md` → `docs/archive/PRD_v1.md`, banner-marked superseded with the conflict table |
| **v2 made authoritative** | `docs/PRD_v2.md` banner-marked as the single source of truth, including its §1.8–§1.9 architecture |
| **Document set indexed** | `docs/README.md` states which document wins and why |
| **Reasoning recorded** | `docs/adr/ADR-000-scope-and-source-of-truth.md` — context, decision D1–D7, consequences, alternatives, revisit triggers |
| **D1a recorded** in §1.2 | The archival is enacted, not merely proposed |

The open question from the original §12 is closed. What remains is items 1–4
above, and the first Phase 0 output that matters most:
`docs/REQUIREMENTS.md`, mapping every v2.0 §2.2 P0 item and every §2.10
acceptance criterion to a build phase.

### Progress checkpoint — initial working page (2026-09-27)

**Phase reached:** a slice of **Phase 1** (design tokens, ported from the
`/design.html` preview per PRD_v2.md §2.8.1) plus a UI-only slice of
**Phases 5–7** (Capture → Review → Plan → Focus) — deliberately taken out of
strict phase order to satisfy an assignment checkpoint that asks for *"an
initial/single working app page,"* explicitly without sign-in, database, or
deployment. `npm run dev` serves one page at `/` implementing:

- Brain Dump capture → a local heuristic split (line/sentence breaks) stands
  in for the real AI extraction call
- Review-before-commit (approve/remove proposed items)
- Build My Plan → Next Best Action card, visually distinct from confirmed
  work per the §2.8 requirement
- Complete / Postpone / Focus Mode
- Quick Add straight into the backlog

**Deliberately not done yet**, and still gating later phases:

- **Phase 2** — no ADRs beyond ADR-001/ADR-002, no CI, no real app shell
  decisions recorded for this code
- **Phase 3** — no Postgres, no Drizzle schema/migrations, no row-level
  security; nothing persists past a page refresh
- **Phase 4** — no pure/testable domain engine; extraction and
  Next-Best-Action ordering are inline heuristics in `page.tsx`, not a
  separable, tested module
- **Phase 5–7 (real versions)** — no server-side AI call, no Zod validation
  boundary (§2.7), no persistence of the plan/backlog

**Next in the roadmap:** Phase 2 (lock the ADRs, add CI), then Phase 3
(Postgres + Drizzle locally, per the current milestone's named stack in
"Named stack for the current milestone" above), then Phase 4 to pull the
heuristic extraction and Next-Best-Action ordering out of `page.tsx` into a
pure, tested domain module before any AI call or database write is wired in.

### Progress checkpoint — Phase 1 completed (2026-09-28)

Phase 1's own Outputs and Exit criteria (above) are now met in code, not
just in the static `design.html` preview:

- `app/globals.css` — full primitive/semantic token set, including a
  second, separate dark-mode primitive scale (`--color-coal-*` neutrals,
  `--color-sand-*` text) rather than a naive inversion of the light values
- `components/ui/*` — coded primitives: `Button`, `Input`, `Textarea`,
  `Select`, `Field`, `Card` (`default`/`ai`/`confirmed`), `Badge`, `Chip`,
  `EmptyState`, `Skeleton`, `Modal`, `ConfirmDialog`, `Toast`. `app/page.tsx`
  was refactored to import these instead of raw `className="btn"` strings,
  so Phase 1 is now the thing feature code actually depends on, not a
  parallel preview
- `app/design/page.tsx` — the living styleguide, with a System/Light/Dark
  toggle and every token/primitive rendered live
- `docs/DESIGN_SYSTEM.md` — token reference and usage rules
- A **live** contrast audit on `/design` (DOM-probes the resolved CSS
  custom properties via `lib/contrast.ts`, not a hardcoded table), which
  caught and fixed two real failures: `--color-sage-600` (success text)
  was under the 4.5:1 text minimum, and `--border-strong` (the border on
  every `Input`/`Textarea`/`Button variant="secondary"`) was under the
  3:1 non-text UI-boundary minimum in **both** themes. Both are corrected
  at the token level — see `docs/DESIGN_SYSTEM.md` for the before/after
  values.

Not carried into this pass, and not blocking Phase 2: a full modal focus
trap (`Modal`/`ConfirmDialog` currently do Escape + backdrop-click +
initial focus only) and a global `Toast` queue/provider (the component is
presentational only). Both are explicitly deferred to Phase 11
(hardening) rather than built ahead of a feature that needs them.

### Progress checkpoint — Phase 2 completed (2026-09-28)

Phase 2's Outputs and Exit criteria are met:

- **ADR-003 through ADR-010** written (`docs/adr/`), covering every topic
  Phase 2's own table lists beyond what ADR-001/002 already settled:
  authentication, row-level security, the repository boundary, AI
  integration, AI fallback policy, testing strategy, deployment/
  environments/secrets, and observability/PII. Each has alternatives
  considered, consequences, and a "revisit if" trigger.
- **Repository interface + in-memory adapter** (D3/ADR-005) —
  `lib/repo/task-repository.ts` (interface) and
  `lib/repo/in-memory-task-repository.ts` (adapter), with a passing unit
  test. Not yet wired into `app/page.tsx`'s React state — that's Phase 4/5
  wiring, once a real domain engine exists to sit behind it. Phase 2's own
  Outputs only ask for the interface + in-memory adapter to exist.
- **App shell** — `components/shell/NavBar.tsx` renders the PRD §2.5 nav
  (Today, Inbox, Projects, Focus, More) responsively, wired into
  `app/layout.tsx`. Today (`/`) has the real Phase 5-7 prototype content;
  Inbox/Projects/Focus/More are placeholder stubs — shell only, per this
  phase's own scope, not feature screens.
- **CI** — `.github/workflows/ci.yml` runs typecheck, lint, format check,
  unit tests, build, and the client-bundle secret grep on every push/PR.
- **Testing strategy in code, not just in the ADR** — Vitest installed;
  `lib/extract.ts` (the heuristic extractor, moved out of `app/page.tsx`
  so it's a pure, tested module per D4) and `lib/contrast.ts` both have
  unit tests, alongside the repository test above. 24 tests passing.
- **Environment management** — `.env.example` documents every server-only
  variable name; none are read by any code yet (`DATABASE_URL` arrives
  Phase 3, an AI provider key Phase 5/6). `npm run check:client-bundle`
  greps the built client bundle for those names and is wired into CI —
  currently vacuous (nothing to leak yet) but running from today, not
  added under pressure once a real secret exists.
- **Prettier** — added and applied across all source files (`.md` files
  are intentionally excluded; they're hand-formatted prose, not code).

**Deliberately not done**, and not blocking Phase 3:

- The Postgres/Drizzle adapter implementing `TaskRepository` — that's
  Phase 3
- Component-level or E2E test tooling (Testing Library, Playwright) — per
  ADR-008, added when a feature first needs them, not ahead of that need
- A real AI Route Handler — ADR-006/007 fix the shape it will take; no
  code calls out to a provider yet

**Next in the roadmap:** Phase 3 — data model, migrations, and row-level
security in Postgres, per ADR-004's decision and the schema in
`docs/PRD_v2.md` §1.10.

### Progress checkpoint — Phase 3 completed (2026-10-04)

Phase 3's Outputs and Exit criteria are met, and — unusually for this
log — one of them was proven the hard way: the first version of the
isolation test and the first version of `scripts/db-bootstrap.sh` both
had real bugs that would have shipped a false sense of security if not
caught. Specifics below.

- **Schema** — `lib/db/schema.ts`: the v2 §1.10 entities, plus
  `task_events`, `task_dependencies`, `recurrence_rules`, and
  `brain_dumps.proposal_json`, which Phase 3's own work item 1 calls for
  because the PRD implies them without naming them. `user_id` is
  denormalized onto every table, including children that could instead
  join to a parent — a deliberate RLS-auditability tradeoff, written up
  in `docs/ERD.md`.
- **Migrations** — `migrations/0000_initial_schema.sql` (generated from
  the schema) and `migrations/0001_row_level_security.sql` (hand-written:
  the `app_current_user_id()` helper, `ENABLE`/`FORCE ROW LEVEL SECURITY`,
  and one policy per table). Proven reproducible **literally**, not just
  assumed: `dropdb taskmaster_dev`, re-ran `db:bootstrap` + `db:migrate`
  + `db:seed` + `db:test` against the fully recreated database, all green.
- **RLS mechanism is a session GUC, not Supabase's `auth.uid()`** — this
  project is self-hosted Postgres (ADR-001), not Supabase, so that
  function doesn't exist here. See ADR-004's Phase 3 implementation note.
- **The default local Postgres role is a superuser** (`rolsuper = true,
  rolbypassrls = true`, checked directly, not assumed) — it ignores every
  RLS policy regardless of `FORCE`. `scripts/db-bootstrap.sh` creates a
  second, non-superuser `taskmaster_app` role; the application and every
  isolation-sensitive test connect as that role, never the admin one.
  Skipping this step would have made the isolation test pass for the
  wrong reason — it's the single most important decision in this phase.
- **Postgres adapter** — `lib/repo/postgres-task-repository.ts`,
  implementing the Phase 2 `TaskRepository` interface via a
  per-user-session factory (`get`/`update`/`remove` don't take a `userId`
  in that interface, but every RLS-scoped query needs one — see ADR-005's
  Phase 3 note for why a factory, not an interface change). Not yet wired
  into `app/page.tsx` — same reasoning as Phase 2's in-memory adapter.
- **Seed script** — `lib/db/seed.ts`, two users with realistic data across
  every table, with an inline isolation spot-check that fails loudly if
  one user's data is visible under another's session.
- **Isolation test** — `lib/db/isolation.test.ts`: enumerates every table
  with an ownership column and asserts RLS is enabled, forced, and
  policied (so a future table added without RLS fails immediately), then
  proves — per table, per operation — that user A gets zero rows
  selecting/updating/deleting user B's data and is rejected inserting on
  user B's behalf. **The first version of this test had a bug that made
  it pass without proving anything**: it matched rows by the fixture's
  own primary key instead of by the ownership column's value, so two of
  its six checks were comparing the wrong things entirely. Caught by
  actually reading the failure output rather than the pass/fail count.
- **Contract test** — `lib/repo/postgres-task-repository.test.ts`, the
  same scenarios as the Phase 2 in-memory suite, run against the real
  adapter (ADR-005's Verification checklist asked for this explicitly).
- A second real bug: running the isolation test and the contract test in
  the same `vitest run` let Vitest execute the two files **concurrently**
  against the same live database — one file's `TRUNCATE` wiped out the
  other's fixtures mid-run, failing two unrelated-looking tests for a
  third, infrastructural reason. Fixed with `fileParallelism: false` in
  `vitest.config.db.mts`, which only applies to the DB-backed tests —
  `vitest.config.mts`'s ordinary unit tests stay parallel.
- **`npm run db:test`** is intentionally separate from `npm run test`:
  the latter is what CI runs and must never require a database that
  doesn't exist there; the former needs `scripts/db-bootstrap.sh` run
  first and is a manual/local step for now (see "Deliberately not done").
- `docs/ERD.md` — the two departures from the PRD's literal field list,
  the RLS mechanism, and the denormalization rationale, written up for a
  reader who only has the schema file otherwise.

**Deliberately not done**, and not blocking Phase 4:

- **Postgres is not wired into CI.** `npm run db:test` needs a real local
  database (`scripts/db-bootstrap.sh`'s trust-auth, peer-based setup);
  GitHub Actions' Postgres service containers use password auth against a
  `postgres` superuser by default, which would need its own bootstrap
  path rather than reusing the laptop-oriented script as-is. Not
  required by this milestone (ADR-009: no deployment yet) — tracked as a
  gap, not silently skipped.
- `app/page.tsx` still runs on local React state, not the Postgres
  repository — Phase 4's domain engine is what that wiring is for.
- No `Project`/`Goal`/`Plan` repository — only `TaskRepository` exists,
  matching ADR-005's "start with tasks" scope.

**Next in the roadmap:** Phase 4 — domain engine & test harness: pull the
heuristic extraction and Next-Best-Action ordering out of `app/page.tsx`
into a pure, tested module built against `TaskRepository`, per D4 and
ADR-005.

### Progress checkpoint — Phase 4 completed (2026-10-04)

`lib/domain/` — `dates`, `extract`, `prioritize`, `plan`,
`nextBestAction`, `breakdown`, plus `clock` (injected "now") and
`proposal` (the Zod contract both extraction engines must emit). 178 unit
tests; domain coverage **100% lines/branches/functions**, enforced at ≥85%
in CI (`npm run test:coverage`). No domain module imports React, a
database client, or reads ambient time — the only `new Date()` is
`systemClock` itself, the one sanctioned boundary.

The PRD's worked example (archived v1 §20 — the clearest executable
statement of the product's intent) is the golden contract in
`lib/domain/golden.test.ts`: the run-on Brain Dump splits into the
expected seven items with the right kinds, deadlines, and life-area
grouping; the report breaks down into the PRD's four steps; the
unconstrained next action is the report; and with 20 minutes and low
energy it's the dentist, with the report explicitly named as displaced.

Two calibration decisions surfaced by working the golden numbers, both
written up in `docs/SCORING.md`:
- Deadline buckets use **calendar days in the user's timezone**, not
  elapsed hours (Thursday 5pm from Monday 9am is "due on Thursday").
- Anti-crowding is **two mechanisms**: a deliberately modest neglect
  nudge in scoring, and a protected slot in the planner that is the
  actual guarantee — and never displaces work due within 7 days.

**Not met yet:** the exit criterion "`docs/SCORING.md` reviewed by
someone who did not write the code." It is written and flagged as
unreviewed at the top; that review is a human step.

**Not built here, by design:** `extract.ts` is heuristic only; the AI path
that sits on top of it is Phase 5. `lib/extract.ts` (the old line
splitter) still backs `app/page.tsx` until Phase 5 replaces that flow.

### Progress checkpoint — Phase 5 completed (2026-10-04)

**Correction first.** PRD_v2.md §2.7.2 had already chosen **Anthropic
Claude via the native SDK**; ADR-006 (Phase 2) said "OpenAI-compatible"
because that section hadn't been read. ADR-006 is marked superseded and
**ADR-011** records what was built. Where this plan elsewhere says
"OpenAI-compatible", the PRD and ADR-011 win.

Built:
- **Capture flow** — `/dump` composer → `organiseBrainDump`
  (`lib/capture/organise.ts`) saves the raw text **before** requesting
  extraction → `POST /api/extract` (Claude, with heuristic fallback) →
  review → atomic commit. `/review/[id]` resumes any saved, uncommitted
  dump.
- **Claude extraction** (`lib/ai/`) — structured outputs (forced tool use
  400s on the current model; see ADR-011's *Deviation*), a loose model
  schema behind our strict Zod contract, cached stable prompt prefix with
  the PRD example as few-shot, refusal fallbacks enabled, 30 s timeout,
  SDK errors mapped to user-facing fallback reasons.
- **Review screen** — grouped by kind; every row editable and removable;
  low-confidence dates badged *Suggested*; reorder; grouping rename /
  merge / clear; told which engine ran and why.
- **Quick Add** (local live interpretation → Inbox), **manual task
  create/edit/delete** (`/tasks/new`, `/tasks/[id]`), **Inbox** with batch
  "move to my list" and resumable dumps, **Projects** listing all open
  tasks by project, and a real **Today** (Next Best Action + day plan from
  the Phase 4 engine, Complete/Postpone) replacing the local-state
  prototype.
- **Repository evolution** — `TaskRepository` now has the real fields
  (as ADR-005 anticipated); one shared contract suite runs against both
  adapters; `withRepositories` gives every request one RLS-scoped
  transaction. Migrations 0002 (`brain_dumps.committed_at`,
  `recurrence_rules.times_per_period`) and 0003.

Exit criteria, each verified by a test or a browser run:

| Criterion | Evidence |
|---|---|
| PRD example dumps to individually editable items | Golden test + headless-Chrome run of the full flow |
| Relative dates resolve against a fixed clock | `lib/domain/dates.test.ts` |
| Killing the network mid-request preserves the dump and offers the heuristic | `lib/capture/organise.test.ts` — fails before save, after save, and on timeout |
| Malformed model response rejected by Zod, never reaches the DB | `lib/capture/extract-with-fallback.test.ts` — 7 malformed shapes |
| Nothing appears in tasks without explicit commit | `lib/capture/commit.db.test.ts` |
| Editing and removing proposed items works and persists | Commit DB test + browser run (edit, remove, save, re-open) |

Bugs caught while verifying, not after:
- **Postgres `now()` is the transaction's start time**, so every task in
  one commit tied on `created_at` and listed in random order. The shared
  repository contract caught it; migration 0003 uses `clock_timestamp()`.
- **Missing credentials were reported as "AI organising failed"**: the SDK
  throws an untyped `Error` there, not the `AnthropicError` assumed.
  Credentials are now detected before calling (`hasClaudeCredentials`).
- **`lib/db/client.ts` opened pools at import**, which would have crashed
  CI's database-less `next build` once pages imported it. Now lazy;
  verified by building with no `.env.local`.
- **Phone layout** truncated dates and project names on the review screen
  — passed the no-horizontal-scroll check, failed on actually looking.

**Not done / known gaps:**
- **No live Claude call has been made.** The request is verified against
  the SDK's types and every response path is unit-tested with canned
  responses, but §2.7.2's own "validate before building on it" golden run
  needs configured Claude credentials. Until then, only the heuristic path
  is proven end to end.
- **Resolved in Phase 5 closeout:** `npm run db:test` now creates/migrates
  `taskmaster_test`; its destructive fixtures cannot run against the dev DB.
  `db:seed` still resets development data and is an explicit setup command.
- Project *grouping suggestions* are keyword life-areas rather than deeper
  contextual clustering. **Dedicated group splitting is now implemented**
  and verified through explicit commit in the browser.
- Notes aren't saved anywhere but the dump's retained proposal — PRD
  §1.10 has no notes entity.
- Habits are stored as recurrence rules but don't generate tasks yet
  (Phase 9). Focus Mode is a stub until Phase 7.

**Next in the roadmap:** Phase 6 — Today in full: available-time input,
scheduled view, capacity warning, overriding the recommendation.


### Phase 5 closeout and Phase 6 completed (2026-10-04)

**Phase 5 closeout:** added an explicit grouping split action: select the
items, name their new group, then review and commit. A headless Chrome run
verified the new group appears and is persisted on commit. Capture's existing
raw-text recovery, validation/fallback and atomic-commit tests remain green.

Database verification now runs exclusively against **`taskmaster_test`**:
`scripts/db-test.mjs` derives local test URLs, creates the separate database,
applies the migrations, grants the application role access, and starts the
sequential test suite. The Vitest DB configuration rejects direct invocations
without the guarded test URLs. The development database is preserved.

`npm run ai:smoke` exercises the actual Claude extractor with the PRD worked
example and strict validation, without writing application data. It was run
and reported **no configured credentials**. Live model validation therefore
remains pending; it is not claimed as passing. The heuristic path and mocked
AI failure/validation paths are verified. Configure credentials in `.env.local`
and run that command to close the external validation item.

**Phase 6 implementation:**

- Today exposes separate inputs for time available **today**, time available
  **right now**, and current energy. Inputs are validated on the server.
- `lib/planning/today.ts` builds the recommendation, ranking, capacity and one
  scheduled plan. Flexible and scheduled views present the exact same items;
  the client toggle performs no planning. Buffer is 20%, gaps are 10 minutes,
  and unknown estimates are visibly suggested at 30 minutes.
- `components/planning/` contains `NextBestAction`, `TaskRow`, `PlanView` and
  `CapacityMeter`. Short reasons are always visible; detailed score signals
  are expandable. Deadline, estimate, project and user priority appear on rows.
- Explicit priorities are stored on tasks. **Choose next** is stored in the
  user's preferences under RLS, independently of score recomputation. The UI
  labels this choice and offers **Use recommendation** to clear it. Completing,
  postponing or blocking the chosen task makes it ineligible for the next action.
- Capacity shows planned versus available effort and the specific gap when
  work due within 24 hours or overdue exceeds usable time. Deferred tasks show
  their reason; deadline work is never presented as harmless to delay.
- Dependencies on Inbox/postponed tasks remain blocking, even though those
  prerequisites are not candidates for today's plan.

**Exit criteria verified:**

| Criterion | Evidence |
|---|---|
| Defensible top recommendation and specific reason | PRD golden unit test; browser shows the report first |
| 20-minute / low-energy input changes the recommendation | `lib/planning/today.test.ts`; browser selects the dentist |
| Priority override survives reload and rebuild | Fresh-transaction DB test and browser reload/rebuild |
| Both modes share data, no client planning | Single server-built schedule; browser compares ordered titles |
| Scheduled blocks have nonzero gaps | Unit assertions (10 minutes); browser checks rendered gaps |
| Keyboard access and action on Next Best Action | Headless Chrome Tab to Complete, Enter submits, recommendation and plan update |

Verification: **218 unit tests**, **20 database tests**, **100% domain
coverage**, typecheck, lint, formatting, production build and client-bundle
secret check passed. Browser verification also passed at a 375px viewport
with no horizontal overflow; the mobile screenshot was visually reviewed.
All browser mutations used the isolated test database.

**Next:** Phase 7 — Focus Mode, breakdown and recovery check-in. The live Claude
smoke test is the remaining external Phase 5 validation, pending credentials.


### Supabase database hosting connected (2026-10-04)

Per Product Owner direction, database hosting moved to the empty Supabase
project `cpfmxwvaddfixgwujekn`. Authentication remains deferred; the local-user
seam and server-side Drizzle repositories are unchanged. See ADR-012 and
`docs/SUPABASE.md` for setup and rollback.

All migrations applied. The application uses a generated restricted role,
with credentials saved only in `.env.local`. TLS verifies the server using
the downloaded Supabase CA certificate rather than disabling verification.
The hosted read-only schema/RLS check and transactional read/write,
cross-user select/update/delete/insert checks passed; temporary test records
were rolled back. The 20 database tests still run successfully against local
`taskmaster_test`, using preserved local URLs. Local task data was not copied.

---

*Prepared from `docs/PRD_v2.md` and `docs/archive/PRD_v1.md` against an empty
repository. All effort and cost figures are estimates, not commitments.*
