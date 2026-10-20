# AquaWell UI Cleanup Pass

## Scope
This pass removes repeated navigation affordances and reorganizes role dashboards without removing any workflow or role page. It preserves the existing frontend architecture and the planned Supabase backend boundary.

## Changes
- Removed the Customer **New order** button because the product catalog already provides the ordering flow.
- Removed Customer Overview quick-action cards for Order Water, My Orders, and Account because those destinations already exist in the sidebar.
- Removed the Delivery Overview quick action for My Deliveries because it duplicates the sidebar destination.
- Hid the quick-action panel for Customer and Delivery roles and expanded their recent-orders panel to use the available dashboard width.
- Hid operational stock/payment attention cards from Customer and Delivery dashboards; these were not relevant to those roles and exposed unnecessary operational counts. Staff sees order/payment attention, while the low-stock count remains Admin-only.
- Removed the extra topbar workspace status pill and account avatar shortcut. The demo banner still clearly explains that the current workspace is demo-only, and the sidebar retains role navigation/account context.
- Split **Notifications** from **Audit Log**: notifications remain on their own page, while Audit Log now contains only audit records instead of duplicating the notification list. Updated the route label and access allow-list together.
- Removed repeated forecast-weight badge because the WMA formula already explains the 50/30/20 weighting. Simplified the sales ledger helper text and made the empty forecast state explain the need for paid-order history instead of showing a migration-only message in mock mode.
- Added a single-column dashboard layout for Customer and Delivery roles and updated the recent-orders description to be role-specific.
- Removed unused CSS for the deleted status pill and avatar shortcut.

## Feature preservation
Order Water remains in Customer navigation, order tracking remains under My Orders, Account remains accessible, the notification bell and Notifications page remain available, and Admin/Staff quick actions remain as task shortcuts. No ordering, payment, inventory, forecast, delivery, or account feature was intentionally removed.

## Verification
- TypeScript/TSX syntax transpilation: **24 files, no syntax diagnostics**.
- Full Vite production build: **not verified** because the local dependency install did not complete and the Vite executable was unavailable in this environment.
- Browser visual/regression testing: **still required locally**.
