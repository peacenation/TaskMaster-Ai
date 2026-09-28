# ADR-008 — Testing strategy and pyramid

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Product Owner, AI agent
- **Affects:** Phase 2 (test runner + first tests, CI), Phase 4 (domain
  engine test suite), Phase 11 (E2E hardening)
- **Related:** [ADR-005](ADR-005-repository-boundary.md),
  [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) Phase 2, Phase 4,
  Phase 11
- **Supersedes:** nothing

---

## Context

Phase 2's exit criteria require `npm run test` to exist and pass in CI. No
test runner exists yet. Decision D4 (`IMPLEMENTATION_PLAN.md` §1.2)
already commits to pure, framework-free domain logic specifically *because*
it's cheap to test — this ADR is what makes that payoff real rather than
theoretical.

## Decision

A conventional pyramid, shaped by what's actually risky in this codebase
(PRD_v2.md §6 rates AI extraction accuracy and prioritisation quality as
the highest-likelihood risks):

| Layer | Tool | Scope | Phase |
|---|---|---|---|
| **Unit** | **Vitest** | Pure functions in `lib/` — extraction heuristic, contrast math, domain scoring (Phase 4) | Now |
| **Repository contract tests** | Vitest | Same test suite run against both `InMemoryTaskRepository` and the Phase 3 Postgres adapter, proving they behave identically | Phase 3 |
| **Component** | Vitest + Testing Library (added when first needed) | Interactive UI behaviour that isn't worth a full browser (e.g. review-list approve/remove) | Phase 5+, as needed |
| **End-to-end** | Playwright (added when first needed) | Full user flows: Brain Dump → plan → focus → complete | Phase 11 |

**Vitest over Jest**: no separate transform config needed for TypeScript/
ESM in a Next.js project, faster watch mode, and it's what the pure `lib/`
modules (this phase's actual test subjects) need — nothing Next.js- or
React-specific yet.

**No component or E2E tooling installed yet.** Installing Playwright or
Testing Library today, before a single test uses them, is exactly the
"interface with one implementation and zero callers" ADR-001 already
rejected for file storage. They're added at the phase that first needs
them.

## Consequences

### Positive

- `npm run test` in CI has real, meaningful tests from Phase 2 onward, not
  a placeholder
- The repository-contract-test pattern (same suite, two adapters) makes
  Phase 3's Postgres adapter provably behaviour-equivalent to the
  in-memory one, not just "looks right"
- Pure domain logic (Phase 4) stays cheap to test, because ADR-005 and
  D4 already keep it framework-free

### Negative / accepted

- No component or E2E coverage until later phases — accepted risk,
  bounded by the fact that Phase 2 has no feature screens yet to cover
  (the existing prototype UI is out-of-order early work, tracked in
  `IMPLEMENTATION_PLAN.md`'s progress checkpoints, not Phase 2's own scope)

## Revisit if

- Component-level bugs start recurring before Phase 5 formally begins —
  a signal to pull Testing Library forward rather than wait
- Vitest's Next.js compatibility regresses in a way that makes component
  testing painful when it's actually needed

## Verification

- [ ] `npm run test` runs Vitest and exits non-zero on a failing test
- [ ] `lib/extract.ts` and `lib/contrast.ts` each have a passing unit test
- [ ] CI runs `npm run test` on every push/PR

## References

- `docs/IMPLEMENTATION_PLAN.md` §1.2 D4, Phase 2, Phase 4, Phase 11
- `docs/adr/ADR-005-repository-boundary.md`
