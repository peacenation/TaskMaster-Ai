# ADR-006 — AI integration: provider, structured output, validation

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (this ADR), Phase 5/6 (implementation — Brain Dump
  extraction, task breakdown)
- **Related:** [ADR-007](ADR-007-ai-fallback-policy.md),
  [`../PRD_v2.md`](../PRD_v2.md) §1.9, §2.6, §2.7
- **Supersedes:** nothing

---

## Context

PRD_v2.md is explicit on three points that constrain this decision before
any vendor is chosen:

- §1.9: "no API keys exposed to the client"
- §2.7: "structured AI responses rather than free-form parsing where
  practical" and "the raw AI response must not directly mutate stored user
  data without validation"
- §2.6: AI should "accept user corrections," "never silently delete
  commitments," and expose uncertainty rather than pretend certainty

No AI call is wired up yet — the current prototype uses a local heuristic
(see [ADR-007](ADR-007-ai-fallback-policy.md)). This ADR fixes the shape
the real call will take when Phase 5/6 build it, so that work starts from
a decided interface instead of an implementation-time improvisation.

## Decision

| | |
|---|---|
| **Call location** | Server-side only — a Next.js Route Handler (`/api/extract`, `/api/breakdown`), never a client-side fetch to the provider |
| **Provider shape** | OpenAI-compatible chat completions API (works with OpenAI directly or any compatible-endpoint provider without a code change) |
| **Output contract** | Structured output (JSON mode / function-calling, whichever the chosen provider supports) — not prose parsed with regex |
| **Validation** | Every response validated against a **Zod** schema at the API boundary before it touches application state. A response that fails validation is treated as a failure (see ADR-007), never partially trusted |
| **Secrets** | Provider API key read server-side only, via `process.env`, never a `NEXT_PUBLIC_`-prefixed variable. Verified by the CI build-artefact grep step (see ADR-009) |

### Why OpenAI-compatible rather than naming one vendor permanently

Naming a single hard-coded vendor SDK now would repeat the mistake ADR-002
(transactional email) explicitly avoided for a different subsystem:
locking a swappable concern to one vendor before it needs to be. An
OpenAI-compatible contract keeps the provider swappable behind one
interface, consistent with how ADR-002 treats email sending.

### Why Zod specifically

Already the project's chosen schema-validation library per
`IMPLEMENTATION_PLAN.md` §2 (AI validation row) and consistent with
Drizzle's own ecosystem (drizzle-zod exists for schema-to-validator
generation later, if useful). No second validation library is introduced
for the same job.

## Consequences

### Positive

- The client bundle never sees a provider key — enforced structurally (API
  route boundary), not by convention alone
- A malformed or hallucinated AI response cannot corrupt stored data,
  because it never reaches storage without passing the Zod schema first
- Swapping providers later is a Route Handler change, not a rewrite across
  the codebase

### Negative / accepted

- An extra network hop (client → our API route → provider) versus a direct
  client-to-provider call — accepted, it's the only way to satisfy §1.9
- Structured-output support varies by provider/model; the Route Handler
  must degrade sensibly (see ADR-007) rather than assume every provider
  behaves identically

## Revisit if

- The chosen provider's structured-output mechanism changes shape
  (deprecated JSON mode, new function-calling version, etc.)
- Streaming responses become a UX requirement — the current decision
  assumes a single complete structured response per call, not incremental
  tokens

## Verification

- [ ] No file under `app/` that runs in the browser imports a provider
      SDK or reads a non-`NEXT_PUBLIC_` env var
- [ ] Every AI response passes through a Zod `.parse()`/`.safeParse()`
      before any state mutation
- [ ] CI's client-bundle grep (ADR-009) passes on every build

## References

- `docs/PRD_v2.md` §1.9, §2.6, §2.7
- `docs/IMPLEMENTATION_PLAN.md` §2 (AI provider, AI validation rows)
- `docs/adr/ADR-002-transactional-email.md` (same "swappable behind an
  interface" pattern applied to a different subsystem)
