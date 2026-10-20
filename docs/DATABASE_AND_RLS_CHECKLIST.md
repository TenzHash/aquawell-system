# Database and RLS Review Checklist

## Preserve and verify the supplied schema

The application uses the existing table/column names. Before applying migrations, verify that the live schema matches the supplied version, particularly `orders.status`, `orders.payment_status`, `payments.payment_status`, `payments.payment_method`, the `sales` constraints, and the generated `order_items.subtotal` column.

## Migrations (review in order)

1. `001_identity_integrity.sql` — checks for duplicate `customers.profile_id` and `staff.profile_id`, then creates partial unique indexes. It intentionally aborts when duplicates exist.
2. `002_auth_profile_bootstrap.sql` — creates a `profiles` row for new Auth users with role `customer`; role is not accepted from user-supplied metadata.
3. `003_confirm_order_and_inventory.sql` — adds the `CONFIRMED` status to the order status constraint and installs atomic staff order confirmation/stock deduction. This is an explicit additive schema change.
4. `004_manual_payment_sales.sql` — staff/admin-only manual payment verification and idempotent one-sale-per-order recording.
5. `005_assigned_delivery_status.sql` — assigned rider/admin delivery transitions.
6. `006_customer_order_checkout.sql` — customer checkout that creates a pending order and payment without decrementing stock.
7. `007_pickup_status.sql` — staff/admin pickup readiness and collection transitions.
8. `008_wma_forecast.sql` — Admin-only daily/weekly/monthly WMA function with newest-first weights 5:3:2.
9. `009_assign_delivery_rider.sql` — validates the delivery staff/profile link and assigns the rider to a confirmed delivery order.
10. `010_inventory_adjustment.sql` — atomic Admin/Staff stock adjustment that rejects negative stock.

Take a database backup and test on a staging project first. Do not apply these automatically to production.

## RLS policy checks

RLS must remain enabled on every existing table. The SQL RPCs use `SECURITY DEFINER`, so each function explicitly validates `auth.uid()` and the application role before writes. Review function ownership, `search_path`, execute grants, and every policy before deployment.

Expected policy behavior (test with actual authenticated sessions):

- Customers can read/update only their own profile and customer record; read only orders linked to `orders.customer_id = auth.uid()`; see only payment records linked to their own orders; and read inventory needed for the catalog.
- Staff can access operational orders/inventory/payment rows allowed by station policy; only staff/admin can confirm orders, deduct stock, verify payments, and update pickup status.
- Delivery accounts can read only assigned orders; the status RPC rejects a rider whose `staff.profile_id` does not match the authenticated user or whose `orders.rider_id` is not their `staff_id`.
- Admin/Owner can view permitted reports, profiles, sales and forecasts. Only the Admin role can invoke the WMA forecast function.
- An authenticated user cannot set their own role through signup metadata or a browser update. Staff and admin provisioning must be an explicitly trusted administrative operation.
- No service-role key is present in browser code.

Do not add broad `USING (true)` or `WITH CHECK (true)` write policies as a workaround. Existing policies combine permissively unless deliberately designed otherwise, so adding a new policy can widen access.

## Data semantics / known limitations

- `orders.customer_id` is a UUID foreign key to `profiles.id`, despite its name; the app intentionally uses it as supplied.
- `customers.customer_id` and `staff.staff_id` are business-record IDs. Their optional `profile_id` fields link those rows to Auth profiles.
- `orders.payment_status` is a summary synchronized by the payment RPC; `payments.payment_status` is the payment record status. Do not update them independently in client code.
- `sales.transaction_id` is set to the order ID for idempotency. Existing conflicting sales rows must be reconciled before using this convention for old orders.
- The WMA uses `orders.created_at` as the demand-period date and includes orders whose summary `payment_status='PAID'`. If the thesis defines demand date as `payments.paid_at` instead, update the function and document that decision consistently.
- The thesis mentions a low-stock trigger based on 20% of maximum stock, but the supplied schema has `min_stock` and no maximum-stock column. This implementation flags stock at or below `min_stock`; do not reinterpret that as the thesis's 20% rule without a schema/business decision.
- The supplied `sales` row is order-summary shaped, not a full item ledger. Product-level WMA therefore reads `order_items` joined to paid orders, not `sales.item_name`.
- The current schema has no cancellation/refund inventory-restock policy. Do not assume cancelling/refunding automatically restores stock until that rule is specified.
- The current audit schema includes both text `timestamp` and timestamp `created_at`; use `created_at` for chronology until old text values are normalized.

## Acceptance tests before release

1. Signup creates one customer `profiles` row; role metadata cannot create Admin/Staff/Delivery access.
2. Missing profile and missing `staff.profile_id` are explicit errors, never fallback to Customer.
3. Customer checkout inserts order/items/pending payment; stock stays unchanged.
4. Staff confirmation with enough stock deducts all quantities once. Repeating confirmation does not deduct again.
5. A basket where one item is short leaves every inventory row unchanged and order pending.
6. Two concurrent confirmations cannot make stock negative.
7. A receipt upload alone does not mark payment paid or create a sale.
8. Unauthorized role cannot call each write RPC; unassigned rider cannot update delivery.
9. Repeated payment verification creates at most one sales row for the order.
10. Pickup status cannot be applied to Delivery orders; delivery cannot skip confirmation.
11. WMA returns daily/weekly/monthly values with weights 5:3:2, and purchase recommendation is `ceil(forecast)`.
12. RLS tests prove customers and riders cannot read other users' records.
13. Test password change, theme toggle, responsive layout, CSV export, and production build.
