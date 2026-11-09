# UI and delivery workflow updates — 2026-11-10

- Mobile sidebar now scrolls independently so every navigation item remains reachable; mobile navigation and key text controls are enlarged by approximately 2–3 px.
- Delivery riders remain eligible for additional assignments while an existing delivery is out for delivery. Rider availability is now explicit rather than being blocked by an active trip.
- Added newest-first / oldest-first sorting to Orders, Inventory, and the Sales ledger.
- Removed Overview from the customer navigation and route customers to My Orders by default.
- Moved customer live delivery tracking from Overview into My Orders, above the order list when an active delivery exists.
- Added `202611100001_rider_multiple_active_assignments.sql`; apply this migration to the Supabase project to enable multiple active assignments and explicit availability server-side.
