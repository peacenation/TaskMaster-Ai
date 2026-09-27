# TaskMaster Documentation Index

## Authoritative document

> **[`PRD_v2.md`](PRD_v2.md) is the single source of truth.**

Scope, feature priorities, architecture and acceptance criteria are taken from
v2.0 only. Where any other document disagrees, v2.0 wins.

The architecture in v2.0 §1.8–§1.9 is settled: **cloud-based responsive web
application**, authenticated accounts, relational cloud database, cross-device
persistence, server-side AI calls. There is no local-only, browser-storage or
account-free variant in scope.

## Documents

| Document | Status | Purpose |
|---|---|---|
| [`PRD_v2.md`](PRD_v2.md) | **Authoritative** | Product scope, P0/P1/P2 priorities, data model, NFRs, per-phase acceptance criteria |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Active | 13-phase build plan, architecture decision summary, effort and cost model |
| [`adr/`](adr/) | Active | Architecture decision records |
| [`archive/PRD_v1.md`](archive/PRD_v1.md) | **Superseded** | v1 product vision and feature catalogue. History only — do not build from it |

## Architecture decision records

| ADR | Subject | Status |
|---|---|---|
| [ADR-000](adr/ADR-000-scope-and-source-of-truth.md) | Scope and source of truth | Accepted |

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
