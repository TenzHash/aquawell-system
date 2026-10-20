# AquaWell Demo Mode Testing Guide

## Purpose and boundaries

Demo mode is a browser-local test environment for exercising role workflows before Supabase is connected. It uses the same frontend data functions as the Supabase path, but its local storage is **not** authentication, authorization, a database, or a security boundary. Never deploy demo credentials as real accounts.

## Run the demo

1. Extract the project ZIP and open a terminal in the project directory.
2. Run `npm ci`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. Copy `.env.example` to `.env.local`; keep `VITE_DATA_MODE=mock` for this frontend demo and restart Vite. Do not switch to Supabase until its migrations and RPCs are ready.
5. Use the **Reset demo data** action to restore the original sample data and demo passwords. Reset signs the current demo user out as well.

To use Supabase later, remove `VITE_DATA_MODE=mock`, set the URL and anon/publishable key, and complete the database/RLS/RPC checklist in `SUPABASE_DATABASE_SETUP.md`. Do not switch to Supabase until the matching migrations and RPCs have been deployed and validated.

## Demo accounts

All accounts initially use `Demo123!`.

| Role | Email |
|---|---|
| Admin | `admin@aquawell.demo` |
| Staff | `staff@aquawell.demo` |
| Delivery | `rider@aquawell.demo` |
| Customer | `customer@aquawell.demo` |

The login screen includes account shortcuts to autofill the credentials.

## Regression test checklist

### Customer

- Place a Pickup order and confirm its payment method is Cash only.
- Place a Delivery order and confirm it starts `PENDING` / `PENDING` with Cash on Delivery.
- Confirm placing an order does not deduct stock; the deduction happens once staff confirms it.
- Attempt an order with no items, zero/negative quantity, or insufficient stock; it must fail without partial writes.
- Search the product catalog, check My Orders, account/profile editing, theme persistence, and mobile layout.

### Staff

- Confirm a pending order. All required inventory lines must be checked before any stock is deducted; stock must decrease exactly once.
- Try confirming an order whose one item has insufficient stock; no item should be deducted.
- Cancel a confirmed order and verify stock is restored exactly once. Cancelling a pending order must not change stock.
- Assign a rider, move an order to delivery, and prepare pickup orders.
- Verify a payment explicitly. Only then should the order's payment status become `PAID` and a single sale appear.
- Mark a delivery delivered or a pickup picked up **without verifying payment**; payment must remain pending and no sale may be created.
- Verify the same payment twice; the sale must remain a single record.
- Change a paid payment back to pending/unpaid in a test scenario; the related sale must be removed.
- Record a walk-in sale with Cash. Verify its order, payment, sale, and stock deduction are consistent and its total is recalculated from current inventory prices.

### Delivery

- Confirmed delivery assigned to this rider should be visible.
- Accept/start delivery, then mark it delivered. Delivery completion must not silently verify payment.
- Reject a confirmed, assigned delivery; the rider assignment should clear and the order should return to the staff assignment queue.
- A rejected or unassigned order must not remain visible in this rider's delivery list.
- Verify the role sees only delivery navigation and test on a narrow viewport in both themes.

### Admin

- Review Overview, Notifications, Orders, Inventory, Payments, Sales & Forecasts, People & Roles, Audit Log, and Account. Verify the notification bell opens the Notifications page, seeded notices appear for all four roles, new orders/status/payment changes create notices, and **Mark all read** clears the unread indicator.
- Adjust inventory, verify a payment, change a demo role, and check audit entries.
- Search the inventory, payment, sales ledger, forecast rows, product catalog, and notifications.
- Inspect sales and daily, weekly, and monthly forecasts. The seed includes paid order-item history spanning completed periods; mock forecasts use actual seeded `orderItems` quantities on paid orders and weights of 50% newest, 30% previous, and 20% oldest period. This is a transparent demo calculation, not evidence of forecasting accuracy; validate the same rule against approved thesis requirements and backend data before deployment.
- Confirm success notifications are compact and disappear automatically; errors should appear in the visible error alert, not only in the browser console.
- Cancel a pending order and a confirmed order; verify the visible success toast, payment/sale state, and stock restoration behavior.
- Reset the demo and confirm all records and passwords return to seed state and the user is signed out.

## What mock mode can and cannot prove

It can exercise UI states and local business-rule behavior. It cannot prove Supabase Auth, Row Level Security, SQL constraints, atomic transactions, concurrent stock deduction, triggers, real email, or payment processing. Those require a deployed test project and automated/manual integration tests.
