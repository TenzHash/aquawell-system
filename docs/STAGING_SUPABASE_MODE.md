# AquaWell staging: Supabase-only mode

## What changed

- `.env.example` now sets `VITE_DATA_MODE=supabase`.
- Mock mode is opt-in only (`VITE_DATA_MODE=mock`). Missing/placeholder Supabase credentials no longer silently activate browser-local mock data.
- `src/lib/mockData.ts` remains in the source tree because older demo-mode branches still reference its exports. Those branches are inactive in Supabase mode. This is not a full deletion of demo code.

## Configure local staging

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` to your new staging project's URL.
3. Set `VITE_SUPABASE_ANON_KEY` to the project's publishable key (or legacy anon key if your project exposes that name).
4. Keep `VITE_DATA_MODE=supabase`.
5. Restart Vite after changing environment variables.
6. If credentials are missing, the app should show setup/configuration guidance rather than seed browser-local demo accounts.

Never put a database password or service-role/secret key in a `VITE_` variable.

## Important integration status

Disabling mock mode does not by itself prove every frontend query/RPC matches the fresh-install SQL migration. Before end-to-end testing, apply the reviewed migration to the empty staging project, bootstrap an administrator using Supabase Auth, and validate each portal. Fix any query, status-vocabulary, foreign-key, RLS, or RPC mismatch surfaced by the first tests. Do not use this package in production without that validation.
