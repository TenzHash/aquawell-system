# UI and delivery workflow updates — 2026-11-10

- Mobile sidebar now scrolls independently so every navigation item remains reachable; mobile navigation and key text controls are enlarged by approximately 2–3 px.
- Delivery riders remain eligible for additional assignments while an existing delivery is out for delivery. Rider availability is now explicit rather than being blocked by an active trip.
- Added newest-first / oldest-first sorting to Orders, Inventory, and the Sales ledger.
- Removed Overview from the customer navigation and route customers to My Orders by default.
- Moved customer live delivery tracking from Overview into My Orders, above the order list when an active delivery exists.
- Added `202611100001_rider_multiple_active_assignments.sql`; apply this migration to the Supabase project to enable multiple active assignments and explicit availability server-side.

## 2026-11-10 — UI, account recovery, and customer landing update

- Added a responsive UI consistency layer for desktop and mobile, including more compact order actions, improved table/form wrapping, and a scrollable mobile sidebar with a fixed profile footer.
- Standardized the application typeface to DM Sans across headings, controls, tables, and body copy.
- Added self-service Forgot password email flow and password recovery form using Supabase Auth.
- Added a Send reset link action to People & Roles for account recovery by administrators.
- Forced customer sessions to open My Orders and rewrote their saved page preference to My Orders.
- Included the previously supplied InventoryTable sorting-state fix in this complete source package.

### Supabase configuration required for password recovery

In Supabase Authentication → URL Configuration, ensure the deployed AquaWell origin is included in the allowed Redirect URLs and the Site URL is set to the production origin. The application sends reset links back to `window.location.origin`.
