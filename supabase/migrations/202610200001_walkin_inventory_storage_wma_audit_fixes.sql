-- AquaWell fixes migration (2026-10-20)
-- Safe to run on top of 0001_aquawell_v1_fresh_install.sql and 202610150001_*.sql.
-- Idempotent: every statement uses IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS.
--
-- What this fixes
--   1. "Could not upload product image: Bucket not found"
--        -> creates the `product-images` storage bucket + storage policies and inventory.image_url.
--   2. "permission denied for table inventory"
--        -> authenticated only has SELECT on inventory (by design), so the browser's direct
--           UPDATEs failed. Stock adjustment / image changes now go through SECURITY DEFINER RPCs.
--   3. Walk-in orders (registered + unregistered customers)
--        -> the old client code INSERTed into orders/order_items/payments directly (no INSERT
--           grants) and used a wrong column name (order_items.price vs unit_price).
--           Replaced by place_walk_in_order(). Adds orders.walk_in_customer_name.
--   4. Registered customer shown as "Walk-in customer" with no company
--        -> orders has no customer_name/company columns; get_order_customer_info() supplies them.
--   5. WMA forecast empty / not matching the UI
--        -> get_wma_forecast(period) returns daily / weekly / monthly rows with weights 5:3:2
--           over the three most recent COMPLETED periods (Asia/Manila calendar).
--   6. Audit log showing IDs instead of names
--        -> write_audit() now stores a real display name; role-change entries use names.

begin;

-- ---------------------------------------------------------------------------
-- 1. Product images: column, bucket, storage policies
-- ---------------------------------------------------------------------------
alter table public.inventory add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_staff_insert on storage.objects;
create policy product_images_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.current_role() in ('admin','staff'));

drop policy if exists product_images_staff_update on storage.objects;
create policy product_images_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.current_role() in ('admin','staff'))
  with check (bucket_id = 'product-images' and public.current_role() in ('admin','staff'));

drop policy if exists product_images_staff_delete on storage.objects;
create policy product_images_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.current_role() in ('admin','staff'));

-- ---------------------------------------------------------------------------
-- 2. Explicit read grants (idempotent) + audit helper that stores names, not IDs
-- ---------------------------------------------------------------------------
-- RLS policies call public.current_role(); 0001 revoked EXECUTE on it from `authenticated`
-- (revoke ... on all functions) and never re-granted it, which makes every policy-protected
-- query fail with "permission denied for function current_role" / "permission denied for table ...".
grant execute on function public.current_role() to authenticated;

grant usage on schema public to authenticated;
grant select on public.profiles, public.inventory, public.orders, public.order_items,
  public.payments, public.sales, public.notifications, public.audit_logs,
  public.companies, public.customer_company_affiliations, public.company_billing_records
  to authenticated;

create or replace function public.write_audit(p_action text, p_log_type text default 'SYSTEM', p_user_id uuid default auth.uid())
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_name text;
begin
  select coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'User')
    into v_name from public.profiles where id = p_user_id;
  insert into public.audit_logs(user_id, user_name, action, log_type)
  values (p_user_id, coalesce(v_name, 'System'), p_action, p_log_type);
end; $$;
revoke all on function public.write_audit(text, text, uuid) from public;

-- Back-fill audit rows whose user_name was blank / an ID.
update public.audit_logs a
   set user_name = coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.email), ''), a.user_name)
  from public.profiles p
 where p.id = a.user_id
   and (a.user_name is null or btrim(a.user_name) = '' or a.user_name = a.user_id::text or a.user_name = 'User');

-- Role changes: log the person's NAME instead of the profile UUID.
create or replace function public.admin_update_user_role(p_user_id uuid, p_role text)
returns public.profiles language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_profile public.profiles; v_label text;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then raise exception 'Admin access required'; end if;
  if p_role not in ('admin','staff','delivery','customer') then raise exception 'Invalid role'; end if;
  update public.profiles set role = p_role, updated_at = now() where id = p_user_id returning * into v_profile;
  if not found then raise exception 'Profile not found'; end if;
  v_label := coalesce(nullif(btrim(v_profile.full_name), ''), nullif(btrim(v_profile.email), ''), 'a user');
  perform public.write_audit('Changed role of ' || v_label || ' to ' || p_role, 'ACCESS');
  return v_profile;
end; $$;
revoke all on function public.admin_update_user_role(uuid, text) from public;
grant execute on function public.admin_update_user_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Inventory writes through RPCs (no direct table UPDATE needed)
-- ---------------------------------------------------------------------------
create or replace function public.adjust_inventory_stock(p_inventory_id bigint, p_delta integer)
returns public.inventory language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_item public.inventory;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'Staff/admin access required'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Enter a non-zero stock adjustment'; end if;
  update public.inventory set stock = stock + p_delta
   where id = p_inventory_id and stock + p_delta >= 0
  returning * into v_item;
  if not found then raise exception 'Item not found, or the adjustment would make stock negative'; end if;
  perform public.write_audit('Adjusted stock of ' || v_item.name || ' by ' || p_delta || ' (now ' || v_item.stock || ')', 'INVENTORY');
  return v_item;
end; $$;
revoke all on function public.adjust_inventory_stock(bigint, integer) from public;
grant execute on function public.adjust_inventory_stock(bigint, integer) to authenticated;

create or replace function public.set_inventory_image(p_inventory_id bigint, p_image_url text)
returns public.inventory language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_item public.inventory;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'Staff/admin access required'; end if;
  update public.inventory set image_url = nullif(btrim(coalesce(p_image_url, '')), '')
   where id = p_inventory_id returning * into v_item;
  if not found then raise exception 'Inventory item not found'; end if;
  perform public.write_audit(case when v_item.image_url is null then 'Removed image of ' else 'Updated image of ' end || v_item.name, 'INVENTORY');
  return v_item;
end; $$;
revoke all on function public.set_inventory_image(bigint, text) from public;
grant execute on function public.set_inventory_image(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Walk-in orders: registered customer OR unregistered (name only)
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists walk_in_customer_name text;

create or replace function public.place_walk_in_order(p_customer_id uuid, p_walk_in_name text, p_items jsonb)
returns public.orders language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_order public.orders; v_row record; v_item public.inventory;
  v_total numeric(12,2) := 0; v_label text; v_qty_total integer := 0; v_lines text[] := '{}';
  v_walk_name text;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'Staff/admin access required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;

  if p_customer_id is not null then
    select coalesce(nullif(btrim(full_name), ''), nullif(btrim(email), ''), 'Customer') into v_label
      from public.profiles where id = p_customer_id and role = 'customer';
    if not found then raise exception 'The selected customer is not a registered customer account'; end if;
    v_walk_name := null;
  else
    v_walk_name := coalesce(nullif(btrim(coalesce(p_walk_in_name, '')), ''), 'Walk-in Customer');
    v_label := v_walk_name;
  end if;

  insert into public.orders(customer_id, walk_in_customer_name, type, total, status, payment_status, stock_deducted)
  values (p_customer_id, v_walk_name, 'Pickup', 0, 'PICKED UP', 'PAID', true)
  returning * into v_order;

  for v_row in
    select (e->>'inventory_id')::bigint as inv_id, sum((e->>'quantity')::integer)::integer as qty
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    if v_row.qty is null or v_row.qty < 1 then raise exception 'Quantity must be a positive whole number'; end if;
    select * into v_item from public.inventory where id = v_row.inv_id for update;
    if not found then raise exception 'An inventory item is unavailable'; end if;
    if v_item.stock < v_row.qty then raise exception 'Insufficient stock for % (only % left)', v_item.name, v_item.stock; end if;
    update public.inventory set stock = stock - v_row.qty where id = v_item.id;
    insert into public.order_items(order_id, inventory_id, quantity, unit_price) values (v_order.id, v_item.id, v_row.qty, v_item.price);
    v_total := v_total + v_item.price * v_row.qty;
    v_qty_total := v_qty_total + v_row.qty;
    v_lines := v_lines || (v_item.name || ' × ' || v_row.qty);
  end loop;

  update public.orders set total = v_total where id = v_order.id returning * into v_order;
  insert into public.payments(order_id, amount, payment_method, payment_status, paid_at, verified_by)
  values (v_order.id, v_total, 'Cash', 'PAID', now(), auth.uid());
  insert into public.sales(order_id, customer_name, item_name, quantity, total_amount, payment_method, date, created_at)
  values (v_order.id, v_label, array_to_string(v_lines, ', '), v_qty_total, v_total, 'Cash', current_date, now());
  if p_customer_id is not null then
    insert into public.notifications(user_id, title, description, order_id)
    values (p_customer_id, 'Counter purchase recorded', 'A walk-in cash purchase was recorded on your account.', v_order.id);
  end if;
  perform public.write_audit('Recorded walk-in sale ' || v_order.order_reference || ' for ' || v_label, 'ORDER');
  return v_order;
end; $$;
revoke all on function public.place_walk_in_order(uuid, text, jsonb) from public;
grant execute on function public.place_walk_in_order(uuid, text, jsonb) to authenticated;

-- Payment verification: keep the walk-in name on the sales ledger.
create or replace function public.verify_payment(p_payment_id bigint, p_payment_method text default null)
returns public.payments language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_payment public.payments; v_order public.orders; v_name text;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'Staff/admin access required'; end if;
  select * into v_payment from public.payments where payment_id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.payment_status = 'CANCELLED' then raise exception 'Cancelled payment cannot be verified'; end if;
  update public.payments set payment_status = 'PAID', payment_method = coalesce(p_payment_method, payment_method), paid_at = now(), verified_by = auth.uid(), updated_at = now()
   where payment_id = p_payment_id returning * into v_payment;
  update public.orders set payment_status = 'PAID', updated_at = now() where id = v_payment.order_id returning * into v_order;
  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.email), ''), v_order.walk_in_customer_name, 'Walk-in Customer')
    into v_name from (select 1) x left join public.profiles p on p.id = v_order.customer_id;
  insert into public.sales(order_id, customer_name, item_name, quantity, total_amount, payment_method, date, created_at)
  select v_order.id, v_name,
         coalesce(string_agg(i.name || ' × ' || oi.quantity, ', ' order by i.name), 'Order items'),
         coalesce(sum(oi.quantity), 0), v_order.total, v_payment.payment_method,
         coalesce(v_payment.paid_at::date, current_date), coalesce(v_payment.paid_at, now())
    from public.order_items oi join public.inventory i on i.id = oi.inventory_id where oi.order_id = v_order.id
  on conflict (order_id) do update set customer_name = excluded.customer_name, item_name = excluded.item_name, quantity = excluded.quantity,
    total_amount = excluded.total_amount, payment_method = excluded.payment_method, date = excluded.date, created_at = excluded.created_at;
  if v_order.customer_id is not null then insert into public.notifications(user_id, title, description, order_id) values (v_order.customer_id, 'Payment verified', 'Your payment has been verified.', v_order.id); end if;
  perform public.write_audit('Verified payment for order ' || v_order.order_reference, 'PAYMENT');
  return v_payment;
end; $$;
revoke all on function public.verify_payment(bigint, text) from public;
grant execute on function public.verify_payment(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Customer + company details for orders (orders itself has no such columns)
--    admin/staff: any order; rider: assigned orders; customer: own orders.
-- ---------------------------------------------------------------------------
create or replace function public.get_order_customer_info(p_order_ids bigint[])
returns table(order_id bigint, customer_id uuid, customer_name text, company_name text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select o.id,
         o.customer_id,
         coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.email), ''), nullif(btrim(o.walk_in_customer_name), ''), 'Walk-in Customer'),
         (select string_agg(c.name, ', ' order by c.name)
            from public.customer_company_affiliations a
            join public.companies c on c.id = a.company_id
           where a.customer_id = o.customer_id and a.active)
    from public.orders o
    left join public.profiles p on p.id = o.customer_id
   where o.id = any(coalesce(p_order_ids, '{}'::bigint[]))
     and auth.uid() is not null
     and (public.current_role() in ('admin','staff') or o.rider_id = auth.uid() or o.customer_id = auth.uid());
$$;
revoke all on function public.get_order_customer_info(bigint[]) from public;
grant execute on function public.get_order_customer_info(bigint[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. WMA forecast: daily / weekly / monthly, weights 5:3:2, completed periods only
-- ---------------------------------------------------------------------------
create or replace function public.get_wma_forecast(p_period text default 'daily')
returns table(inventory_id bigint, item_name text, current_stock integer,
              newest_period_demand numeric, previous_period_demand numeric, oldest_period_demand numeric,
              forecast numeric)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
#variable_conflict use_column
declare v_unit text; v_cur date; v_b1 date; v_b2 date; v_b3 date; v_step interval;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then raise exception 'Admin access required'; end if;
  if p_period not in ('daily','weekly','monthly') then raise exception 'Period must be daily, weekly or monthly'; end if;
  v_unit := case p_period when 'daily' then 'day' when 'weekly' then 'week' else 'month' end;
  v_step := ('1 ' || v_unit)::interval;
  v_cur  := date_trunc(v_unit, now() at time zone 'Asia/Manila')::date;   -- current (incomplete) period
  v_b1   := (v_cur - v_step)::date;        -- newest completed
  v_b2   := (v_cur - 2 * v_step)::date;    -- previous
  v_b3   := (v_cur - 3 * v_step)::date;    -- oldest
  return query
  with demand as (
    select oi.inventory_id as inv_id,
           date_trunc(v_unit, o.created_at at time zone 'Asia/Manila')::date as bucket,
           sum(oi.quantity)::numeric as qty
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where o.payment_status = 'PAID' and o.status <> 'CANCELLED'
       and (o.created_at at time zone 'Asia/Manila') >= v_b3::timestamp
       and (o.created_at at time zone 'Asia/Manila') <  v_cur::timestamp
     group by 1, 2
  )
  select i.id, i.name, i.stock,
         coalesce(sum(d.qty) filter (where d.bucket = v_b1), 0),
         coalesce(sum(d.qty) filter (where d.bucket = v_b2), 0),
         coalesce(sum(d.qty) filter (where d.bucket = v_b3), 0),
         round((5 * coalesce(sum(d.qty) filter (where d.bucket = v_b1), 0)
              + 3 * coalesce(sum(d.qty) filter (where d.bucket = v_b2), 0)
              + 2 * coalesce(sum(d.qty) filter (where d.bucket = v_b3), 0)) / 10, 2)
    from public.inventory i
    left join demand d on d.inv_id = i.id
   group by i.id, i.name, i.stock
   order by i.name;
end; $$;
revoke all on function public.get_wma_forecast(text) from public;
grant execute on function public.get_wma_forecast(text) to authenticated;

commit;

-- Post-migration checks
-- select id, public from storage.buckets where id = 'product-images';
-- select routine_name from information_schema.routines where routine_schema='public'
--   and routine_name in ('place_walk_in_order','adjust_inventory_stock','set_inventory_image','get_order_customer_info','get_wma_forecast');
-- select * from public.get_wma_forecast('weekly');   -- run as an admin session
