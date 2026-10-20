# AquaWell frontend-to-Supabase contract

This document is the integration boundary for replacing browser mock persistence with Supabase. The frontend should continue to call `src/lib/data.ts`; UI components should not query tables directly.

## Data behavior that the backend must preserve

1. **Order placement:** validate every inventory item and quantity, calculate totals using server-side prices, and create the order, `order_items`, and pending payment in one transaction/RPC. Do not deduct inventory at customer placement.
2. **Order confirmation:** use one atomic RPC to lock inventory rows, validate all requested quantities, deduct all lines or none, and transition the order to confirmed. The operation must be idempotent and must not deduct twice.
3. **Cancellation:** implement `cancel_order_and_restore_stock(p_order_id)` as an atomic RPC. It must lock the order, reject terminal/completed orders, cancel the order and pending payment records, and release stock only if the order had previously deducted it—and only once. The frontend must not emulate this transaction with independent updates.
4. **Delivery assignment:** staff/admin assignment is explicit. A delivery rider can accept or reject only an order assigned to their own authenticated profile. Reject clears the assignment while the order is still confirmed/pre-dispatch.
5. **Fulfillment versus payment:** `DELIVERED` and `PICKED UP` are fulfillment states, not payment proof. Cash on Delivery is marked paid only after an authorized staff/rider cash-collection confirmation workflow. Station Pickup payment is Cash only.
6. **Payment-to-sales sync:** only a verified `PAID` payment creates a sale. A unique constraint/idempotency key on `sales.order_id` prevents duplicates. Reverting an eligible payment to pending/unpaid removes or voids the sale according to the approved accounting policy. Never infer paid status from receipt upload alone.
7. **Walk-in sales:** one server-side transaction creates the completed pickup order, item lines, cash payment, stock deduction, sale, and audit entry. Do not implement this as a chain of independent browser requests.
8. **Audit:** privileged business actions should write audit records server-side; browser audit messages alone are not trustworthy.
9. **Forecasts:** the backend RPC and mock implementation must share one agreed definition for period boundaries and WMA weights. Current mock weights: 0.50 newest + 0.30 previous + 0.20 oldest, computed per inventory item from paid order-item quantities.

## Status vocabulary compatibility

The current UI uses `PENDING`, `CONFIRMED`, `OUT FOR-DELIVERY`, `DELIVERED`, `READY FOR PICKUP`, `PICKED UP`, and `CANCELLED`. The Supabase migration must define and validate the same approved state machine (or add an explicit adapter mapping); do not deploy a narrower status check that rejects states the UI writes. Status transitions must be enforced by RPC/policies, not trusted to client-side controls.

## Security requirements

- Supabase Auth identifies users; `profiles.role` and RLS/RPC checks determine permitted operations.
- Do not expose the service-role key in frontend environment variables.
- Customer reads/writes must be scoped to their own records; riders must be scoped to assigned deliveries; staff/admin permissions must be explicitly checked.
- Inventory, payment, sales, and order state changes that need multiple writes must use database transactions/RPCs.
- Demo credentials and local storage data must never be used as production identity or permissions.

## Integration acceptance tests

Run tests with separate Admin, Staff, Delivery, and Customer users against a non-production Supabase project. Test forbidden cross-user reads, stock race conditions, duplicate payment verification, sale idempotency, cancellation/refund-stock behavior, rider assignment ownership, payment status reversion, and the full reset/reseed flow. The mock demo is not a substitute for these checks.
