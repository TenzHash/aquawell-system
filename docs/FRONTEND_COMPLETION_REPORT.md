# AquaWell Frontend Completion Pass

## Source used

This pass uses the latest uploaded `aquawell-source(1).zip` as its source of truth. Existing screens and project structure were retained; changes are focused on the requested frontend checklist.

## Changes made in this package

1. **Profile editing**
   - Added `src/features/auth/ProfileEditor.tsx`.
   - Provides editable full name, phone, address, barangay, and landmark fields.
   - Adds client-side validation, busy state, accessible success/error messages, and persists through the signed-in user's `public.profiles` row.
   - Requires an appropriate `UPDATE` RLS policy on `public.profiles`; live database policy behavior was not testable from this source archive.
2. **Password-change feedback**
   - Existing current-password check and new-password confirmation/minimum-length validation remain.
   - Success/error feedback now announces status to assistive technology.
3. **Central role resolution and page access**
   - Added `normalizeRole` and `canAccessPage` in `src/lib/data.ts`.
   - Profile role validation uses the same normalizer.
   - Navigation requests are checked against a role-specific page allowlist; unsupported pages return to Overview.
   - Added Account navigation for Admin, Staff, and Delivery so those roles can access password/profile settings.
   - Removed the Staff Inventory menu item and Staff dashboard inventory shortcut, consistent with the project's stated role separation.
   - This is client-side navigation gating, not a substitute for Supabase RLS and RPC authorization.
4. **Admin data loading**
   - Admin loader now assigns the fetched sales, profiles, and audit-log arrays to the returned overview data. Previously, those queries succeeded but their results were not added to the returned object.
5. **Mobile/theme safeguards**
   - Added min-width safeguards for flex/grid containers, contained horizontal scrolling for wide tables, mobile single-column profile/password forms, and safe-area padding.
   - Profile fields, select/textarea controls, and feedback states use the shared theme variables in dark mode.
   - The app already owns a single persisted theme state in `App.tsx`; the CSS additions extend the same root theme rather than adding another state source.
6. **Environment hygiene**
   - Removed the uploaded `.env` from the deliverable and added `.env.example`. Re-create your local `.env` from that template with your own Supabase project URL and publishable/anon key.

## Verification status

| Check | Status | Notes |
|---|---|---|
| ZIP extraction | Passed | Source archive extracted successfully. |
| Source edits | Applied | Files listed above were changed in this package. |
| Dependency install | Blocked | `npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` timed out in this environment. |
| Production build | Not verified | `npm run build` cannot start because Vite is not installed; dependency installation did not complete. |
| TypeScript check | Blocked | Global `tsc --noEmit -p tsconfig.json` cannot resolve React, Lucide, Vite, and related types because dependencies are unavailable. The resulting JSX/type errors are therefore not a valid source-only pass/fail result. |
| Profile editing against Supabase | Not verified | Requires the user's live Supabase project and suitable profile UPDATE RLS policy. |
| Password change against Supabase | Not verified | Requires authenticated test accounts and a reachable Supabase Auth service. |
| Role tests | Not verified | Requires test accounts for Admin, Staff, Delivery, and Customer. |
| Theme/mobile visual regression | Not verified | Requires running the app in a browser at desktop and mobile viewport sizes. |

## Required local verification before marking the frontend complete

1. Run `npm ci` from the project directory.
2. Copy `.env.example` to `.env` and fill in the Supabase URL and publishable/anon key.
3. Run `npm run build` and resolve any actual compiler/build errors.
4. Sign in separately as Admin, Staff, Delivery, and Customer. Verify each role only sees its permitted navigation and direct page requests return to Overview when disallowed.
5. For every role, test profile update and password change with valid and invalid input. Confirm success and failure messages and reload to verify persistence.
6. Test light/dark theme on Overview, Account, tables, dropdowns, forms, and dialogs.
7. Test at 320px, 360px, 390px, 768px, and desktop widths. Confirm no page-level horizontal scroll; tables may scroll inside their own table wrapper.
8. Exercise delivery status actions against a test order and verify the order/payment state in Supabase. Do not use real customer orders for regression testing.

## Important limits

This package is a frontend completion pass, not a production release. It does not supply missing SQL migrations or prove transactional order processing, payment-to-sales synchronization, inventory deduction, RLS correctness, or delivery-state integrity. Those require a separate database/backend verification pass.

## Mock demo stabilization pass (2026-10-11)

### Defects corrected

- Reset now clears the demo session as well as the stored demo password overrides; the demo storage key was versioned so older inconsistent browser data cannot silently survive the corrected seed.
- Delivery completion and pickup completion no longer set payment to `PAID`. Payment verification is a separate explicit action.
- Demo payment verification synchronizes the order payment state and creates at most one sale per order. Reverting payment to a non-paid state removes the associated mock sale.
- Walk-in demo transactions now validate inventory and quantities, calculate the total from current catalog prices, require the submitted total to match, deduct stock, create a completed Cash payment, and record one sale/audit event.
- Demo order confirmation prevalidates every line before stock changes and tracks whether stock has already been deducted, preventing repeated confirmation from double-deducting.
- Added a delivery rejection action for assigned, confirmed deliveries; rejecting clears the assignment so staff can reassign it.
- Replaced the previous revenue-average placeholder forecasts with per-inventory-item demand forecasts based on actual paid `orderItems` quantities. Weights are newest 50%, previous 30%, oldest 20% for daily, weekly, and monthly periods.
- The walk-in modal now stays open when the action fails and closes only after a successful submission.
- Added `docs/SUPABASE_FRONTEND_CONTRACT.md` to define the atomic RPC, status, payment/sales, RLS, and forecast expectations before switching to Supabase.

### Validation performed

| Check | Result | Notes |
|---|---|---|
| TypeScript/TSX syntax transpilation | Passed | Transpiled all `.ts` and `.tsx` source files with the globally available TypeScript compiler. |
| Mock workflow behavior test | Passed | Exercised demo login, stock confirmation/idempotency, fulfillment/payment separation, payment-to-sale idempotency, walk-in cash transaction, forecast row generation, invalid total rejection, and reset sign-out. |
| Full TypeScript type check | Blocked | Project dependencies (`react`, `lucide-react`, etc.) are not installed in the environment, so `tsc` reports missing module/JSX types. |
| Production Vite build | Blocked | `vite` is not installed. `npm ci` could not complete in the current environment. |
| Browser/mobile visual QA | Not performed | Requires launching the app with dependencies and manually testing responsive viewports and role flows. |
| Supabase integration | Not performed | Requires the target Supabase project, migrations, RLS, and the documented RPCs. |

### Remaining integration caveats

- Demo mode is now internally more consistent, but it is still a browser-local simulation and not a security or concurrency test.
- The current Supabase branches in `src/lib/data.ts` still require backend alignment: multi-table order placement/walk-in/payment flows should be replaced with atomic RPCs, and the deployed `orders.status` constraint must support the UI's approved status vocabulary (`PENDING`, `CONFIRMED`, `OUT FOR-DELIVERY`, `DELIVERED`, `READY FOR PICKUP`, `PICKED UP`, `CANCELLED`) or use a documented adapter.
- Do not call this production-ready until dependency-backed build/type checks, browser QA, and integration tests against a non-production Supabase project pass.


## UI feedback and discoverability fixes (2026-10-11)

- Success messages were shortened and the toast was constrained to a compact, responsive width with safe wrapping; toasts auto-dismiss after 4.5 seconds.
- Added search inputs to product catalog, inventory, payments, sales ledger, forecast items, and notifications. The existing orders search remains.
- Added a Notifications page to each role's navigation and routed the bell icon there. Demo seed notifications now exist for Admin, Staff, Delivery, and Customer; order creation, order status changes/cancellation, rider assignment, payment verification, and walk-in recording create relevant mock notifications. Added a working **Mark all read** action for demo and Supabase modes.
- Demo seed storage key bumped to `aquawell-demo-store-v3` so an older persisted empty/incorrect store cannot override the corrected seed. Added paid historical orders across prior completed periods so the sales ledger and daily/weekly/monthly WMA tables have visible data from first launch. Fixed local-date bucket calculation to avoid timezone shifts.
- Replaced the Supabase cancellation sequence of independent table updates with a call to the documented atomic `cancel_order_and_restore_stock(p_order_id)` RPC. That RPC must be deployed before live Supabase cancellation can work; demo cancellation remains browser-local. Notification query errors in Supabase mode now surface visibly instead of silently becoming an empty list.

### Additional validation for this pass

| Check | Result | Notes |
|---|---|---|
| TS/TSX syntax transpilation | Passed | All 24 non-declaration `.ts`/`.tsx` files transpiled with the globally available TypeScript compiler without syntax diagnostics. |
| Full dependency-backed build | Blocked | `npm ci` timed out/incomplete in this environment; the local `node_modules/vite` directory is empty, so `npm run build` cannot start. |
| Full type check | Blocked | React, Lucide, and Vite modules/types are unavailable due the incomplete dependency install. |
| Browser interaction QA | Not performed | Requires launching the project locally after `npm ci` completes on the user's machine. |
