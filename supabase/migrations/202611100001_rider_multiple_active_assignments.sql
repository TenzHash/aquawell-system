-- Allow a rider to receive multiple active delivery assignments.
-- An out-for-delivery order no longer makes the rider automatically unavailable.
-- Explicit rider availability remains respected.

create or replace function public.assign_delivery_rider(p_order_id bigint, p_rider_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'staff')
  ) then
    raise exception 'Only staff or admin can assign delivery riders';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_rider_id
      and p.role = 'delivery'
      and coalesce(p.delivery_availability, 'AVAILABLE') = 'AVAILABLE'
  ) then
    raise exception 'Rider is unavailable or does not have a delivery role';
  end if;

  -- Deliberately no check for another OUT FOR-DELIVERY order.
  update public.orders o
     set rider_id = p_rider_id
   where o.id = p_order_id
     and o.type = 'Delivery'
     and o.status = 'CONFIRMED'
  returning o.* into v_order;

  if not found then
    raise exception 'Only confirmed delivery orders can be assigned';
  end if;

  -- Preserve the existing operational audit trail and notifications.
  insert into public.delivery_events(order_id, actor_id, event_type)
  values (v_order.id, auth.uid(), 'ASSIGNED');

  insert into public.notifications(user_id, title, description, order_id)
  values (p_rider_id, 'Delivery assigned', 'A delivery has been assigned to you.', v_order.id);

  if v_order.customer_id is not null then
    insert into public.notifications(user_id, title, description, order_id)
    values (v_order.customer_id, 'Rider assigned', 'A rider has been assigned to your order.', v_order.id);
  end if;

  perform public.write_audit('Assigned rider to order ' || v_order.order_reference, 'DELIVERY');
  return v_order;
end;
$$;

revoke all on function public.assign_delivery_rider(bigint, uuid) from public;
grant execute on function public.assign_delivery_rider(bigint, uuid) to authenticated;
