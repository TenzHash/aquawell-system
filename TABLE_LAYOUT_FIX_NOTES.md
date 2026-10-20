# AquaWell table layout/search fix

## Actual source changes in this revision

- `src/pages/DashboardRouter.tsx`
  - Added the shared wide search + rows-per-page toolbar and consistent pagination to Rider Status, Payments, Audit Log, and the read-only Customers table.
  - Search matches relevant displayed fields; filtering happens before pagination.
  - Page resets when search or page size changes.
  - Payments search also matches the order reference.
- `src/features/admin/PeopleAndRoles.tsx`
  - Added searchable profile/role rows, rows-per-page selection, and consistent pagination while preserving role-change actions.
- `src/features/admin/CompaniesPanel.tsx`
  - Added independent search and pagination to Companies, Customer Company Assignment, and Monthly Company Billing tables.
  - Existing company assignment, billing, and payment actions remain in their existing rows.
- `src/components/ui/TableControls.tsx` and the Orders table were not changed in this revision; the existing shared controls and Orders layout remain the reference.

## Verification

- TypeScript/TSX syntax transpilation completed for all 27 `.ts`/`.tsx` files with no syntax diagnostics.
- A full Vite production build could not be run because dependencies were not installed in this environment; `npm ci` timed out and offline install reported a missing cached package. Run `npm ci` and `npm run build` locally to complete the production-build check.
