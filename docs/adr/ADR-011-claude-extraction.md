# ADR-011 — Brain Dump extraction with Claude

- **Status:** Accepted — request shape verified against the SDK's types;
  **not yet verified against a live model** (see *Not yet verified*)
- **Date:** 2026-10-04
- **Deciders:** Product Owner (via PRD_v2.md §2.7.2), AI agent
- **Affects:** Phase 5 (Brain Dump extraction); later, task breakdown
- **Related:** [ADR-007](ADR-007-ai-fallback-policy.md) (fallback policy, unchanged),
  [ADR-009](ADR-009-deployment-environments-secrets.md),
  [ADR-010](ADR-010-observability-and-pii.md),
  [`../PRD_v2.md`](../PRD_v2.md) §1.9, §2.6, §2.7, **§2.7.2**
- **Supersedes:** [ADR-006](ADR-006-ai-integration.md)

---

## Context

PRD_v2.md §2.7.2 (the authoritative spec) decides: **Anthropic Claude**, via
the **native Anthropic SDK** (not an OpenAI-compatibility layer), with
**structured extraction** validated before it touches stored data, and
**prompt caching** on the stable prefix every Brain Dump re-sends. It also
rules that prioritisation, planning, capacity, and the Reality Check stay
deterministic engine work — only extraction, breakdown, and rare phrasing
call a model. ADR-006 contradicted this and is superseded.

## Decision

| | |
|---|---|
| **Client** | `@anthropic-ai/sdk`, server-side only — `lib/ai/client.ts`, imported by `app/api/extract/route.ts`, never by a client component |
| **Model** | `claude-opus-5-5` — a **code constant**, not an env var: `effort` and refusal fallbacks are model-specific, so swapping models is a reviewed change |
| **Structured output** | `client.beta.messages.parse` with `output_config.format` (`betaZodOutputFormat`) — see *Deviation* below |
| **Effort** | `low` — high-volume structured extraction, not open-ended reasoning |
| **Validation** | Two layers. The model is constrained to a deliberately **loose** schema (`lib/ai/schema.ts` `aiExtractionSchema`: shape only, no numeric bounds or date format); our **strict** `extractionProposalSchema` then validates it. A failure there is a fallback, never a stored proposal |
| **Prompt caching** | `cache_control` on the system prompt, which holds only stable content (instructions + the PRD worked example as a few-shot). "Now" and the timezone go in the user turn — putting them in the system prompt would miss the cache on every request |
| **Refusals** | Server-side refusal fallback enabled (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`); a refusal that survives it falls back to the heuristic |
| **Timeout / retries** | 30 s, `maxRetries: 0`. The heuristic is always there (ADR-007), so a retry buys less than the wait costs the user |
| **Credentials** | `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN` / an `ant` profile, which the SDK also resolves). None configured → heuristic, labelled "AI organising isn't set up" |
| **Logging** | Failure *reasons* and item counts only, never Brain Dump text (ADR-010) |

### Deviation from the PRD's letter: structured outputs, not tool use

§2.7.2 says extraction "uses Claude's tool-use mechanism with a declared
input schema." On the current model, forcing a specific tool
(`tool_choice` `any`/`tool`) returns a 400; the documented replacement when
a forced call only exists to get JSON back is structured outputs. This
honours the PRD's *intent* more strongly than tool use would: §2.7.2's own
caveat is that tool use "is a different guarantee from a strict
response-format constraint" — structured outputs **is** that stricter
constraint. The PRD's interface requirement (provider swappable behind an
interface) is met by `AiExtractor` in `lib/ai/client.ts`.

### Error → fallback reason

Checked most specific first (`APIConnectionTimeoutError` extends
`APIConnectionError` extends `APIError` in the TypeScript SDK):

| SDK error / outcome | Reason shown to the user |
|---|---|
| `APIConnectionTimeoutError`, `APIUserAbortError` | timeout |
| `APIConnectionError` | network |
| `RateLimitError` | rate_limited |
| No credential source at all — checked **before** calling (`hasClaudeCredentials`), because the SDK throws an untyped `Error` in that case | not_configured |
| `AuthenticationError` (a key that's present but rejected) | not_configured |
| `stop_reason: "refusal"` | refused |
| `stop_reason: "max_tokens"`, `parsed_output: null`, or our schema rejects it | invalid_response |
| any other `APIError` or exception | error |

## Consequences

### Positive

- Matches the authoritative PRD instead of contradicting it
- A malformed, truncated, or refused response can't reach storage — proven
  by `lib/capture/extract-with-fallback.test.ts`, not asserted
- Capture never blocks on the model: every failure path ends in a
  reviewable heuristic proposal, and the user is told which engine ran

### Negative / accepted

- **Prompt caching may not engage yet.** Each model has a minimum cacheable
  prefix; the current system prompt may be under it. It's wired correctly
  (stable content only, breakpoint set), so it engages once the prefix
  grows — e.g. when §2.7.2's per-user goal and project context is added.
  Check `usage.cache_read_input_tokens` once live.
- **`claude-opus-5-5` is not the "small, fast" model class** §2.7.2's
  routing table names for extraction. It's the default here pending a
  measured comparison; choosing a smaller model is a cost/quality call for
  the Product Owner, made against the golden fixtures below, not assumed.
- No streaming: extraction returns one complete structured object.

## Not yet verified

§2.7.2: *"Before the extraction pipeline is built on it, run the PRD's own
worked examples as a golden test set and confirm the schema holds."* That
needs a live, paid API call, which hasn't been made. What *is* verified:
the request compiles against the installed SDK's types (v0.131), and every
response-handling path is unit-tested against canned responses
(`lib/ai/client.test.ts`). Until the live golden run happens, treat AI
extraction quality as unproven — the heuristic path is the one that's
tested end to end.

## Revisit if

- The live golden run shows the schema doesn't hold, or extraction
  quality is poor → corrected schema/prompt and retry, or a different
  model (the `AiExtractor` interface exists for this)
- Cost per Brain Dump is measured and a smaller model holds quality
- Forced tool use returns on the chosen model and there's a reason to
  prefer it

## References

- `docs/PRD_v2.md` §2.7.2
- `lib/ai/client.ts`, `lib/ai/schema.ts`, `lib/ai/prompts.ts`
- `lib/capture/extract-with-fallback.ts`, `app/api/extract/route.ts`
