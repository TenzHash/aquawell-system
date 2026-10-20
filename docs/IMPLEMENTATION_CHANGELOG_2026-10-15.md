# Implementation change log — 2026-10-15

Starting point: `aquawell-frontend-completion.zip` provided by the project owner.

## Implemented in source

- Added customer-facing `AW-#######` order reference presentation and removed the sales transaction serial ID column from the sales UI.
- Added customer **Order Received** action only for Delivery orders marked `DELIVERED` and not yet confirmed by the customer.
- Added Supabase RPC calls for customer receipt confirmation, assigned rider delivery status transitions, server-validated rider assignment, delivery assignment rejection, and rider availability updates.
- Added rider display names to customer orders and a staff/admin Rider Status page showing rider availability, active delivery count, and current delivery stages.
- Added Companies screens for company/focal-person records, customer-to-company affiliations, and monthly company billing records. Staff can view; admins can create affiliations and manage billing.
- Added customer account display of active company affiliations.
- Added workflow-priority order sorting; creation date is only a tie-breaker.
- Added notification trigger logic for order status changes, rider assignment, and customer receipt confirmation.
- Added additive migration `supabase/migrations/202610150001_delivery_confirmation_and_company_affiliations.sql` and acceptance/deployment notes.

## Validation

- `tsc --noEmit`: passed.
- Production bundle build: not verified in this environment because the uploaded `node_modules` lacks the platform-specific Rollup optional package. Reinstall dependencies on the target machine (`npm ci`) before `npm run build`.
- Supabase migration: not applied to any database. Apply to staging first and verify existing schema, role RLS, and notification columns.
