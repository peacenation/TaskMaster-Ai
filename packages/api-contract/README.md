# @taskmaster/api-contract

The contract for the versioned JSON API (`/api/v1`) the mobile app uses.

- Server: `apps/web/app/api/v1/**` (shared plumbing in `apps/web/lib/server/api.ts`)
- Client: `apps/mobile/lib/api/` (Dart models mirror the schemas below)

Change the spec, the route, and the Dart model in the same pull request.
`npm run api:lint` (from the repo root) validates the spec; the API's
behaviour is covered end to end by `apps/web/e2e/api.spec.ts`.

## Auth

Sign in with **Supabase Auth** (ADR-013): the mobile app uses
`supabase_flutter`, the web uses `supabase-js`. Send the Supabase session's
access token as `Authorization: Bearer <token>` on every call; the SDKs
refresh it before it expires. The server verifies each token with the Auth
server, so a signed-out, revoked or deleted session is refused at once.

Send `X-Time-Zone: <IANA zone>` so "today" is the device's day until the
user saves a time zone in Settings.
