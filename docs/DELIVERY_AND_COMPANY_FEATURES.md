# Delivery confirmation and company affiliations

## Delivery lifecycle

1. Staff confirms the order; existing atomic stock deduction remains the source of truth.
2. Staff/admin assigns the rider.
3. Assigned rider marks the order `OUT FOR-DELIVERY`.
4. Assigned rider marks it `DELIVERED`.
5. The customer sees **Order Received** only while the order is `DELIVERED` and `customer_received_at` is null.
6. Customer confirmation calls `confirm_customer_order_receipt`; the order remains `DELIVERED` and the separate timestamp records the customer confirmation. Payment remains a separate state.

Rider availability is stored on `profiles.delivery_availability` (`AVAILABLE`/`UNAVAILABLE`). The staff/admin view derives `OUT FOR DELIVERY` if a rider has an active order at that stage. Assignment is server-validated and rejects unavailable riders or riders already handling an out-for-delivery order. An active delivery takes precedence over the availability preference. Rejected assignments are returned to the unassigned queue by clearing `rider_id` before dispatch; failed delivery needs a separate, audited exception/reassignment workflow before being enabled.

## Companies and billing

- `companies`: reusable organization details and focal person.
- `customer_company_affiliations`: many-to-many membership, so a customer can belong to multiple organizations.
- `company_billing_records`: separate monthly company billing, not customer order payment or order-sales synchronization.
- Affiliation is identification/reporting only and must not alter price, stock, order priority, or payment rules.

## Deployment

1. Back up the staging database and inspect existing columns/constraints/RLS first.
2. Apply `supabase/migrations/202610150001_delivery_confirmation_and_company_affiliations.sql` to staging.
3. Verify the current `orders.customer_id` type and FK target, `orders.id` type, and existing notification schema. Adjust migration references if your actual schema differs.
4. Update order RLS and rider update permissions so riders can update only their assigned deliveries and only permitted statuses. The UI is not a security boundary.
5. Update order status notification triggers/functions to use your actual notifications schema. Do not insert notification rows until the existing schema and unread/read fields have been confirmed.
6. Build and run the acceptance checklist below; only then deploy to production.

## Acceptance checklist

- [ ] Customer receipt button is absent before rider status is `DELIVERED`.
- [ ] Customer receipt RPC rejects another customer's order, undelivered orders, and duplicate confirmations.
- [ ] Rider cannot update an order not assigned to their profile.
- [ ] Staff/admin can see each rider, availability, active delivery count, and current stage.
- [ ] Active `OUT FOR-DELIVERY` work overrides the available indicator.
- [ ] Rejecting a pre-dispatch assignment clears assignment and returns order to the queue; rejection is logged.
- [ ] Customer can see rider name and delivery status only, not internal rider identifiers or administrative details.
- [ ] Company names are unique case-insensitively; customer can have multiple active affiliations.
- [ ] Company monthly bill does not change order payment status or sales rows.
- [ ] Existing auth, order submission, stock deduction, manual payment verification, sales idempotency, and cancellation behavior still pass regression tests.

## Payment behavior and company monthly billing

The checkout UI no longer asks customers or staff to choose a Cash/COD method manually. Pickup defaults to Cash at pickup; Delivery defaults to Cash on Delivery. Affiliated company accounts may be billed monthly, so their orders must remain pending until the company billing workflow is explicitly applied. The current `verify_payment` RPC records a collected payment; do not use “Verify paid” to represent an unpaid monthly invoice. A complete monthly-billing workflow requires a database-backed affiliation/billing eligibility check and a distinct invoice/hold state (or the existing company billing record workflow), enforced inside an RPC rather than only in the browser.
