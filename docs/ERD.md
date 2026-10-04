# TaskMaster — Entity Relationship Documentation

Schema source of truth: [`lib/db/schema.ts`](../lib/db/schema.ts). This
document explains the relationships, the two deliberate departures from
PRD_v2.md §1.10's literal field list, and how row-level security is wired
in — the things a raw schema file doesn't say on its own.

## Entities and relationships

```
users (1) ──< goals (many)
users (1) ──< projects (many) ──> goals (optional, nullable FK)
users (1) ──< brain_dumps (many)
users (1) ──< tasks (many) ──> projects (optional)
                            └─> goals (optional)
users (1) ──< task_dependencies (many) ──> tasks (task_id, depends_on_task_id)
users (1) ──< task_events (many) ──> tasks
users (1) ──< recurrence_rules (many)
users (1) ──< plans (many)
users (1) ──< plan_items (many) ──> plans, tasks
```

Every table has a foreign key to `users`, `ON DELETE CASCADE` — deleting a
user's account (PRD_v2.md §2.2 Account/Data Deletion) removes every row
they own in one statement, with no orphaned data to clean up separately.

## Two departures from PRD_v2.md §1.10's literal field list

### 1. Four tables the PRD implies but doesn't name

Added per `docs/IMPLEMENTATION_PLAN.md` Phase 3, work item 1 — each is a
requirement the PRD states in prose without naming the entity that has to
exist to satisfy it:

| Table | Why it exists | PRD anchor |
|---|---|---|
| `task_events` | Status-change history | §3.3 Daily/Weekly Review need something to summarise |
| `task_dependencies` | Explicit dependency edges | §2.3 lists dependencies as a prioritisation signal |
| `recurrence_rules` | Repeating obligations | §3.1 "Recurring Responsibilities," P0 |
| `brain_dumps.proposal_json` | The raw AI extraction proposal, retained even if the save fails | §1.11 Recoverability: "Failed AI processing must not destroy or silently alter user input" |

### 2. `user_id` denormalized onto every table, including child tables

`task_dependencies`, `task_events`, and `plan_items` each have their own
`user_id` column, even though it's technically derivable by joining up to
`tasks.user_id` or `plans.user_id`.

This is deliberate, not an oversight: it's what keeps every row-level
security policy a flat `user_id = app_current_user_id()` check (see
below) instead of a correlated subquery through a parent table on every
single query. A flat equality check can use the index on `user_id`
directly; a correlated-subquery policy re-runs the subquery per candidate
row and cannot use that index the same way. At this product's scale the
performance difference may not matter yet, but the **auditability**
difference matters from day one: every policy in
[`migrations/0001_row_level_security.sql`](../migrations/0001_row_level_security.sql)
has the identical, trivially-reviewable shape. A reviewer checking "does
every table actually enforce isolation" doesn't need to reason about three
different join patterns — just one.

The cost is a NOT NULL `user_id` on child rows that must stay in sync with
their parent's `user_id` at insert time (enforced by application code —
`lib/repo/postgres-task-repository.ts` and the seed script always insert
the child's `user_id` equal to the parent's, there's no database
constraint that would reject a mismatch). This is an accepted tradeoff:
cheap to get right at insert time, significantly simpler to audit for
correctness after the fact.

## Row-level security

Full mechanism, policies, and the critical "use a non-superuser role or
none of this does anything" warning:
[`migrations/0001_row_level_security.sql`](../migrations/0001_row_level_security.sql)
and [ADR-004](adr/ADR-004-row-level-security.md). Summary:

- A session-local Postgres setting, `app.current_user_id`, set once per
  transaction via `set_config(..., true)` — **not** Supabase's
  `auth.uid()`, since this project is self-hosted Postgres + Better Auth
  (deferred to Phase 8), not Supabase.
- Every user-scoped table: `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL
  SECURITY`, and one `FOR ALL` policy keyed on that setting.
- The application and every test that exercises these policies connect as
  `taskmaster_app` (`scripts/db-bootstrap.sh`), a role with **no**
  superuser or BYPASSRLS attribute. The default local Homebrew role is a
  superuser and silently bypasses every policy below regardless of
  `FORCE` — connecting as it would make the isolation test pass or fail
  for the wrong reason.

## Indexes

One per foreign key plus the query shapes the current prototype and the
Phase 6 planning engine actually need: `tasks(user_id, status)` for "my
open tasks," `tasks(due_date)` for deadline-ordered views,
`plans(user_id, date)` (also a uniqueness constraint — one plan per user
per day).

## Verification

Re-run any time the schema changes:

```bash
npm run db:bootstrap   # idempotent — creates the DB + app role if missing
npm run db:migrate     # applies every migration in order
npm run db:seed        # multi-user sample data + an inline isolation spot-check
npm run db:test        # isolation proof + Postgres repository contract tests
```

This was run against a **fully dropped and recreated** database while
building Phase 3 — `dropdb taskmaster_dev`, re-bootstrap, re-migrate — to
prove the schema is reconstructable from the committed migrations alone,
not just "happened to still work" on a database that had drifted from
them.
