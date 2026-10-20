# AquaWell V1 schema reference

| Table | Purpose | Primary relationships |
|---|---|---|
| `profiles` | Auth-linked customer, staff, admin and rider profiles | `auth.users.id` |
| `inventory` | Station catalog and stock | referenced by order items |
| `orders` | Fulfillment state, reference, customer, rider, totals | profiles, order items, payments, sales |
| `order_items` | Immutable item/quantity/price snapshot | orders, inventory |
| `payments` | Payment state and verification metadata | orders, verifier profile |
| `sales` | Idempotent sale per order | unique `order_id` |
| `notifications` | Per-user order/system messages | profiles, orders |
| `audit_logs` | Business/security audit trail | actor profile |
| `companies` | Company contact and focal person | affiliations, billing |
| `customer_company_affiliations` | Many-to-many customer/company link | profiles, companies |
| `company_billing_records` | One monthly bill per company/period | companies |
| `delivery_events` | Assignment, dispatch, delivery, receipt history | orders, actor profile |

## State model

Order status is separate from payment status. `DELIVERED` means the rider reported delivery; `customer_received_at` records the customer's separate confirmation. `PAID` is set only through authorized payment verification, never from delivery completion or receipt upload.

Company affiliation is for identification/reporting. It does not grant pricing rules, priority, or payment exemptions. A company bill is separate from individual customer order payment.
