-- Pickup status changes go through an RPC: clients have no UPDATE grant on public.orders
-- ("permission denied for table orders" on Ready for pickup / Mark picked up).
-- Idempotent; run after 202610200001.
begin;

create or replace function public.update_pickup_status(p_order_id bigint, p_status text)
returns public.orders language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_order public.orders;
begin
  if auth.uid() is null or public.current_role() not in ('admin','staff') then raise exception 'Staff/admin access required'; end if;
  if p_status not in ('READY FOR PICKUP','PICKED UP') then raise exception 'Unsupported pickup status'; end if;
  update public.orders set status = p_status, updated_at = now()
   where id = p_order_id and type = 'Pickup'
     and ((p_status = 'READY FOR PICKUP' and status = 'CONFIRMED')
       or (p_status = 'PICKED UP' and status = 'READY FOR PICKUP'))
  returning * into v_order;
  if not found then raise exception 'Order is not a pickup order in the right state for this change'; end if;
  perform public.write_audit('Marked order ' || v_order.order_reference || ' as ' || p_status, 'ORDER');
  return v_order;
end; $$;
revoke all on function public.update_pickup_status(bigint, text) from public;
grant execute on function public.update_pickup_status(bigint, text) to authenticated;

commit;
