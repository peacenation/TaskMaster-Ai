# ADR-009 — Deployment, environments, secrets

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (env convention, CI guard, this ADR), Phase 12
  (actual deployment)
- **Related:** [ADR-001](ADR-001-prototype-stack.md),
  [ADR-006](ADR-006-ai-integration.md), [`../PRD_v2.md`](../PRD_v2.md) §1.9
- **Supersedes:** nothing

---

## Context

No deployment exists yet — ADR-001 is explicit that the current milestone
runs entirely on `localhost`. But two things in Phase 2's scope aren't
deployment itself: the **environment/secrets convention** the codebase
will follow from here on, and the **CI guard** that proves it's being
followed, on every push, not just at deploy time.

## Decision

| | |
|---|---|
| **Local secrets** | `.env.local` (gitignored — already true per `.gitignore` and ADR-001) |
| **Documented shape** | `.env.example` at the repo root lists every expected variable name (no real values), so a fresh clone knows what to set without reading source |
| **Client-visible vars** | Only ones explicitly prefixed `NEXT_PUBLIC_` — Next.js's own build-time guarantee, not something this project reimplements |
| **Server-only vars** | Everything else (`DATABASE_URL` from Phase 3, an AI provider key from Phase 5/6) — read only in Route Handlers / server components, never imported into a file a client component also imports |
| **CI guard** | A build step greps the produced `.next` static client output for the literal names in `.env.example`'s server-only section; the build fails if any appear |
| **Environments** | Local (now) → Preview (per-PR, Phase 12) → Production (Phase 12). No staging tier — PRD_v2.md's Phase 1 scope doesn't justify one yet |
| **Deployment target** | **Vercel** (`IMPLEMENTATION_PLAN.md` §8.3 already prices this in) — chosen for zero-config Next.js App Router + Route Handler support; revisited only if cost or platform limits force it at Phase 12 |

### Why a CI grep instead of trusting the framework alone

Next.js already prevents non-`NEXT_PUBLIC_` variables from being inlined
into client bundles — this is a real, load-bearing guarantee, not
decoration. The grep step exists as defense in depth against a future
mistake (e.g. someone destructuring `process.env` into a shared constants
file that a client component then imports), and as a concrete, automated
answer to Phase 2's exit criterion: *"a build artefact grep confirms no AI
provider key in any client chunk."*

Today this check is **vacuous but present** — no server-only variable is
actually read anywhere in the code yet (no database, no AI call wired up),
so there's nothing to leak. It becomes load-bearing the moment Phase 3
adds `DATABASE_URL` and Phase 5/6 add the AI provider key, at which point
it's already running rather than needing to be remembered.

## Consequences

### Positive

- A fresh clone always knows what env vars exist, from `.env.example`,
  without spelunking through source
- The secret-leak guard runs on every CI build from Phase 2 onward, not
  introduced under time pressure when a real secret first exists
- No deployment infrastructure is built before Phase 12 needs it

### Negative / accepted

- The CI grep only catches variable *names* appearing verbatim in output —
  it would not catch a secret copy-pasted as a literal string somewhere.
  Accepted: that's a code-review problem, not a CI-automatable one, at
  this project's size

## Revisit if

- Vercel's pricing or limits stop fitting the project at Phase 12
- A staging environment becomes genuinely necessary (e.g. a second
  developer joins, or a customer requires a pre-prod sign-off step)

## Verification

- [ ] `.env.example` exists and lists every variable `.env.local` needs
- [ ] `.env.local` is gitignored (already true; re-confirmed here)
- [ ] CI's client-bundle grep step exists and passes
- [ ] No `NEXT_PUBLIC_`-prefixed variable holds a secret value

## References

- `docs/PRD_v2.md` §1.9 (no API keys exposed to the client)
- `docs/adr/ADR-001-prototype-stack.md`
- `docs/adr/ADR-006-ai-integration.md`
- `docs/IMPLEMENTATION_PLAN.md` §8.3 (Vercel costed as the deploy target)

---

## Amendment (2026-10-05): the guard checks values, not names

The original guard grepped `.next/static` for secret variable *names*. Two
problems surfaced once real dependencies arrived:

- **It flagged harmless references.** Better Auth's shared code mentions
  `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` by name in the browser bundle
  (its env accessor, which returns nothing there). CI went red with no leak.
- **It missed the realistic leak.** A server page passing a secret to a
  client component as a prop puts the *value* — not the name — into that
  page's prerendered HTML/RSC under `.next/server/app`, which it never
  scanned. Verified by planting exactly that leak: the old guard passed it.

`scripts/check-client-bundle.sh` now builds with a unique sentinel value in
every secret from `.env.example` and searches client JS **and** prerendered
page output for those values. Verified both ways: it fails on the planted
leak and passes without it. Public configuration (`BETTER_AUTH_URL`,
`AUTH_EMAIL_PROVIDER`, `AUTH_EMAIL_FROM`, `AWS_REGION`) is exempt.

**Remaining limit:** pages rendered per request aren't in build output, so
a leak on a dynamic page can only be caught at runtime or in review.
