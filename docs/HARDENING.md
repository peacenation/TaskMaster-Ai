# Hardening report (Phase 11)

Evidence for PRD v2 §1.11 (non-functional requirements), §2.7 and §2.10.
Everything marked ✅ is checked by an automated test that runs in CI, except
where the row says *local*. Last full run: 2026-10-05, all green.

| Suite | Count | Where |
|---|---|---|
| Unit | 250 tests, 99.5% line coverage of `lib/domain` (CI fails below 85%) | `npm run test:coverage` |
| Database | 37 tests on real Postgres: RLS isolation on all 11 user tables, repositories, auth, AI quota, Procrastination Assist trigger | `npm run db:test` |
| End-to-end | 44 Playwright tests × desktop and Pixel 7: all 22 §2.10 criteria, accessibility, security, performance | `npm run e2e` |
| Visual | 4 screens × 2 viewports, macOS baselines (*local*: skipped in CI) | `e2e/visual.spec.ts` |

## 1. Acceptance criteria (§2.10)

Each of the 22 criteria maps to a named Playwright test (`§2.10 #n — …`) in
`e2e/auth.spec.ts`, `capture.spec.ts`, `today.spec.ts` and
`account.spec.ts`, so a failure names the requirement it breaks. All pass
on desktop and phone width.

## 2. Accessibility: WCAG 2.1 AA

**Automated (✅):** `e2e/accessibility.spec.ts` runs axe-core with the
`wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` rules on 17 states, at desktop
and 412px phone width:

- public: `/signin`, `/signup`, `/reset`, `/magic`, `/privacy`
- Brain Dump: compose and review
- signed in: `/`, `/inbox`, `/projects`, `/goals`, `/responsibilities`,
  `/focus`, `/settings`, `/reviews/daily`, `/reviews/weekly`, `/tasks/new`

Result: **0 violations.** Found and fixed along the way: links in body text
were distinguishable by colour alone (1.4.1), so they are now underlined.
Design-token colour pairs are also checked against AA contrast ratios in
`lib/contrast.test.ts`.

**Keyboard (✅ for the core loop):** the Next Best Action is reachable by
Tab and completable with Enter, and the plan updates (`today.spec.ts`). All
controls are native buttons, links and form fields with visible focus
styles.

**Not yet done:** a manual screen-reader pass (VoiceOver/NVDA) through
capture → plan → complete. Automated tools find roughly a third of real
issues, so this pass is still owed before calling accessibility complete.

## 3. Security review

| Check | Result | Evidence |
|---|---|---|
| RLS on every user table | ✅ | `lib/db/isolation.test.ts` enumerates every table with an ownership column (11), requires forced RLS and a policy, and checks cross-user select/insert/update/delete per table |
| App connects as a role that can't bypass RLS | ✅ | `taskmaster_app`: no superuser, no `BYPASSRLS`; `db:check` verifies this in the hosted database |
| Auth on every route and API | ✅ | `proxy.ts` gate plus a session check in every page, action and handler; e2e: unauthenticated API calls get 401, and a revoked session can't read data |
| Immediate session revocation | ✅ | Cookie cache disabled; e2e regression test |
| No secrets in the client bundle | ✅ | `check:client-bundle` builds with sentinel values for every server secret and scans static JS and prerendered pages |
| Input validation at boundaries | ✅ | Zod schemas on every server action and route body; UUID path parameters validated before queries |
| Rate limiting: auth | ✅ | Better Auth limiter, stored in the database so it holds across serverless instances |
| Rate limiting: AI | ✅ | Per-account hourly quota (`ai_requests`, advisory-locked; DB test proves concurrent requests can't exceed it). Kill switch `AI_EXTRACTION=off` |
| No task content in logs or error reports | ✅ | `instrumentation.ts` reports route, error class, SQLSTATE and digest only (unit-tested to exclude message, stack and query string); fallback logs carry ids and counts only |
| Email content | ✅ | Reset and magic-link emails contain only a link |
| Export injection | ✅ N/A | Export is JSON only (`application/json`, `attachment`, `nosniff`, `no-store`), with no CSV, so spreadsheet formula injection can't arise |
| Security headers | ✅ | CSP, `frame-ancestors 'none'`, HSTS, nosniff, referrer and permissions policies; e2e checks they are sent and no page logs a CSP violation |
| CSRF | ✅ | Server actions check Origin (Next.js); auth endpoints check Origin (Better Auth); session cookie is `SameSite=Lax` |
| Secrets in git history | ✅ | All commits scanned; only documentation placeholders |
| AI processing disclosed | ✅ | Public `/privacy`, linked from sign-up, Brain Dump and Settings; states live whether AI is on (e2e) |
| Dependency audit | Accepted | `npm audit`: 4 moderate, all one advisory (esbuild's dev server reading cross-origin requests), reached only through the `drizzle-kit` CLI. Its server is never run, and nothing esbuild-related ships to production |

**Findings:**

| Severity | Finding | Status |
|---|---|---|
| **High** | Supabase `postgres` and `taskmaster_auth_service` passwords were printed in a development terminal session | **Open: rotate both** (`docs/OPERATIONS.md` → Rotating secrets). The only open High |
| Low | CSP allows `'unsafe-inline'` scripts (Next.js bootstrap scripts without per-request nonces) | Accepted: all script sources are same-origin, there's no user-supplied HTML, and React escapes output. Revisit with nonce-based CSP |
| Low | Visual regression runs only locally (OS-specific baselines) | Accepted; Linux baselines could be committed from CI later |

## 4. Performance

Measured by `e2e/performance.spec.ts` on a production build, under a
throttled connection (1.6 Mbps down, 750 Kbps up, 150 ms round trip: roughly
slow 4G). Three runs each, Chromium desktop:

| Interaction | Budget | Measured |
|---|---|---|
| Today, first visit (empty cache) | 4,000 ms | 1,571–1,587 ms |
| Today, return visit | 4,000 ms | 222–235 ms |
| Brain Dump: Organise → review shown | 2,500 ms | 821–831 ms |
| Complete a task → plan updated | 2,500 ms | 726–751 ms |
| Today with **600 open tasks** | 4,000 ms | 399–415 ms |

A regression past any budget fails CI.

**Large backlogs:** Today renders the plan, every task due within 24 hours,
and the top 10 of the rest ("And N more — see all tasks"). At 600 tasks,
this cut the load from ~1,220 ms to ~410 ms and the rows from ~590 to 33. The
recommendation still works.

**Not measured:** Claude extraction latency. Live AI calls are disabled in
tests. The UI shows a processing state, and a 30-second timeout falls back
to the built-in rules.
