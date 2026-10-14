# ADR-013 — Move authentication to Supabase Auth

- **Status:** Accepted (2026-10-12)
- **Date:** 2026-10-12
- **Deciders:** Product Owner, AI agent
- **Supersedes (when accepted):** [ADR-003](ADR-003-authentication-strategy.md) (Better Auth)
- **Related:** [ADR-004](ADR-004-row-level-security.md) (RLS),
  [ADR-012](ADR-012-supabase-database-hosting.md) (Supabase hosting),
  [`../MOBILE_AND_PLATFORM_PLAN.md`](../MOBILE_AND_PLATFORM_PLAN.md)

## Context

The database already lives on Supabase (ADR-012), but sign-in is Better Auth
running inside the Next.js app, with its tables in `taskmaster_auth`. The
Product Owner wants Supabase Auth instead: hosted Google and email sign-in
managed from the Supabase dashboard, and a first-party Flutter SDK
(`supabase_flutter`) for the mobile app.

ADR-003 rejected hosted auth to avoid handing a Critical-risk subsystem
(PRD §1.11) to a third party. The data is already with Supabase, so that
objection is weaker now. The requirements it protected still stand:
- Sessions revoke immediately.
- Users are fully isolated from each other.
- Deleting an account deletes everything.

## Decision

| Area | Choice |
|---|---|
| Identity | **Supabase Auth**: email + password, email links (magic link, reset), Google |
| Web sessions | `@supabase/ssr`. Cookies are refreshed in `proxy.ts`. |
| Server check | `supabase.auth.getUser()` on every request, never `getSession()` alone. It asks the Auth server, so a signed-out or deleted session is rejected immediately (PRD §1.11), at the cost of one network call per request. |
| Data access | **Unchanged.** The server keeps using the restricted `taskmaster_app` role and sets `app.current_user_id` from the verified Supabase user ID. Every RLS policy and the isolation suite stay as they are. |
| User IDs | `public.users.id` = `auth.users.id`, the same pattern as today. `users.auth_id` references `auth.users(id) ON DELETE CASCADE`, so deleting the login deletes all data. |
| Mobile | `supabase_flutter` signs in, including native Google via `signInWithIdToken`. `/api/v1` accepts the Supabase access token as `Authorization: Bearer` and verifies it with `getUser(token)`. |
| Account deletion | Server-side `auth.admin.deleteUser()` with the secret key. Proof of identity: password, or a sign-in within the last 10 minutes (from the token's `amr` timestamps). |
| Google ↔ password linking | Email confirmation **on**, so Supabase only links identities that share a verified email. Manual linking (Settings → Connect Google) uses `linkIdentity`. |
| Email | Supabase sends auth email through **custom SMTP (Resend)**. The default SMTP is rate-limited to a few emails an hour. |
| Keys | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public. `SUPABASE_SECRET_KEY` is server-only and added to `check:client-bundle`. |

### Security work this creates

1. **Lock the Data API.** Once the publishable key is in every browser, anyone can call Supabase's auto-generated REST API (PostgREST) as `anon`/`authenticated`.
   - Today the policies return nothing to those roles, because `app.current_user_id` is unset.
   - Defence in depth: revoke all privileges for `anon` and `authenticated` on `public` and `taskmaster_auth`. The app never uses the Data API.
   - Verify with a test that calls the REST endpoint with the publishable key and expects 401/permission denied.
2. **Same-origin redirects only.** Configure Site URL and the redirect allow-list (production, previews, localhost) so the `/auth/callback` code exchange can't be redirected elsewhere.
3. **Supabase Auth settings:**
   - Minimum password length 10, matching today.
   - Leaked-password protection on.
   - Rate limits reviewed.
   - JWT expiry left at 1 hour. Revocation doesn't depend on it, because of the `getUser()` check.

## Plan

Each phase keeps CI green, and the old path is removed last.

1. **Infrastructure.**
   - Supabase CLI config in the repo (`supabase/config.toml`).
   - Local dev and CI run the Supabase local stack (Postgres + Auth + Mailpit) instead of bare Postgres. **This needs Docker.**
   - The e2e mail helper reads Mailpit instead of `/tmp` files.
   - A separate **staging** Supabase project for previews.
2. **Server and web.**
   - `lib/supabase/{server,browser,proxy}.ts`.
   - `lib/server/session.ts` → `getUser()`.
   - `proxy.ts` refreshes cookies.
   - Sign-up, sign-in, magic link, reset and Google move to `supabase-js`; new `/auth/callback` (code exchange) and `/auth/confirm` (email `token_hash`) routes.
   - Settings: identities list, Connect Google, password-or-recent-sign-in deletion.
   - Same UI as today; `AuthForm` only changes what it calls.
3. **Mobile.** `supabase_flutter` sign-in (email + native Google); the bearer token is the Supabase access token; drop the `Origin` workaround.
4. **Migrate accounts** (see open question 1).
   - A script creates each existing user in `auth.users` **with the same UUID** (admin API `id`), email marked confirmed, so no task data moves.
   - Passwords can't be carried over: Better Auth stores scrypt hashes and Supabase imports bcrypt/argon2 only. Migrated users set a new password through a one-time reset email, or sign in with Google or an email link.
   - Re-point `users.auth_id` at `auth.users`.
5. **Remove Better Auth.**
   - Drop the `taskmaster_auth` schema (after a backup), the `DATABASE_URL_AUTH` role, `scripts/auth-db-setup.mjs`, `lib/auth/*` and the `better-auth` dependencies.
   - Rewrite `accounts.db.test.ts` against Supabase Auth.
   - Update the README, OPERATIONS, and HARDENING evidence.

**Tests that must pass unchanged in meaning:**
- the e2e auth, account, Google, API and accessibility suites
- RLS isolation
- a deleted account leaves no rows behind
- a signed-out token is refused immediately
- the new Data API lock-down test

## Consequences

**Positive**
- Google, email, rate limiting and abuse protection are managed in one dashboard.
- The mobile app gets an official SDK, with native Google sign-in and token refresh handled.
- Less auth code to own: `taskmaster_auth`, its DB role and scripts go away.

**Negative / accepted**
- Docker becomes a requirement for local development and CI.
- Hard dependency on Supabase Auth's availability. Sign-in and every request's `getUser()` need it. Today only the database is a dependency.
- Existing password users must set a new password once.
- Supabase plan limits apply (monthly active users, auth emails); custom SMTP is required.

## Implementation notes (2026-10-12)

- **Local app data stays separate from local Auth.** Locally, Supabase Auth runs in the CLI stack while app data stays in the existing local Postgres. That keeps the throwaway dev, test and e2e databases, but it means `users.auth_id` can't be a foreign key to `auth.users`.
  - Deletion is enforced by the app instead: the delete route removes the `users` row first (everything cascades from it), then the login.
  - In Supabase, migration 0009 adds a trigger on `auth.users` that does the same for logins deleted elsewhere. The trigger and the cascade were verified in a real Supabase database.
- **Proxy:** `proxy.ts` reads and refreshes the cookie session with `getSession()`, which needs no network call unless refreshing. Pages and APIs verify with `getUser(token)` on every request.
- **"Signed in recently"** comes from the access token's `amr` timestamps, read after `getUser` has accepted the token.
- **Email links** use token-hash templates (`supabase/templates/`) that point to `{{ .RedirectTo }}`, which is always the app's own `/auth/confirm`. `next` is restricted to same-site paths.

## Resolved questions (2026-10-12)

1. **Existing accounts:** migrate with the same IDs. Password users set a new password once.
2. **Email confirmation:** required at sign-up.
3. **Docker:** accepted for local development and CI (Supabase CLI local stack).
4. **Staging:** a separate Supabase project for previews and testing.
