# ADR-004 — Per-user data isolation (row-level security)

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (this ADR), Phase 3 (implementation)
- **Related:** [ADR-000](ADR-000-scope-and-source-of-truth.md),
  [ADR-003](ADR-003-authentication-strategy.md),
  [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) §2 (target
  architecture table, "Row security" row), Phase 3
- **Supersedes:** nothing

---

## Context

PRD_v2.md §1.11 rates "sensitive productivity data is exposed" as a
Critical-impact risk and states plainly: **"Users may only access their own
private productivity data."** The question is not *whether* to isolate
per-user data — that's settled — but *where* the isolation is enforced.

Two layers can do this:

1. **Application-only filtering** — every query includes `WHERE user_id =
   :currentUser` by convention/discipline.
2. **Database-enforced row-level security (RLS)** — Postgres itself refuses
   to return or write rows outside the session's user, regardless of what
   the application code does or fails to do.

## Decision

**Postgres row-level security, keyed on the authenticated session's user
id, on every user-scoped table.** Enforced as of Phase 3 (schema/migrations
land then); Phase 8 (real auth) is what makes the session-user key
meaningful in production. The current milestone has exactly one seeded
local user, so RLS has nothing to isolate yet — this ADR records the
decision ahead of the schema that will need it, per Phase 2's own goal of
writing architecture decisions down before the code that depends on them.

### Why not application-only filtering

A single missed `WHERE user_id = ...` clause in one query — in a feature
branch, in a rushed fix, in code a future contributor writes without full
context — leaks another user's tasks, goals, or Brain Dump content. That is
exactly the Critical-impact scenario §1.11 exists to prevent. RLS makes
that class of bug structurally impossible: even a query that forgets the
filter gets zero rows back, not someone else's data, because the database
enforces it below the application layer regardless of what the query asked
for.

Application-level filtering is not abandoned — it stays as defense in
depth via the [ADR-005](ADR-005-repository-boundary.md) repository layer,
which is the only code path allowed to reach the database at all. RLS is
the layer that holds if that discipline ever slips.

## Consequences

### Positive

- A missed filter in application code fails safe (empty result), not
  unsafe (someone else's data)
- Security review (Phase 11) has a single mechanism to audit — the RLS
  policies — rather than needing to trace every query call site

### Negative / accepted

- RLS policies are Postgres-specific, which is an accepted cost since
  ADR-001 already commits to Postgres for `jsonb` and enum support
- Every migration that adds a user-scoped table must also add its RLS
  policy in the same migration, or the table is unintentionally
  unprotected — this is a discipline the Phase 3 migration review must
  check, not something RLS enforces automatically for a *new* table
- Local development without a real session context (the current
  milestone's single seeded user) needs either RLS temporarily disabled or
  a fixed session variable set — Phase 3 must decide this explicitly when
  the schema is written, not leave it implicit

## Revisit if

- A future requirement needs cross-user visibility by design (e.g. Phase
  4's later "Team/Business" tier in PRD_v2.md §5.1) — RLS policies would
  need explicit shared-access rules rather than a strict per-user key
- Postgres is ever abandoned as the datastore (would also force revisiting
  ADR-000 and ADR-001)

## Verification

- [ ] Every user-scoped table's first migration includes its RLS policy —
      no table exists for more than one migration without one
- [ ] A Phase 3 test proves a query without the correct session context
      returns zero rows, not another user's data
- [ ] Phase 11 security review re-reads this ADR and confirms policies
      still match the then-current schema

## References

- `docs/PRD_v2.md` §1.11 (per-user access, rated Critical)
- `docs/IMPLEMENTATION_PLAN.md` §2 target architecture table
- `docs/adr/ADR-005-repository-boundary.md`

---

## Implementation note (Phase 3, 2026-10-04)

This ADR deferred "how is the session's user actually identified" to
Phase 3. Two things had to be decided concretely, neither of which was
obvious from the ADR text alone:

**1. The session-key mechanism is a Postgres GUC, not `auth.uid()`.** Many
RLS writeups (including Supabase's own docs, which much of the public
RLS-pattern content online is written against) use `auth.uid()`. That
function is Supabase-specific — it does not exist on self-hosted Postgres.
Since ADR-001/ADR-003 already committed this project to self-hosted
Postgres + Better Auth, not Supabase, every policy here keys on a plain
session-local setting instead:

```sql
SELECT set_config('app.current_user_id', '<uuid>', true);  -- true = SET LOCAL semantics
```

wrapped in a helper function, `app_current_user_id()`, so every policy
reads the same way. See `migrations/0001_row_level_security.sql`.

**2. The default local Postgres role is a superuser — RLS does nothing for
it, with or without `FORCE`.** This was not obvious until checked directly:
`SELECT rolsuper, rolbypassrls FROM pg_roles` on the Homebrew-created role
returned `true, true`. Postgres superusers and any role with `BYPASSRLS`
ignore every RLS policy unconditionally — `FORCE ROW LEVEL SECURITY` only
affects whether the table's *owner* is subject to its own policies, and
does nothing for superusers regardless. Connecting the application (or a
test) as that role would make every isolation check pass or fail for the
wrong reason — it would prove nothing about whether the policies work.

`scripts/db-bootstrap.sh` creates a second role, `taskmaster_app`, with
`NOSUPERUSER NOBYPASSRLS`, and that is the **only** role the application
(`lib/db/client.ts`'s `appDb`) or the isolation test ever connects as. The
admin/owner connection (`adminDb`) is migrations and the seed script only,
and is explicitly documented as never for application queries, for exactly
this reason.

Verified directly, not just asserted: `lib/db/isolation.test.ts` proves
zero cross-user rows returned/affected for select, update, delete, and
insert, across all ten user-scoped tables, run against the
`taskmaster_app` role.
