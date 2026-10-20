-- orders.completed_at: the moment an order reached DELIVERED or PICKED UP.
-- Monthly company billing assigns orders to a month by this date. (customer_received_at cannot be
-- used: the table constraint only allows it on delivery orders, so pickups were never billed, and
-- updated_at moves whenever anything else touches the row, e.g. payment verification.)
-- Idempotent.
begin;

alter table public.orders add column if not exists completed_at timestamptz;

create or replace function public.set_order_completed_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.status in ('DELIVERED','PICKED UP') then
    if tg_op = 'INSERT' or old.status is distinct from new.status or new.completed_at is null then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end; $$;

drop trigger if exists orders_set_completed_at on public.orders;
create trigger orders_set_completed_at before insert or update of status on public.orders
for each row execute function public.set_order_completed_at();

-- Back-fill existing completed orders (best available date).
update public.orders
   set completed_at = coalesce(customer_received_at, updated_at, created_at)
 where status in ('DELIVERED','PICKED UP') and completed_at is null;

create index if not exists orders_completed_at_idx on public.orders(completed_at) where completed_at is not null;

commit;
