# Companies Form Layout Update

## Follow-up correction

The previous inline-action CSS was being overridden by the later, more general `.form-grid` and responsive rules in `src/styles.css`. The desktop screenshot therefore still showed the Add company button on a separate row.

This correction gives the Companies-specific grid selectors higher specificity, so desktop forms use their intended column templates:

- Company: company name, focal person, contact information, Add company.
- Customer affiliations: customer, company, Add affiliation.
- Monthly billing: company, billing month, amount due, Create monthly bill.

At tablet widths the forms wrap into two columns, and at narrow mobile widths they stack vertically. The page-level Refresh button remains the only Refresh control.

## Files changed

- `src/styles.css` — corrected selector specificity for the Companies form grid and its responsive overrides.

## Validation

Inspect the Companies page at desktop width (above 1000px): each form action should occupy the same grid row as its fields. At 1000px and below, forms may wrap for readability. This is a frontend CSS change only; it does not apply the Supabase migration or change persistence behavior.
