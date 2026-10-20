# Implementation Status

## Implemented in this source package

- New responsive React/Vite application; light/dark theme toggle.
- Supabase Auth login and signup UI; profile role resolution from `public.profiles` with explicit errors instead of role fallback.
- Role-specific navigation and dashboards for Admin, Station Staff, Customer, and Delivery Rider.
- Customer catalog/cart checkout for Pickup or Delivery/Cash on Delivery.
- Transactional SQL checkout, staff confirmation/atomic stock deduction, stock adjustment, manual payment verification, one-sale-per-order idempotency, pickup state changes, rider assignment, and assigned-rider delivery state changes.
- Daily, weekly, and monthly WMA SQL function with weights 5:3:2; forecast UI displays decimal forecast and ceiling purchase quantity.
- Inventory low-stock indicators, sales CSV export, order search, customer password change, notification/audit read views.
- Setup instructions, schema/RLS review checklist, migration scripts, and `.env.example` without real secrets.

## Requires verification or further implementation before production

- The live Supabase schema and all existing RLS policies must be inspected and tested. The supplied schema description is not a live database introspection result.
- SQL migrations have not been executed against your project. Review them on a staging database first.
- A full Vite production build could not be completed in this environment because dependency installation timed out and the cached Vite/Rolldown package from the visual-reference ZIP lacks its native binding. JS/JSX syntax parsing and CSS brace checks passed; this is not a substitute for `npm install` and `npm run build` on a normal development machine.
- Storage bucket name and policies were not supplied, so receipt/evidence file upload is not wired yet. Payment verification itself is implemented as a manual staff/admin action.
- Staff account creation/deactivation and privileged Auth user provisioning must be implemented through a trusted server-side/Edge Function workflow; no service-role key is placed in the browser. The current People & Roles page is a read view, not a secure staff provisioning tool.
- Audit events are displayed if present and visible under RLS, but the schema's `log_type` constraints and event semantics were not supplied, so the migration does not invent audit rows or values.
- The schema has `min_stock` but no maximum-stock field. Low-stock warnings use `stock <= min_stock`; the thesis's separate 20%-of-maximum rule needs an explicit schema/business decision.
- The sales table is an order-level summary. Product-level forecasts use `order_items` joined to paid orders; this assumes order creation date is the demand-period date. If your thesis requires payment date, use `payments.paid_at` consistently instead.
