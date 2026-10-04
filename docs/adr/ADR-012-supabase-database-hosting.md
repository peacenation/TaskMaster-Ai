# ADR-012 — Supabase database hosting only

- **Status:** Accepted; connected and verified on 2026-10-04
- **Date:** 2026-10-04
- **Decider:** Product Owner
- **Related:** ADR-001, ADR-003, ADR-004, ADR-005, ADR-009

## Decision

The Product Owner requested Supabase **database hosting only**. Supabase
PostgreSQL replaces the local database for application storage once configured.
The Next.js app, Drizzle/pg repositories, single local-user seam and current
transaction-local RLS context remain. No Supabase Auth or browser SDK is added.
This updates the local-database restriction in ADR-001; authentication remains
a separate later phase governed by ADR-003.

Use the dashboard-provided session-pooler connection on port 5432 for the
current persistent local server and migrations. The owner connection is used
only for migrations and provisioning. The application uses a dedicated
restricted role through `DATABASE_URL_APP`, preserving forced RLS.

## Consequences

- Existing SQL migrations carry forward; no schema rewrite is needed.
- Local development credentials are retained separately so destructive DB
  tests always run against `taskmaster_test` on localhost.
- The sample-data seed command refuses remote databases.
- Provisioning grants access only to TaskMaster tables, without grants to
  unrelated Supabase tables or schemas. New tables require updated grants.
- Cloud database hosting does not create authenticated accounts or deploy
  the application. Until auth is implemented, the app still has one local user.
- Schema migration does not copy existing local tasks. Transfer is a separate
  operation requiring a source/destination decision.

Setup commands, connection requirements and sources are in [SUPABASE.md](../SUPABASE.md).
