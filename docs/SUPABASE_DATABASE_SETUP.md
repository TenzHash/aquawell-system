# AquaWell — Supabase Database Setup

This guide is for connecting the **AquaWell Clean Implementation with Landing Page** to Supabase. The application and the SQL files in this folder are the source of truth for the implementation.

## Choose the correct path first

- **Brand-new / empty Supabase project:** use the ordered migration sequence below.
- **Existing project with any AquaWell tables or data:** do not run `000_core_schema.sql`. First inspect the live schema, constraints, RLS policies, indexes, and existing rows. Applying the baseline to an existing database can fail or create a mixed schema.

Do not paste the entire folder into one query. Run one migration at a time and confirm it succeeds before continuing.

## A. Create a Supabase project

1. In Supabase, create a project and save its database password securely.
2. Open **SQL Editor**.
3. For a new project, run `supabase/migrations/000_core_schema.sql` first. This creates the ten core public tables and indexes.
4. Run the remaining files in numeric order, one at a time:

   1. `001_identity_integrity.sql`
   2. `002_auth_profile_bootstrap.sql`
   3. `003_confirm_order_and_inventory.sql`
   4. `004_manual_payment_sales.sql`
   5. `005_assigned_delivery_status.sql`
   6. `006_customer_order_checkout.sql`
   7. `007_pickup_status.sql`
   8. `008_wma_forecast.sql`
   9. `009_assign_delivery_rider.sql`
   10. `010_inventory_adjustment.sql`
   11. `011_rls_policies.sql`

`003` adds the `CONFIRMED` order state required by the implementation. Do not omit it. `011` enables RLS, adds read policies, and restricts browser table writes so operational mutations go through validated database functions.

## B. Connect the frontend

1. In Supabase, open **Project Settings → API** (the menu label may vary).
2. Copy the Project URL and the publishable key (or legacy anon key).
3. In the project folder, copy `.env.example` to `.env`.
4. Set:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

5. Install and run the app:

   ```bash
   npm install
   npm run dev
   ```

Only the publishable/anon key belongs in a browser app. **Never put the `service_role` key in `.env` or any `VITE_` variable.** Vite bundles `VITE_` variables into client-side code.

## C. Create the first customer and promote trusted staff accounts

1. Open the AquaWell site and register an account.
2. Confirm the email if Supabase email confirmation is enabled.
3. Sign in once or check **Authentication → Users** and find the exact account email.
4. The `002` trigger creates a `public.profiles` row with the `customer` role. Signup metadata cannot grant elevated access.
5. To promote a trusted first administrator, run this in the Supabase SQL Editor, replacing the email with the exact email of your own account:

   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE lower(email) = lower('YOUR_ADMIN_EMAIL@example.com');
   ```

   Verify exactly one row changed. Do not make this a public frontend action.

6. For staff or riders, first create/confirm their Auth account, then set `profiles.role` to `staff` or `delivery` and insert the matching `public.staff` business record with `profile_id` set to that profile's UUID. `profiles.role` uses lowercase values (`admin`, `staff`, `delivery`, `customer`); `staff.role` uses title case (`Admin`, `Staff`, `Delivery`). The Delivery portal requires both records to be linked.

Example staff linking template (fill in the real account details and verify the profile UUID first):

```sql
-- Replace the email and names with the real account details.
UPDATE public.profiles
SET role = 'delivery'
WHERE lower(email) = lower('YOUR_RIDER_EMAIL@example.com');

INSERT INTO public.staff (first_name, last_name, role, email, profile_id)
SELECT 'Rider First Name', 'Rider Last Name', 'Delivery', p.email, p.id
FROM public.profiles p
WHERE lower(p.email) = lower('YOUR_RIDER_EMAIL@example.com')
  AND lower(p.role) = 'delivery';
```

Run the insert only once per account. `001` creates unique partial indexes for non-null `customers.profile_id` and `staff.profile_id`; duplicate links cause it to stop rather than guess which record to keep.

## D. Add inventory

The new database starts with an empty inventory table. Insert your actual catalog items using the Supabase Table Editor or SQL Editor. Categories must be exactly `Refill` or `Hardware`; stock and minimum stock cannot be negative. Use the real station's product names and prices—do not treat sample data as production inventory.

## E. Verify before real use

- Register a test customer and confirm one matching `profiles` row appears.
- Confirm a customer can read inventory and only their own orders/payments.
- Confirm Staff/Admin can read operational orders, inventory, and payments.
- Confirm a Delivery account has a matching `staff.profile_id` and only sees orders assigned to its `staff_id`.
- Create a test order: stock must not change at checkout.
- Confirm it as Staff: all order quantities must deduct atomically; a shortage must leave stock unchanged.
- Verify payment manually: receipt evidence alone must not mark payment as paid; one qualifying order should create no more than one `sales` row.
- Test all three WMA periods and confirm only Admin can call `get_wma_forecast`.
- Test password change and theme toggle in the running frontend.

## Important implementation boundaries

- The checkout RPC creates a pending Cash payment as the initial record. GCash/Bank Transfer selection and receipt-file upload need a separate frontend/storage workflow before those methods are ready for customer self-service.
- `011_rls_policies.sql` is a starting policy set tailored to the current frontend queries. Review it with the real station's access rules before production deployment.
- The current app displays audit logs but does not yet write a complete audit event for every operation.
- No SQL has been applied to your live project by creating this package. Back up and test in a staging project first.


## Product image storage (CRUD)

The inventory image editor stores product photos in the public Supabase Storage bucket `product-images` and writes the resulting URL to `public.inventory.image_url`. The fresh-install SQL creates the bucket (public read, 5 MB limit, JPEG/PNG/WebP/GIF) and RLS policies allowing only authenticated `admin` and `staff` roles to upload, replace, and delete objects.

If your project was already installed, run this migration in Supabase SQL Editor (after confirming the `public.current_role()` helper exists):

```sql
alter table public.inventory add column if not exists image_url text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];
create policy product_images_public_read on storage.objects for select using (bucket_id='product-images');
create policy product_images_staff_insert on storage.objects for insert to authenticated with check (bucket_id='product-images' and public.current_role() in ('admin','staff'));
create policy product_images_staff_update on storage.objects for update to authenticated using (bucket_id='product-images' and public.current_role() in ('admin','staff')) with check (bucket_id='product-images' and public.current_role() in ('admin','staff'));
create policy product_images_staff_delete on storage.objects for delete to authenticated using (bucket_id='product-images' and public.current_role() in ('admin','staff'));
```

For repeated migration runs, check existing policy names first or drop the named policies before recreating them. Never put the Supabase service-role key in the browser; the app uses the anon/publishable key plus RLS. Image create/update uploads the file and updates `inventory.image_url`; delete clears the URL and removes the storage object.
