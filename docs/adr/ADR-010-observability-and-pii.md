# ADR-010 — Observability and PII handling

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (logging convention, this ADR), Phase 11/12 (real
  error-monitoring tool)
- **Related:** [ADR-007](ADR-007-ai-fallback-policy.md),
  [`../PRD_v2.md`](../PRD_v2.md) §1.9, §1.11, §2.7
- **Supersedes:** nothing

---

## Context

PRD_v2.md §1.9 requires "observability for application errors." §2.7 adds
"logging/error monitoring without exposing private task content
unnecessarily." A Brain Dump, by design, contains exactly the kind of
content a user would not want sitting in a third-party error-monitoring
vendor's dashboard — "things you've been putting off," per the product's
own opening prompt (§1.7). Observability and privacy are in tension here,
not aligned by default, so the rule has to be explicit rather than left to
whoever adds the first `console.error`.

## Decision

**No error-monitoring vendor is installed yet.** `IMPLEMENTATION_PLAN.md`
§8.3 already prices Sentry in as a Phase 12 cost, not a Phase 2 one. What
Phase 2 fixes now is the **rule**, so every `console.error` written between
now and Phase 12 already follows it, instead of needing an audit-and-fix
pass later:

| Rule | |
|---|---|
| **Log identifiers and outcomes, not content** | `taskId`, `userId`, error type, and a message are fine. Raw Brain Dump text, task titles, or AI prompts/responses are not, even in a caught-error log |
| **AI failures (ADR-007) log the failure mode, not the payload** | "AI response failed Zod validation" is fine; logging the raw response that failed validation is not — it may contain the user's original text echoed back |
| **Structured, not string-concatenated** | Every log call takes a message plus a metadata object, so a future migration to a real tool (Phase 12) is a transport swap, not a rewrite of every call site |
| **Server-side only for anything containing user data** | Client-side errors may log to the console for local dev visibility, but nothing containing task content is ever sent to a remote endpoint before Phase 12's tool is chosen with this rule in mind |

### Why not install Sentry (or similar) now

Phase 2 has no production traffic to observe yet — there is no deployment
(ADR-009). Installing a monitoring SDK before Phase 12 would mean
configuring PII scrubbing rules for a vendor two Phase 2 has no way to
verify against real traffic, which risks a false sense of safety more than
it buys observability. The rule above is what actually needs to exist now;
the vendor is a Phase 12 decision informed by whatever the schema and AI
integration look like by then.

## Consequences

### Positive

- The PII rule exists before the first log statement is written for real
  application code, not retrofitted once a leak is noticed
- Adding a real monitoring tool at Phase 12 is a transport change (point
  the structured logger at Sentry/etc.) rather than a rewrite of every
  call site across the codebase

### Negative / accepted

- No real alerting or error aggregation exists until Phase 12 — accepted,
  since there's no deployed traffic to alert on yet
- The rule depends on code review catching violations until a linter rule
  or wrapper enforces it automatically — a manual discipline, tracked as a
  Phase 11 hardening candidate (an ESLint rule or a typed `logger` module
  that structurally can't accept a raw Brain Dump string)

## Revisit if

- Phase 12 is reached — choose the actual vendor against this rule, not
  around it
- A logging call site is found in review that violates the content rule —
  treat it as a signal to add the enforcing lint rule sooner, not just fix
  the one call site

## Verification

- [ ] No log call in the codebase includes raw Brain Dump text, task
      titles/descriptions, or full AI request/response payloads
- [ ] Every log call uses a structured `(message, metadata)` shape
- [ ] Phase 12's monitoring-tool choice is checked against this ADR's PII
      rule before being wired in

## References

- `docs/PRD_v2.md` §1.9, §1.11, §2.7
- `docs/IMPLEMENTATION_PLAN.md` §8.3 (Sentry costed at Phase 12)
- `docs/adr/ADR-007-ai-fallback-policy.md`
