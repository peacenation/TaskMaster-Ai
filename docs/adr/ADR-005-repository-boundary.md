# ADR-005 — Repository / persistence boundary

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (interface + in-memory adapter, this ADR),
  Phase 3 (Postgres adapter), Phase 4 (domain engine consumes this
  interface, never a database client directly)
- **Related:** [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md)
  §1.2 decision D3, D4
- **Supersedes:** nothing

---

## Context

Decision D3 in `IMPLEMENTATION_PLAN.md` §1.2 already commits to this:
"storage sits behind a repository interface so the domain and UI layers
never import a database client directly." This ADR is that decision's
formal record, plus the actual seam it describes, implemented now so
Phase 3 has an interface to build a real adapter against and Phase 4 has
one to build a tested domain engine against.

## Decision

A `Repository<T>`-shaped interface per aggregate (starting with tasks),
defined in `lib/repo/`, with:

- **`InMemoryTaskRepository`** — an array-backed adapter, available now,
  used in tests and any dev workflow that doesn't need real persistence
- **A Postgres/Drizzle adapter** — built in Phase 3, implementing the same
  interface, swapped in via a single factory function

No caller — not `app/page.tsx`, not the domain engine Phase 4 builds — is
allowed to import a database client (`drizzle`, `pg`, etc.) directly. Every
read or write to task data goes through this interface.

```ts
export interface TaskRepository {
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  create(input: NewTask): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task>;
  remove(id: string): Promise<void>;
}
```

### Why now, and why in-memory first

Building the Postgres adapter before the interface exists risks shaping
the interface around Drizzle's query API rather than around what the
domain actually needs — the tail wagging the dog. Defining the interface
against an in-memory adapter first forces it to describe *behaviour*
(list, get, create, update, remove) rather than *SQL*. The in-memory
adapter is also what makes the Phase 4 domain-engine test suite fast and
independent of a running Postgres instance.

## Consequences

### Positive

- Phase 3's Postgres adapter is additive — implement the same interface,
  swap the factory, nothing upstream changes
- Phase 4's domain logic (D4: pure, framework-free) can be tested against
  `InMemoryTaskRepository` with no database, no network, no test-container
  setup
- A future "run fully local with no Postgres" demo path stays possible
  (ADR-001's fallback note), because the seam already exists

### Negative / accepted

- Two adapters to maintain in parallel once Phase 3 lands (in-memory for
  tests/dev, Postgres for real persistence) — accepted, since the
  alternative (tests hitting real Postgres) is slower and couples domain
  tests to database availability
- The interface will almost certainly need small additions once the
  Postgres adapter and Phase 4 domain engine are built against it for
  real — expected, not a sign the interface was wrong to start narrow

## Revisit if

- The interface needs a shape Drizzle genuinely cannot express efficiently
  (e.g. a query only sensible as raw SQL) — add an escape hatch method
  rather than abandoning the interface
- A second aggregate (Project, Goal, Plan) is added — confirm the same
  pattern still fits before copy-pasting it four more times

## Verification

- [ ] `lib/repo/task-repository.ts` defines the interface; no other file
      imports a database client directly
- [ ] `lib/repo/in-memory-task-repository.ts` implements it, with a unit
      test covering create/list/update/remove
- [ ] Phase 3's Postgres adapter, when built, passes the same test suite
      the in-memory adapter passes (a shared contract test)

## References

- `docs/IMPLEMENTATION_PLAN.md` §1.2 D3, D4
- `lib/repo/task-repository.ts`, `lib/repo/in-memory-task-repository.ts`
