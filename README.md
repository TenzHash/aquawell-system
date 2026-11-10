> **v2:** see `docs/V2_DELIVERY_NOTES.md` for setup, the offline demo mode, the new migration and a requirement-to-file map.

# AquaWell Management System — Clean Implementation

This is a new implementation of the AquaWell water refilling station management system. The supplied ZIP was used only as a visual/UI reference; its source code, dependencies, Git history, environment files, and implementation logic were not copied into this project.

## Design and implementation basis

- **Data contract:** the provided `public` schema: `profiles`, `customers`, `staff`, `inventory`, `orders`, `order_items`, `payments`, `sales`, `notifications`, and `audit_logs`.
- **Thesis workflows:** authentication and role access, order management, inventory controls, delivery updates, payment/sales records, reporting, and 3-period Weighted Moving Average forecasting.
- **Confirmed business rules:** stock is deducted only after staff confirmation; payment is manually verified; a receipt alone never marks a payment paid; sales recording is idempotent per order; forecasts are daily, weekly, and monthly with weights 5:3:2 newest-first.
- **Schema compatibility:** existing table/column names are preserved. Migrations are separate, ordered, and must be reviewed against the live database before running.

## Stack

- React + Vite
- Supabase Auth and Postgres via `@supabase/supabase-js`
- Lucide React icons
- Responsive CSS with a working light/dark theme toggle

## Run locally

1. Install Node.js 20.19+ (or a current LTS version).
2. Copy `.env.example` to `.env`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Supabase project URL and publishable/anon key.
4. Install dependencies with `npm install`.
5. Follow `docs/SUPABASE_DATABASE_SETUP.md` to create and connect the database. For a brand-new project, run `000_core_schema.sql` first, then `001` through `011` in order. For an existing database, do not run the baseline until the live schema is inspected.
6. Review `docs/DATABASE_AND_RLS_CHECKLIST.md` and test all roles in staging.
7. Start with `npm run dev`; create a production bundle with `npm run build`.

**Never put a Supabase service-role key in a Vite environment variable.** Vite variables prefixed with `VITE_` are exposed to the browser.

## Public landing page

The app opens on a public, responsive landing page before authentication. It introduces AquaWell, explains the ordering experience, summarizes pickup/delivery and payment handling, and offers clear sign-in and customer-registration calls to action. The page includes Services, How it works, and About AquaWell sections and adapts to mobile navigation. If Supabase credentials are not configured, the landing page remains visible and authentication actions lead to setup instructions.

## Roles and primary screens

- **Admin / Owner:** overview, orders, inventory, payment review, sales ledger and forecasts, people/role view, notifications/audit placeholder.
- **Station Staff:** overview, order confirmation, inventory view, manual payment verification, pickup readiness/collection.
- **Customer:** account and password change, available items, cart, pickup or delivery/COD checkout, order tracking.
- **Delivery Rider:** assigned deliveries only; start delivery and mark delivered through a server-side RPC that verifies the linked staff record and assignment.

The account role is read from `public.profiles.role`. Missing profile or missing linked `public.staff` record produces an explicit error; it does not silently route a Delivery account into the Customer portal.

## Database workflow notes

- Customer checkout creates a `PENDING` order, `order_items`, and a `PENDING` Cash payment. It does not decrement stock.
- Staff confirmation locks and validates all affected inventory rows, then deducts the full basket and sets the order to `CONFIRMED` in one transaction. Any failure rolls back all changes.
- A separate additive status migration introduces `CONFIRMED`, since it is not in the supplied list of existing `orders.status` values. Review that migration against the live constraint before applying.
- Payment verification is a staff/admin-only RPC. It updates the payment and order summary and creates at most one `sales` row keyed by the order ID.
- `sales` has one summary row per order but only one `item_name` field. The implementation joins `order_items` for demand forecasting rather than treating the summary text as precise per-product detail.
- WMA is calculated per inventory item from quantities in `order_items` associated with paid orders. The forecast is shown as a whole number (rounded); the suggested purchase quantity is rounded up from the exact value.

## Important boundaries

This source package has not been connected to your live Supabase project and does not contain your project credentials. Existing RLS policies, live constraints, storage policies, and production data must be inspected before applying migrations. The customer checkout and server-side transactional functions are included, but deployment readiness depends on successful build and database tests against your actual project.

## Temporary demo mode (no Supabase required)

When `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent or still contain the example placeholders, AquaWell automatically opens in **Demo Mode**. The mock service layer lives in `src/lib/mockData.ts`; data-access functions in `src/lib/data.ts` route to it only when demo mode is active. The normal Supabase implementation remains in place for later integration.

### Demo accounts

All demo accounts use the initial password `Demo123!`:

| Role | Email |
|---|---|
| Admin | `admin@aquawell.demo` |
| Staff | `staff@aquawell.demo` |
| Delivery rider | `rider@aquawell.demo` |
| Customer | `customer@aquawell.demo` |

Click a demo account on the sign-in screen to autofill the credentials. Demo accounts are hard-coded test identities, not real authentication, and must never be used in production.

### What demo mode supports

- Seeded inventory, customer profiles, riders, sample orders, payments, sales, audit entries, notifications, and daily/weekly/monthly forecast summaries.
- Role-specific navigation and role-based sample views.
- Customer ordering with pickup (cash) or delivery (cash on delivery).
- Staff order confirmation with sample inventory deduction, rider assignment, delivery status changes, payment verification, inventory adjustments, and sales/audit updates.
- Profile editing and browser-local demo password changes.
- Browser-local persistence so edits survive a page refresh; use **Reset demo data** in the signed-in workspace to restore the seed records and demo passwords.

### Select the mode explicitly

To force mock mode even if Supabase credentials are configured, add this to `.env.local`:

```env
VITE_DATA_MODE=mock
```

Remove that setting (or set `VITE_DATA_MODE=supabase`) when you are ready to test the real backend. Never put a Supabase service-role key in a frontend `.env` file. Use only the publishable/anon key in the browser.

**Data separation:** mock records are stored in this browser's `localStorage` under `aquawell-demo-store-v1`. They are not inserted into Supabase. Clearing browser site data also clears the mock data. Do not use mock mode to validate production security, RLS policies, concurrency, database transactions, email, or real payment processing.

## Delivery confirmation and company affiliations (October 2026)

This source package now includes the two-step delivery confirmation UI and an additive Supabase migration:

- Rider marks an assigned delivery `OUT FOR-DELIVERY`, then `DELIVERED`.
- The customer's **Order Received** button appears only after `DELIVERED` and only until receipt is confirmed. Customer receipt is stored separately in `orders.customer_received_at`; it does not change payment status.
- Staff/admin can review rider availability. `OUT FOR DELIVERY` is derived from active work; the rider's own availability preference is `AVAILABLE` or `UNAVAILABLE`.
- Company records, many-to-many customer affiliations, focal-person details, and monthly company billing are available under **Companies** for admin/staff. Company billing is separate from individual order payments and sales.
- Sales transaction serial IDs are hidden from the sales table; customer-facing orders use an `AW-0000000` reference format.

### New migration

Review and apply `supabase/migrations/202610150001_delivery_confirmation_and_company_affiliations.sql` to a **staging** Supabase project first. The migration adds order references, receipt confirmation, rider availability, companies, affiliations, monthly billing, and server-side delivery/receipt RPCs. Verify the live schema and RLS policies before production deployment; see `docs/DELIVERY_AND_COMPANY_FEATURES.md` for details and acceptance tests.

### Build and validation

Run `npm ci` (or `npm install`) on your development machine, then `npm run build`. The uploaded ZIP's `node_modules` directory was created on a different platform and lacks required platform-specific optional packages, so it should not be reused. TypeScript validation completed with `tsc --noEmit` in the review environment.

### Rider GPS limitation

The rider's location is saved to `rider_locations` and the last saved coordinates remain visible when the rider goes offline. The rider app also requests the Screen Wake Lock API during active deliveries when supported. However, mobile browsers do not allow a service worker to access GPS, and a PWA cannot guarantee continuous background location tracking after the rider switches apps, locks the phone, or the operating system suspends the browser. For guaranteed background GPS, a native Android/iOS wrapper with the platform's background-location permission is required. Keep AquaWell open in the foreground during delivery for the most reliable updates.

### Rider location visibility

- Customer maps show the assigned rider's latest saved location while the order is out for delivery.
- Rider maps show the delivery destination saved on the order.
- When the rider is offline, maps display the last recorded rider position and label it with its age instead of moving the marker back to the shop.
- Customer delivery coordinates are only as accurate as the pin saved on the order. If no delivery pin was saved, the map uses the application's address fallback and should not be treated as a precise GPS position.

### Database migration

Apply `supabase/migrations/202611100001_rider_multiple_active_assignments.sql` to the connected Supabase project. This removes the one-active-delivery restriction while preserving explicit rider availability, assignment notifications, delivery events, and audit logging.
