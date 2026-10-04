# ADR-007 — AI failure and fallback policy

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (this ADR), already partially implemented in the
  Phase 5/6 UI-first prototype (`lib/extract.ts`)
- **Related:** [ADR-006](ADR-006-ai-integration.md),
  [`../PRD_v2.md`](../PRD_v2.md) §1.11, §2.6
- **Supersedes:** nothing

---

## Context

PRD_v2.md §1.11 states plainly: **"Recoverability: Failed AI processing
must not destroy or silently alter user input."** §2.6 adds that AI should
"ask a clarifying question only when uncertainty materially affects the
plan" and should expose uncertainty rather than pretend certainty. Neither
requirement is optional or AI-provider-dependent — they hold whether the
AI call times out, returns malformed output, or the API key is simply
absent (ADR-001 already made "the app works fully without an API key" a
requirement of the prototype milestone).

## Decision

**A local heuristic extractor is not a fallback bolted on after the fact —
it is a first-class, always-available code path.** The real AI call
(ADR-006) is additive on top of it, never a replacement it depends on.

| Failure mode | Behaviour |
|---|---|
| No API key configured | Skip the AI call entirely; use the heuristic. No error surfaced to the user — this is expected, not a failure |
| AI call times out / network error | Fall back to the heuristic for that request; the user's raw Brain Dump text is never lost (it's already been captured before the call is made) |
| AI response fails Zod validation (ADR-006) | Treated the same as a network failure — fall back to the heuristic, log the validation failure server-side (see ADR-010) without ever passing the malformed response to application state |
| AI succeeds but confidence is low | Surface the uncertainty in the UI (per §2.6) rather than presenting a low-confidence guess as a settled fact |

The heuristic itself (line/sentence-boundary splitting) already exists in
`lib/extract.ts`, extracted from the Phase 5/6 prototype UI during Phase 2
so it's a tested, standalone module rather than logic buried in a
component (see ADR-005's D4 principle: domain logic is pure and
framework-free).

### Why not "just show an error and let the user retry"

A retry-on-failure UX silently violates §1.11's recoverability
requirement the moment a user's Brain Dump would otherwise vanish on a
transient network blip. The heuristic path means a Brain Dump always
produces *something* reviewable, even in the worst case (AI provider fully
down) — degraded quality, never zero output.

## Consequences

### Positive

- The product's core promise (turn messy input into a plan) survives AI
  outages, missing keys, and provider rate limits without any special-case
  code in the UI layer — the UI always calls "extract," and doesn't need
  to know which path served it
- Directly satisfies §1.11's recoverability requirement and ADR-001's
  "app is fully functional with no API key" verification item
- Gives Phase 4's domain-engine test suite a deterministic extraction path
  to test against, since the heuristic has no network dependency

### Negative / accepted

- Heuristic-only extraction is lower quality than a real AI call — accepted
  as the honest cost of never leaving the user with nothing
- Two extraction code paths (heuristic, AI) must be kept behaviourally
  compatible in their output shape, or the review-before-commit UI (§2.2)
  has to special-case which one ran

## Revisit if

- The AI provider adds a low-latency confidence score that changes what
  "low confidence" should mean here
- User feedback shows the heuristic's output is confusing when silently
  substituted for a failed AI call — may need to surface *which* path ran,
  not just its result

## Verification

- [ ] `lib/extract.ts` has no dependency on network access or a provider
      SDK
- [x] A unit test proves extraction succeeds with no AI credentials
      configured (`lib/capture/extract-with-fallback.test.ts`, "with AI
      switched off"). Was written as `AI_PROVIDER_API_KEY` unset; the key is
      `ANTHROPIC_API_KEY` since ADR-011.
      unset
- [ ] No code path exists where a failed AI call returns an empty result
      to the user instead of the heuristic's output

## References

- `docs/PRD_v2.md` §1.11 (Recoverability), §2.6 (AI Behaviour)
- `docs/adr/ADR-001-prototype-stack.md` (heuristic fallback verification
  item)
- `lib/extract.ts`
