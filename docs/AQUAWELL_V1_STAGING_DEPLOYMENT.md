# AquaWell V1 — Fresh Supabase Staging Deployment

**Package status:** Draft fresh-install baseline prepared from the latest `aquawell-frontend-completion` source and its Supabase frontend contract. It has not been executed against your Supabase project. Treat it as a staging candidate, not production-approved SQL.

## Scope

- Profiles linked to Supabase Auth, role enforcement primitives, inventory, orders, order items, payments, sales, notifications and audit logs.
- Atomic order checkout and staff confirmation stock deduction.
- Manual payment verification and idempotent order-to-sale synchronization.
- Delivery assignment, rider status transitions, customer receipt confirmation, delivery event history and rider availability.
- Companies, many-to-many customer affiliations and separate monthly company billing.
- RLS enabled for all application tables.

## Before applying

1. Confirm the project is the **new empty staging project**. This migration is not a repair or upgrade script.
2. Open the SQL Editor and ensure there are no AquaWell application tables in `public`.
3. Save this SQL file locally and review it. Do not add a Supabase service-role key to frontend `.env`.
4. Run `supabase/migrations/0001_aquawell_v1_fresh_install.sql` once in SQL Editor.
5. If any statement fails, stop and capture the full error. Do not run random fragments or continue with a partially installed schema. On a truly empty staging project, recreate the staging project or use a reviewed rollback script before retrying.
6. Run the smoke checks at the bottom of the SQL file and the checklist below.

## Important frontend integration gap

The latest frontend still defaults to `VITE_DATA_MODE=mock` and some methods in `src/lib/data.ts` perform direct inserts/updates to `orders`, `order_items`, `payments`, or `inventory`. The fresh schema deliberately does **not** grant those unsafe direct mutations. Before switching to Supabase mode, the frontend data layer must be updated to call the RPCs provided by this baseline:

- Checkout: `place_customer_order(p_type, p_address, p_items, p_payment_method)` with `p_items` like `[{"inventory_id": 1, "quantity": 2}]` (send normal JSON, not a string).
- Staff confirmation: `confirm_order_and_deduct_stock(p_order_id)`.
- Rider assignment: `assign_delivery_rider(p_order_id, p_rider_id)`.
- Rider status: `update_assigned_delivery_status(p_order_id, p_status)`.
- Customer receipt: `confirm_customer_order_receipt(p_order_id)`.
- Payment verification: `verify_payment(p_payment_id, p_payment_method)`.
- Cancellation: `cancel_order_and_restore_stock(p_order_id)`.

The current frontend uses `get_daily_wma_forecast` as a generic `data` result; verify and adapt its result fields before using it in the forecast UI. This baseline currently calculates a daily 3-day weighted quantity using newest-first weights 3:2:1. Weekly and monthly forecast RPCs still need to be agreed and added before those periods are considered database-backed.

## Bootstrap the first administrator

1. Register the trusted owner/admin account through the app or Supabase Auth UI.
2. Confirm the matching row exists in `public.profiles`.
3. In the SQL Editor, update exactly that account using its known UUID:

```sql
update public.profiles
set role = 'admin'
where id = 'REPLACE-WITH-OWNER-AUTH-UUID';
```

Verify one row was changed. Never expose this action through a public client route. Use Supabase Auth to create accounts; do not insert directly into `auth.users`.

## Validation checklist

### Schema and security
- [ ] All 12 application tables exist and have RLS enabled.
- [ ] `authenticated` has no direct insert/update rights to orders, order items, payments, sales or company billing except the specifically granted profile/notification fields.
- [ ] Anonymous users cannot read operational data.
- [ ] A customer can read only their own orders, payments, notifications and affiliations.
- [ ] A rider can read only assigned orders and relevant delivery events.
- [ ] Staff/admin can read the operational data intended for their roles; only admin can manage roles, company records and billing.

### Business workflows
- [ ] Checkout creates a `PENDING` order, order items, and pending payment; inventory is unchanged.
- [ ] Station Pickup rejects non-Cash payment method.
- [ ] Staff confirmation deducts all stock atomically; insufficient stock leaves order and stock unchanged.
- [ ] Repeating confirmation does not deduct stock twice.
- [ ] Rider can only update an assigned order and can mark `OUT FOR-DELIVERY` then `DELIVERED`.
- [ ] Customer receipt confirmation fails before `DELIVERED`, for another customer's order, and on duplicate confirmation.
- [ ] Receipt upload alone never changes payment status to `PAID`.
- [ ] Staff payment verification creates one sale per order; retry does not create duplicates.
- [ ] Company affiliation can be multiple per customer and does not alter order/payment rules.
- [ ] Company monthly bill is separate from customer order payments and sales.

## Known limitations to resolve before production

- The SQL has not been run against a live Supabase project or validated by a PostgreSQL integration test environment.
- Frontend Supabase data-layer calls must be switched from direct mutations to the secure RPCs above.
- Weekly/monthly WMA functions and full inventory-adjustment RPC are not yet included.
- Failed-delivery reporting/reassignment policy is not fully implemented; the delivery event table reserves event types but there is no complete exception-management RPC yet.
- Profile self-update policy is column-restricted, but role changes must remain admin-only and be regression-tested with actual JWT/RLS sessions.
- Storage bucket and policies for payment receipt uploads are not included; do not enable receipt upload until private storage access rules are defined.
- Company monthly billing is a record-keeping feature only; it does not automatically bill a company or affect individual order payments.

Do not call the system production-ready until these gaps and all role-based tests are completed.
