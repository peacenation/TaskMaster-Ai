# TaskMasterAi — Mobile app and platform expansion

The plan for growing TaskMasterAi from a web app (plus a TWA wrapper) into a
web + native mobile product, and for the features in the October 2026 design
concepts: My Tasks (list/board), AI Planner chat, Calendar, and team
collaboration. Companion to `IMPLEMENTATION_PLAN.md` (phases 1–12, the web
MVP).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Repo layout | Monorepo, npm workspaces: `apps/web`, `apps/mobile`, `packages/api-contract` | One place for the contract, one PR for a feature across both clients |
| Mobile stack | Flutter, Android + iOS | One native codebase; the TWA could not do offline, push, or native UI |
| Mobile backend | The existing Next.js app, through a versioned JSON API (`/api/v1`) | Planning, scoring and capture logic stay in one place (`apps/web/lib/domain`); RLS stays the only path to data |
| Mobile auth | Supabase Auth via `supabase_flutter` (ADR-013); the access token goes to `/api/v1` as `Authorization: Bearer` | One auth system for web and app; the server verifies every token, so revocation is immediate |
| Contract | `packages/api-contract/openapi.yaml`, linted in CI; Dart models hand-written to match | Small surface today. Generate the Dart client once the API passes ~15 endpoints |
| Android identity | Flutter app reuses the TWA's `applicationId` and release key, versionCode 2+ | Existing installs upgrade in place instead of needing a reinstall |

## M0 — Foundations (done)

- Moved the web app to `apps/web`, keeping git history. Root `package.json` scripts proxy to it.
- **`/api/v1`:** `me`, `today`, `tasks` (with `view=today|upcoming|all|inbox`, plus Quick Add via POST), `tasks/{id}/status`, and `projects`.
  - Today's loading moved to `lib/server/today-view.ts`, which both the web page and the API use.
  - `apps/web/e2e/api.spec.ts` covers bearer sign-in, 401/400/404 handling, and revocation on sign-out.
- **Flutter app (`apps/mobile`):**
  - Design tokens mirror the web's.
  - Screens: sign-in, Today (Next Best Action, stats, priorities, next block), My Tasks (views, one-tap complete, Quick Add), Projects (progress), and an AI tab showing today's planned timeline.
  - Session token in secure storage; any 401 returns to sign-in.
  - 11 widget/model tests.
- **CI:** web steps run in `apps/web`. New `api-contract` job (lint) and `mobile` job (format, analyze, test).

**Manual steps still needed:**
- Set Vercel **Root Directory → `apps/web`** (docs/OPERATIONS.md) before the next deploy.
- Confirm the iOS bundle identifier (currently Flutter's generated `app.vercel.taskmasteraiomega.taskmaster`) and the production API host. The production host is in `apps/mobile/lib/config.dart`, and it changes if you move off `*.vercel.app`.
- Builds: Android debug APK builds. iOS needs Xcode on the build machine (not verified yet).

## M1 — Mobile daily-loop parity

Goal: someone can run their whole day from the phone.

1. **Sign-up, Google sign-in, magic link and password reset on mobile.**
   - Google on the phone uses native Google Sign-In (`google_sign_in`, with Android and iOS OAuth client IDs). It sends the ID token to `POST /api/auth/sign-in/social` (`{provider: "google", idToken: {token}}`), and the same linking rules as the web apply. Magic links need app links on Android (`assetlinks.json`, which already exists for the TWA) and universal links on iOS (`apple-app-site-association`).
2. **Brain Dump and review on mobile.**
   - API: `POST /api/v1/dumps` runs the existing extraction behind the AI quota, and `POST /api/v1/dumps/{id}/commit` saves it.
   - Reuses `lib/capture` and `lib/ai` unchanged.
3. **Task detail and edit, breakdown, and dependencies.**
4. **Focus timer.** Timer state lives on the device; status changes go through `tasks/{id}/status`.
5. **Recovery check-in and Reality Check decisions.** Today currently says "N decisions are waiting on the website"; that message goes away.
6. **Plan settings and time zone** (Settings).
7. **Offline reads.** Cache Today and My Tasks; queue Quick Add and completions, replaying them when back online. The server must be idempotent for replays: add an `Idempotency-Key` header to mutating endpoints.
8. **Push notifications** (FCM/APNs) for the next planned block and deadline warnings. Needs a `devices` table, opt-in, and quiet hours.
9. **Release:**
   - Play Store: versionCode 2 upgrades over the TWA.
   - App Store: new listing.
   - Then delete `android/` and the TWA-only proxy exemption.

## W1 — Web redesign, remaining screens

From the desktop concepts, on the existing design system:

- **My Tasks page** (`/tasks`):
  - List view (Task, Project, Due, Priority, Status columns) grouped Today / Upcoming / Completed.
  - Board view: columns by status, drag to change status through the same `changeStatus`.
  - Today/Upcoming/All filters.
- **Global search** in a top bar. Postgres full-text search over task title/description and project names, RLS-scoped. Also served at `GET /api/v1/search`.
- **Projects grid** with progress, task counts and tags; a project detail page with In progress / To do groups.
- Branded sign-in and sign-up pages; the top bar with avatar and account menu.

## M2/W2 — Calendar

The planner needs to know about meetings: they are the biggest gap between
"available minutes" and reality.

1. **Data:**
   - An `events` table: `user_id`, `title`, `starts_at`, `ends_at`, `all_day`, `source` (`manual` | `google` | `microsoft`), `external_id`. RLS like every other table.
   - Planned blocks (`plan_items`) render alongside events without being copied into them.
2. **Planning:** available minutes for a day subtract event time, and scheduled blocks route around events. This is a change to `lib/domain/plan.ts`, with unit tests that extend the PRD worked examples.
3. **UI:**
   - Web: Day / Week / Month views and "New event".
   - Mobile: Day and Week, plus "Next event" on Today (the concept's card).
4. **Sync (later, opt-in):** Google and Microsoft calendars, read-only first, via OAuth. Tokens are encrypted at rest, revocable from Settings, and included in account export/delete.

## M3 — AI Planner chat

"Plan my day around my 2pm meeting" → a proposed timeline → **Apply** or **Adjust**.

- **Endpoint:** `POST /api/v1/planner/messages`, streamed. Claude gets tools that read tasks, today's plan, and calendar events, plus one that **proposes** a plan as structured output (the same `Plan` shape the deterministic planner produces).
- **Nothing changes until the user applies:** the proposal is shown as AI-suggested (caramel), the PRD's challenge-don't-control rule. Applying saves through the existing `plans`/`plan_items` path, with the reasons attached.
- **Limits:** counts against the existing per-user AI quota (`ai_usage`). Conversations are stored per user, are deletable, and are included in export.
- **Guardrails:** the planner can't create, drop or reschedule tasks on its own. Deadlines are never moved silently, and an overloaded day still triggers Reality Check.
- **Quality:** an eval set of day scenarios (busy afternoon, overloaded day, empty day) runs in CI against recorded responses.

## T — Team collaboration

The largest change, because today every table and RLS policy is strictly per user. **Write an ADR before starting.**

1. **Model:**
   - `workspaces`, `memberships` (role: owner, member, viewer), and `invitations`.
   - Projects and tasks gain `workspace_id`. Personal work lives in each user's personal workspace.
   - Task `assignee_id`.
2. **RLS:** policies move from `user_id = current_user` to "member of the row's workspace", with role checks for writes. This needs its own migration plan and the isolation test suite rewritten to cover cross-workspace leaks.
3. **Planning stays personal:** Today plans only work assigned to me, or unassigned work in my personal workspace. Team work enters my plan by assignment.
4. **Features:** invitations (email), member avatars on projects (the concept), an activity feed, @mentions, and notifications. Shared projects and assignment ship first; comments and the activity feed come later.
5. **Account deletion and export** define what happens to shared data. Ownership transfer is required before deleting a workspace owner.
6. **Commercial:** the concepts' "Upgrade / Pro" box implies plans and billing, which is a separate decision (pricing, Stripe, entitlements). Until that's decided, the slot links to Brain Dump.

## Suggested order

M1 (daily loop on phone) → W1 (web screens) → M2/W2 (calendar) → M3 (AI
planner, which is better with calendar data) → T (collaboration).
Each phase ships to web and mobile together, behind the same `/api/v1`
contract.
