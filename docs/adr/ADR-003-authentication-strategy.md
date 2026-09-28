# ADR-003 — Authentication and session handling

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (this ADR), Phase 8 (implementation)
- **Related:** [ADR-000](ADR-000-scope-and-source-of-truth.md),
  [ADR-001](ADR-001-prototype-stack.md) §3,
  [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) Phase 8
- **Supersedes:** nothing. Formalises, as its own ADR, the deferred decision
  ADR-001 §3 said would need one.

---

## Context

ADR-001 §3 already decided that the current milestone ships with **no**
authentication, and named **Better Auth** as the production choice. That
decision was made informally, inside an ADR about the prototype stack as a
whole. Phase 2's own definition of done requires it as a standalone,
reviewable architectural decision — because authentication is what makes
or breaks PRD_v2.md §1.11's "Critical" data-exposure risk once real user
accounts exist, and a decision that consequential should not live as a
subsection of an unrelated document.

This ADR does not change the decision. It gives it its own home, states the
alternatives considered, and records what triggers a revisit.

## Decision

| | |
|---|---|
| **Current milestone** | No authentication. Single seeded local user. |
| **Production** | **Better Auth**, self-hosted, Drizzle adapter, sessions stored in Postgres |
| **Session strategy** | Server-side session record (database-backed), not a stateless JWT — sessions must be revocable (PRD §1.11 user control; account deletion in §2.2) |
| **Schema readiness** | Every user-scoped table already has a `user_id` column (nullable, defaulted to the seeded user) so Phase 8 needs no destructive migration |

### Alternatives considered

| Option | Why it lost |
|---|---|
| **Auth.js (NextAuth) v5** | Sound and better-known. Better Auth preferred for a first-class Drizzle adapter and because it needs no external identity provider by default — fewer moving parts for a self-hosted, single-maintainer product |
| **Clerk / Supabase Auth (hosted)** | Both are competent, but hand a critical-risk subsystem (§1.11) to a third party and add a recurring cost before revenue exists. Revisit if team size or compliance needs change |
| **Hand-rolled auth** | Rejected outright. §1.11 rates data exposure Critical; not hand-rolling authentication is the single biggest available security win |

## Consequences

### Positive

- Multi-user isolation work is deferred to exactly one phase (Phase 8),
  not smeared across the codebase piecemeal
- No schema rework needed when auth lands — `user_id` already exists
  everywhere it needs to
- Revocable sessions support the account-deletion and "sign out everywhere"
  expectations implicit in §2.2's Account/Data Deletion acceptance criterion

### Negative / accepted

- Zero real-world testing of the auth/session model exists until Phase 8
- The current prototype cannot demonstrate cross-device or multi-user
  behaviour — this is a known, accepted gap tracked in ADR-001

## Revisit if

- Phase 8 begins — this ADR's "Production" row must be re-verified against
  Better Auth's then-current API and Drizzle adapter compatibility before
  implementation starts, not assumed from this date
- A compliance requirement (SOC 2, HIPAA-adjacent data, etc.) appears,
  which would favour a hosted provider with existing audit trails over
  self-hosting
- Better Auth is abandoned or its Drizzle adapter is dropped

## Verification

- [ ] Every table in `docs/PRD_v2.md` §1.10 that is user-scoped has a
      `user_id` column before Phase 3 migrations are written
- [ ] No authentication code, middleware, or session handling exists before
      Phase 8 begins (ADR-001's own verification checklist)
- [ ] When Phase 8 starts, this ADR is re-read and its "Alternatives
      considered" table re-verified against current tooling before coding

## References

- `docs/PRD_v2.md` §1.11 (data exposure rated Critical), §2.2 (Account/Data
  Deletion, P0)
- `docs/adr/ADR-001-prototype-stack.md` §3
- `docs/IMPLEMENTATION_PLAN.md` Phase 8
