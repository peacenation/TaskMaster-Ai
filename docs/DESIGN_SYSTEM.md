# TaskMaster — Design System

Token reference and usage rules for Phase 1 (`docs/IMPLEMENTATION_PLAN.md`
§Phase 1 — Design system). Live rendering of everything below:
[`/design`](../app/design/page.tsx) (run `npm run dev`, visit `/design`).

This is a coded, in-app system now — `design.html` at the repo root is the
earlier static preview kept for history; it is not updated further.

## Token tiers

Three tiers, all as CSS custom properties in `app/globals.css`, deliberately
separable so a theme change never touches component code:

1. **Primitive** — raw values (`--color-cream-50`, `--color-coffee-600`,
   `--space-4`, `--radius-md`). Never referenced directly from a component.
2. **Semantic** — intent (`--surface-page`, `--text-muted`,
   `--action-primary`, `--ai-suggestion-bg`, `--danger`). Components only
   ever use semantic tokens.
3. **Component** — only where a primitive pairing is genuinely reused
   across more than one primitive (none needed yet beyond the semantic
   tier).

## Colour

Warm cream/brown palette (see PRD_v2.md §2.8.1 for why: a "more modern,
cream and brown" refinement requested during the design-preview review).
AI-suggested state uses a distinct terracotta hue rather than a shade of
brown, so it can never be confused with the primary action colour.

| Semantic token | Role |
|---|---|
| `--surface-page` / `--surface-card` / `--surface-sunken` | Page background, raised card, recessed area |
| `--text-primary` / `--text-muted` / `--text-subtle` | Body text, secondary text, least-emphasis text |
| `--action-primary` / `--action-primary-hover` | The one obvious primary action per screen (PRD §2.8) |
| `--ai-suggestion-bg` / `--ai-suggestion-border` / `--ai-suggestion-text` | AI-recommended state — must stay visually distinct from confirmed state |
| `--danger` / `--danger-hover` / `--danger-subtle` | Destructive actions only, never used for primary actions |
| `--success` | Confirmed/completed state |
| `--focus-ring` | Keyboard focus indicator on every interactive primitive |

## Dark mode

Light values live on `:root`. Dark values apply two ways:

- `@media (prefers-color-scheme: dark)`, guarded by `:root:not([data-theme="light"])`, so an explicit "light" override still wins even when the OS prefers dark.
- `:root[data-theme="dark"]`, an explicit toggle (used by the `/design` System / Light / Dark switch).

Dark neutrals use a separate `--color-coal-*` primitive scale and dark text
uses `--color-sand-*`, rather than just dimming the light values — several
light-mode primitives (e.g. the tan border) don't have enough contrast
range left to survive naive inversion.

## Contrast policy

- Normal text: **≥ 4.5:1** (WCAG 2.1 AA)
- Large text and non-text UI boundaries (input/button borders, focus
  rings): **≥ 3:1** (WCAG 1.4.11)

The audit is **live**, not a hardcoded table: `/design`'s "Contrast audit"
section resolves each token pair's actual rendered colour via a DOM probe
(`getComputedStyle` on an element with `color: var(--token)`) and computes
the ratio with `lib/contrast.ts` (pure functions, no DOM — reusable by the
Phase 4 domain engine's test suite later). Toggling the theme switch
re-runs the audit against whichever theme is active.

Two real failures came out of this pass and were fixed at the token level
rather than patched per component:

- `--color-sage-600` (success text on card) was 4.33:1 — under the 4.5:1
  text minimum. Darkened to `#5c6f3f` (5.44:1).
- `--border-strong` (the border `Input`, `Textarea`, and `Button
  variant="secondary"` all use) was ~1.3–1.7:1 against the card surface in
  both themes — nowhere near the 3:1 UI-boundary minimum. Replaced with
  `--color-tan-500` (`#a8895f`, 3.23:1) in light mode and `--color-coal-600`
  (`#8a7256`, 3.54:1) in dark mode.

`--border-default` (used for plain section/header dividers, not an
interactive component's boundary) is intentionally left low-contrast —
WCAG 1.4.11 applies to UI component boundaries, not decorative dividers.

## Primitives

`components/ui/`: `Button`, `Input`, `Textarea`, `Select`, `Field`, `Card`
(variants: `default` | `ai` | `confirmed`), `Badge`, `Chip`, `EmptyState`,
`Skeleton`, `Modal`, `ConfirmDialog`, `Toast`.

Rules that apply to every primitive:

- **No hard-coded colour, spacing, or radius** — every value comes from a
  semantic token.
- **Keyboard-operable with a visible focus ring** — `.btn`, `.input`,
  `.textarea`, `.select` all get `:focus-visible { outline: 3px solid
  var(--focus-ring) }`.
- **Touch target ≥ 44px** — `min-height: 44px` on `Button`, `Input`,
  `Textarea`, `Select`.
- **`Modal` / `ConfirmDialog`**: Escape closes, backdrop click closes,
  focus moves into the dialog on open. This is a baseline, not a full
  focus trap (Tab can still reach the page behind the overlay) — the full
  accessibility pass is Phase 11 (hardening), tracked there rather than
  built ahead of need here.
- **`Toast`** is presentational only. No global toast manager/queue exists
  yet — add one when a feature first needs to fire a toast imperatively.

## Usage rule

Feature code imports primitives from `@/components/ui`, never raw
`className="btn"` strings — `app/page.tsx` does this already. If a screen
needs a look a primitive doesn't support, extend the primitive (add a
variant/prop) rather than reaching for an inline style or a new ad hoc
class.
