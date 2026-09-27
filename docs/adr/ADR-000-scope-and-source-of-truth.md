# ADR-000 — Scope and source of truth

- **Status:** Accepted
- **Date:** 2026-09-27
- **Deciders:** Product Owner, AI agent
- **Affects:** every phase of the build
- **Supersedes:** nothing
- **Superseded by:** nothing

---

## Context

The repository contained two product requirements documents at the start of the
build, and they disagreed on the most consequential question in the project:
what the product's architecture is.

**`PRD.md` (v1)** — a 1,525-line document. §1–§22 are a product vision and a
flat catalogue of 49 features. §23 is an annex added for an "AI Foundry
Lesson 6" assessment, describing a **narrowed local prototype**:

> "A database is **not** required for the Lesson 6 prototype: the product is
> single-user and browser-resident" (§23.4)
>
> "**None.** Not required — the prototype stores no data outside the browser and
> has no backend that holds user data." (§23.4, Authentication)

**`PRD_v2.md` (v2.0)** — a 1,293-line restructure into four delivery
phases with P0/P1/P2 priorities. Its Phase 1 feature table lists these as **P0**:

- User Account — sign up, sign in, sign out
- Cloud Persistence — store user data securely in a cloud database
- Cross-Device Access — same account from desktop and mobile browsers
- Account/Data Deletion

and §1.8 commits to "a **cloud-based responsive web application**" with the
architecture **Responsive Web App → Authentication → Cloud Database →
Application/API Layer → AI Service**.

### The conflict

| Topic | v1 §23.4 | v2.0 |
|---|---|---|
| Architecture | Local prototype | Cloud web app (§1.8) |
| User accounts | "Not required" | **P0** (§2.2) |
| Database | "not required" | **P0** (§2.2) |
| Cross-device | Not addressed | **P0** (§2.2) |
| Persistence | localStorage | Relational cloud database |
| Acceptance criteria | C1–C11 (11 items) | 22 items (§2.10) + per-phase sets |

This is not a wording difference. The two documents imply different data layers,
different security models and a different amount of work — on the order of 60
hours and roughly $5,000 at a mid-level rate.

### Which document is later?

v2.0. Its own change log (§7.8) records the restructure as a deliberate
decision, including the entry "moved technical prototype/assessment history out
of the main product specification". v1's §23 preamble likewise states that the
annex "**does not replace** the product vision, principles, feature catalogue, or
MVPs defined above" — that is, §23 describes a narrowed exercise *within* the
product, not the product's target architecture.

v1 §23 also records its own scope as a narrowing: "**Product Owner Decision:**
Narrow Lesson 6 work to a focused working prototype that demonstrates only the
central capture → organise → prioritise → plan → focus → complete journey,
deferring everything else."

So the two documents are not equally weighted specifications. §23 is an
assessment artefact that explicitly defers to the wider product, while v2.0 is
the product specification.

---

## Decision

**D1 — `PRD_v2.md` is the sole authoritative specification.**

Build targets, feature priorities and acceptance criteria are taken from v2.0
only. If any other document conflicts, v2.0 wins.

**D2 — Build v2.0 Phase 1 in full, including accounts, cloud persistence and
cross-device access.**

These are P0 in v2.0 §2.2 and are required by 4 of its 22 acceptance criteria in
§2.10: account creation and sign-in/out, secure cross-session persistence,
cross-device access, and account/data deletion.

**D3 — Enforce the v2.0 architecture: cloud-based, authenticated, relational
cloud database, cross-device, server-side AI calls.**

A local-only or browser-storage variant is not in scope. The AI provider key is
never exposed to the client (§1.9).

### Supporting decisions taken at the same time

| # | Decision | Consequence |
|---|---|---|
| **D4** | Storage sits behind a **repository interface**; domain and UI layers never import a database client | Preserves the option to run locally for demos, dev and tests. Makes D2's retrofit risk small rather than large. Costs a few hours up front |
| **D5** | Domain logic is **pure and framework-free**; all time injected, no ambient `Date.now()` | Makes the prioritisation and planning engine testable. Required for the Phase 4 test suite to be cheap |
| **D6** | Design system ships **before** the architecture is locked, built on framework-agnostic **CSS custom properties** | Honours the requested phase order without a false dependency; Phase 1 work survives a Phase 2 change of styling approach |
| **D7** | `PRD.md` (v1) is **archived, not deleted** | Preserves product history and the §1–§22 vision, while removing the risk of building against the wrong architecture |

---

## Consequences

### Positive

- **One specification.** Nobody — human or AI agent — can open the wrong
  document and quietly build the wrong product. The v1 file carries a
  superseded banner naming the conflict; the v2 file carries an authority
  banner.
- **The acceptance criteria are testable.** v2.0's 22 §2.10 items are specific
  and independently verifiable, which v1's C1–C11 are not.
- **Security is decided early.** v2.0 §1.11 rates exposure of productivity data
  as Low/Medium likelihood and **Critical** impact. Choosing cloud + auth up
  front means row-level security is designed in from Phase 3, not retrofitted.
- **Cost is known.** Tiered estimates in `IMPLEMENTATION_PLAN.md` §7 rest on a
  settled scope.

### Negative / accepted

- **Higher cost than the v1 route.** Roughly 60 hours and ~$5,000 more than a
  localStorage prototype, because accounts, session handling, migrations and RLS
  are real work.
- **Infrastructure is now a dependency.** A managed Postgres and auth provider
  are required to run the product at all. Local development needs either
  credentials or the D4 in-memory adapter.
- **v1's §23 is no longer a build target.** If a Lesson 6-style prototype is
  ever needed again, it is a separate, explicitly scoped exercise — not the
  default reading of this repository.

### Neutral

- Nothing in v1 §1–§22 is lost. The product vision, principles, feature
  catalogue, responsibility areas and free-vs-premium positioning were carried
  into v2.0, and v1 remains readable in `archive/`.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| **Treat v1 §23 as the build target** (localStorage prototype, no auth, no DB) | Fails 4 of v2.0's 22 acceptance criteria on day one. Contradicts v2.0 §1.8–§1.9, which are the committed architecture. Cheaper, but builds a different product |
| **Keep both documents live and reconcile at read time** | Two documents with contradictory architecture instructions is a standing source of scope drift — the exact risk v2.0 §6 rates as High likelihood / High impact. Relies on every reader resolving the conflict correctly, every time |
| **Delete v1 entirely** | Discards the §1–§22 product reasoning and the §23 assessment record. Not reversible. Archiving achieves the same safety at no cost |
| **Merge v1's §23 into v2.0 as a phase** | §23 was explicitly a narrowed *assessment* scope, not a product phase. Reintroducing it would re-import the contradiction this ADR resolves |
| **Build local-first, add cloud in a later phase** | Rejected as the *default*. Retained as a fallback via D4: if the budget collapses, the repository interface means a local-only build is a configuration change rather than a rewrite |

---

## Revisit if

- The Product Owner decides the Lesson 6 prototype scope *is* the target. In
  that case this ADR is superseded and D2 is reversed; D4 exists to make that
  reversal cheap.
- Accounts and cross-device are formally moved from P0 to a later phase in
  v2.0. Note that v2.0 §7.7 requires a feature that does not help prove the
  Phase 1 hypothesis to be deferred, so this is a legitimate move — but it must
  be made by editing v2.0, not by resurrecting v1.
- A third specification document is introduced. Then this ADR must be rewritten
  to state which of the three wins, before any of them is used.

---

## Verification

- [x] `docs/PRD_v2.md` carries an authority banner naming itself as
      the single source of truth
- [x] `docs/archive/PRD_v1.md` carries a superseded banner naming the conflict
      and the reasons
- [x] `docs/README.md` indexes the document set and states which wins
- [x] `docs/IMPLEMENTATION_PLAN.md` §1.2 records D1–D5 and §12 recommends this
      change
- [ ] `docs/REQUIREMENTS.md` exists, mapping every v2.0 §2.2 P0 item to a build
      phase — *Phase 0 output, not yet created*
- [ ] Every §2.10 acceptance criterion is mapped to a phase — *Phase 0 output,
      not yet created*

## References

- `docs/PRD_v2.md` §1.8, §1.9, §1.11, §2.2, §2.10, §6, §7.7, §7.8
- `docs/archive/PRD_v1.md` §23.4 (architecture), §23.3 (C1–C11), §23.1
- `docs/IMPLEMENTATION_PLAN.md` §1.1, §1.2, §7, §12
