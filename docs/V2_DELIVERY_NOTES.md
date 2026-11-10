# AquaWell v2 — Delivery Notes

## Run it
```bash
npm install
cp .env.example .env          # add your project URL + anon key for the live database
npm run dev
```
**Offline demo (no database needed, ideal for a backup at the defense):** set `VITE_DATA_MODE=mock` in `.env`, run `npm run dev`.
Demo accounts (password `Demo123!`): `admin@`, `staff@`, `rider@`, `rider2@`, `customer@`, `company@aquawell.demo`. Data is stored in the browser.
Edit store details (name, address, TIN, hours) in `src/config/station.ts` — they appear on the landing page, receipts and statements.

## Live database
Apply `supabase/migrations/202611080001_v2_inventory_rbac_receipts_privacy.sql` (after the existing migrations, on staging first).

## Where each requirement lives
| Requirement | Files |
|---|---|
| Live mapping | `src/features/map/LiveMap.tsx`, `simulation.ts` (Leaflet + OpenStreetMap tiles, no API key, needs internet; rider GPS optional; only on-the-way deliveries are tracked) |
| Inventory CRUD + low stock | `src/features/inventory/InventoryTable.tsx`, SQL `create/update/delete_inventory_item`, `log_inventory_change` trigger |
| DB integrity / logging | migration: CHECKs, FK cascades, indexes, `inventory_movements` ledger, audit entries |
| Receipts | `src/features/receipts/ReceiptModal.tsx`, `src/lib/documents.ts`, print CSS |
| Account deletion | `src/features/account/DeleteAccount.tsx`, SQL `export_my_data`, `delete_my_account` |
| Cart icon / modal / persistence | `src/features/cart/*`, `src/utils/persist.ts` |
| Per-order payment (COD) | `OrderTable.tsx` "Payment received", SQL `mark_order_paid`; global Payments tab removed |
| Corporate monthly statements | `CompaniesPanel.tsx`, `StatementModal.tsx` |
| Staff/rider permission toggles | `src/features/admin/AccessControl.tsx`, `src/lib/permissions.ts`, table `role_permissions` |
| Line graphs + WMA | `src/features/analytics/*` |
| Parallax landing | `src/pages/LandingPage.tsx` (+ CSS) |
| Technical text removed | `friendlyError()` in `src/lib/data.ts`; copy rewritten across pages |
