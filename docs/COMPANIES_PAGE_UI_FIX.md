# Companies Page UI Fix — 2026-10-15

## What changed
- Added the missing `.form-grid` layout styles used by the company, affiliation, and monthly billing forms.
- Form labels now stack above controls, with consistent spacing, input heights, borders, focus indicators, and theme-aware colors.
- Responsive layout uses three columns on wide screens, two on medium screens, and one on narrow mobile screens.
- Company tables now have consistent header, cell spacing, borders, and horizontal scrolling on small screens.
- Kept the existing React handlers, Supabase calls, role checks, and business rules unchanged.

## Important limitation
This is a frontend layout correction only. The Companies page will continue to display its migration-required message in demo mode. To persist company, affiliation, and billing data, configure Supabase and apply/review the supplied migration against the actual project schema and RLS policies before production use.

## Validation
Run `npm ci` and `npm run build` in the project directory. Then test the Companies page at desktop and mobile widths, in light and dark themes, with an admin account and a non-admin account. Verify company creation, multiple customer affiliations, monthly billing, refresh persistence, and RLS restrictions against a staging database.
