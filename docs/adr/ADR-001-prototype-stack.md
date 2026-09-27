# ADR-001 — Prototype technology stack and local-first execution

- **Status:** Accepted
- **Date:** 2026-09-27
- **Deciders:** Product Owner, AI agent
- **Affects:** the immediate build milestone
- **Related:** [ADR-000](ADR-000-scope-and-source-of-truth.md),
  [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)
- **Supersedes:** nothing

---

## Context

The Product Owner has narrowed the immediate build to a **prototype**: an
initial, single application page that opens locally in a browser. The complete
application is explicitly not required at this stage.

The environment has been checked. Present:

| Tool | Version |
|---|---|
| Node.js | v22.22.2 |
| npm | 11.16.0 |
| Homebrew | 7.0.6 |

**Absent:**

| Tool | Consequence |
|---|---|
| Docker / Docker Desktop | Any "Postgres in a container" plan is not executable today. Installing Docker Desktop is a large, admin-privilege, always-on-daemon change — disproportionate for a single-page prototype |
| PostgreSQL (`psql`, `pg_ctl`) | No database server on the machine yet |
| `pg_ctl` | No way to start a Postgres cluster without installing it |

`IMPLEMENTATION_PLAN.md` §2 assumed managed Postgres via Docker or a hosted
provider. That assumption does not hold on this machine, so this ADR records a
stack that runs locally with what is actually installed, plus one Homebrew
command for the database.

### Machine-local constraint that shapes two of the four answers

The question "name the database, authentication and file storage" contains a
trap. For a single-page local prototype, **two of those four do not need to
exist at all**, and inventing them would be waste dressed up as thoroughness.
This ADR names what is real, and states plainly what is deferred and why.

---

## Decision

### Explicit statement of execution model

> **The application and the database both run locally, for now.**
>
> The app runs on `localhost` via `npm run dev`. The database runs on
> `localhost`. There are no cloud services, no accounts, no external
> infrastructure, and no deployment. The only permitted outbound network call is
> an optional AI provider request, and the app is fully functional without it.

### 1. Framework

| | |
|---|---|
| **Framework** | **Next.js 16 — App Router** |
| **UI** | **React 19** |
| **Language** | **TypeScript, `strict: true`** |
| **Styling** | **Tailwind CSS v4** + CSS custom-property design tokens |
| **Routes** | One page: `/` |
| **Server routes** | `/api/extract`, `/api/breakdown` — AI proxies only |

Chosen over a Vite SPA because the AI provider key must never reach the browser
(PRD v2 §1.9), which needs a server. That requirement does not go away in a
prototype, so the prototype should not pretend it is absent.

*Version caveat:* Next.js has shipped breaking changes between majors. Verify
the installed version's own documentation at scaffold time rather than relying
on prior knowledge.

### 2. Database

| | |
|---|---|
| **Database** | **PostgreSQL 17**, running locally |
| **Install method** | **Homebrew** — `brew install postgresql@17 && brew services start postgresql@17` |
| **Container** | **None.** Docker is not installed and is not required |
| **ORM** | **Drizzle ORM** |
| **Migrations** | **drizzle-kit** — plain SQL committed under `migrations/` |
| **Connection** | Local socket / `localhost:5432`; credentials in `.env.local`, which is gitignored |

**Why Postgres and not SQLite.** Drizzle abstracts the driver, so the ORM call
sites barely change — but the *schema* does. Postgres gives `jsonb` for the
brain-dump proposal payload, real enum types for task status, and row-level
security, which is how the production build will enforce per-user data
isolation. Choosing SQLite now means a schema and migration rewrite later, for
the sake of avoiding one 2-minute Homebrew install.

**Fallback if a database server is unwanted:** `better-sqlite3` with Drizzle's
SQLite driver. Zero install, file-based, starts instantly. Acceptable, but it
diverges from the committed architecture and should be treated as a temporary
dev convenience, not the schema of record.

### 3. Authentication

| | |
|---|---|
| **Prototype** | **None.** No sign-up, no sign-in, no sessions, no auth middleware |
| **Schema** | `user_id` present on every user-scoped table, **nullable**, defaulted to a single seeded local user |
| **Production (later)** | **Better Auth** — self-hosted, Drizzle adapter, sessions in Postgres |

**This is a deliberate omission, not an oversight.** A single local page has
exactly one user: the person looking at it. Adding an auth system to a
prototype demonstrates nothing that the page does not already demonstrate, and
it would consume a meaningful share of a small build for no evidential value.

The one thing that *is* done now is the cheap part of the decision: `user_id`
columns exist from the first migration, defaulted to a seeded local user. When
authentication arrives in the production build, **no data migration is
required** — the columns are already there. The expensive part of auth, which is
the per-user isolation model, is what this defers.

*Alternative considered:* Auth.js (NextAuth) v5. Also sound, and the better-known
choice. Better Auth is preferred here for a first-class Drizzle adapter and
self-hosting that needs no external identity provider. Flagged for verification
at the time auth is actually built — this decision should be revisited then,
not now.

### 4. File storage

| | |
|---|---|
| **Prototype** | **None.** No uploads, no attachments, no object storage |
| **Interface** | Not built yet — do not build a `StorageAdapter` with one implementation |
| **If ever needed** | Local disk `./data/uploads`, behind a `StorageAdapter` interface, S3-compatible later |

**Why nothing.** The v2 §1.10 data model contains no attachment, upload or media
entity. The feature tables in §2.2 and §3.1 never mention file handling. A grep
of the authoritative PRD for *file, upload, attach, media, storage, blob,
image* returns no requirement.

Building a storage abstraction now would be an interface with exactly one
implementation and zero callers — untested code that exists only to look
complete. If attachments are ever a requirement, the interface is cheap to add
at that point, and the schema is not blocked without it.

---

## Consequences

### Positive

- **Runs on this machine today.** Node and npm are present; the database is one
  Homebrew command. No Docker, no admin privileges, no daemon.
- **No throwaway work.** Framework, ORM, and schema all match the production
  architecture, so the prototype is a genuine prefix of the real build rather
  than a rewrite. The `user_id` columns and Drizzle schema carry forward.
- **Honest scope.** Two of the four subsystems are explicitly deferred with
  reasons, instead of being scaffolded to look complete.
- **AI stays optional.** The heuristic extractor in `extract.ts` means the page
  is fully functional with no API key, satisfying the recoverability
  requirement in v2 §1.11.

### Negative / accepted

- **No accounts in the prototype.** Multi-user behaviour, session handling and
  per-user isolation are untested. The Phase 3 isolation test and the
  production auth build remain the first real test of the security model.
- **A local Postgres service must be running** for the app to work. Mitigated by
  the SQLite fallback, at the cost of schema divergence.
- **One page means no navigation.** Routes, shells and responsive layout across
  screens are deferred, so responsive behaviour can only be partially
  demonstrated.

### Neutral

- This does **not** revise [ADR-000](ADR-000-scope-and-source-of-truth.md). The
  v2 cloud architecture remains the target. The prototype is the first milestone
  *within* that plan — see D8 below.

---

## Relationship to ADR-000

ADR-000 makes the v2 cloud architecture authoritative: authenticated accounts,
relational cloud database, cross-device persistence, server-side AI. This ADR
builds a single local page first.

These are consistent. The prototype is **milestone one** of the plan in
[`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md), not a reversal of it.
What the prototype establishes — the domain engine, the extraction pipeline, the
design system, the schema — is the part that carries forward unchanged. What it
defers — auth, cloud persistence, multi-page navigation — is exactly the work
that comes later regardless.

**The prototype must not become the product by default.** If the prototype's
local-only, account-free shape is mistaken for the finished architecture, the
result is the outcome ADR-000 exists to prevent: shipping something that fails 4
of the 22 §2.10 acceptance criteria. v2 §7.7 permits deferring scope; it does
not permit forgetting the target.

---

## Revisit if

- The prototype is never intended to grow into the full product — in which case
  ADR-000 should be revisited, not this one
- Docker or a managed Postgres becomes available, at which point ADR-001's
  database decision should be re-examined for parity with production
- A file or attachment requirement appears in the PRD
- Authentication arrives, at which point ADR-001 §3 must be replaced with a
  dedicated auth ADR covering session strategy, per-user isolation, and
  cross-device requirements
- SQLite is adopted as a permanent schema of record — which would contradict
  ADR-000's relational-cloud-database decision and force a revision of both

---

## Verification

- [ ] `npm run dev` serves the app on `localhost`
- [ ] PostgreSQL reachable locally; `drizzle-kit migrate` builds the schema from
      `migrations/`
- [ ] Every user-scoped table has a nullable `user_id` defaulting to the seeded
      local user
- [ ] No authentication code, no auth middleware, no session handling
- [ ] No file upload, no storage adapter, no object storage client
- [ ] App is fully functional with no `OPENAI_API_KEY` set
- [ ] No outbound network call other than the optional AI request
- [ ] `.env.local` is gitignored and no credential is committed

## References

- `docs/PRD_v2.md` §1.9 (no API keys exposed to the client), §1.10 (data model —
  no attachment entity), §1.11 (recoverability, user control), §7.7 (MVP
  boundary)
- `docs/adr/ADR-000-scope-and-source-of-truth.md` — D1, D2, D3
- `docs/IMPLEMENTATION_PLAN.md` §2 (architecture summary), §3 (phase roadmap)
