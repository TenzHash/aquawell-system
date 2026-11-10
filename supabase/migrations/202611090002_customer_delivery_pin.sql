-- AquaWell v2.1 — customers can pin their delivery location on a map.
-- Run AFTER 202611090001_shop_location_and_rider_tracking.sql. Additive and idempotent.

begin;

alter table public.profiles add column if not exists pin_lat double precision check (pin_lat between -90 and 90);
alter table public.profiles add column if not exists pin_lng double precision check (pin_lng between -180 and 180);

-- Save (or move) the signed-in customer's pin.
create or replace function public.set_my_delivery_pin(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'customer' then raise exception 'not allowed: customers only'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Choose a valid location on the map.'; end if;
  update public.profiles set pin_lat = p_lat, pin_lng = p_lng where id = auth.uid();
end $$;

-- Remove the pin — only while the customer has no delivery that is still pending, being prepared or on the road.
create or replace function public.clear_my_delivery_pin()
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'customer' then raise exception 'not allowed: customers only'; end if;
  if exists (select 1 from public.orders where customer_id = auth.uid() and type = 'Delivery' and status in ('PENDING','CONFIRMED','OUT FOR-DELIVERY')) then
    raise exception 'You have an active delivery. You can remove your pin once it is completed.';
  end if;
  update public.profiles set pin_lat = null, pin_lng = null where id = auth.uid();
end $$;

-- place_customer_order now also records where on the map the delivery goes (optional).
drop function if exists public.place_customer_order(text,text,jsonb,text);
create or replace function public.place_customer_order(p_type text,p_address text,p_items jsonb,p_payment_method text default null,p_dest_lat double precision default null,p_dest_lng double precision default null)
returns public.orders language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_order public.orders; v_line jsonb; v_item public.inventory; v_qty integer; v_total numeric(12,2):=0; v_method text; v_lat double precision; v_lng double precision;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.current_role() <> 'customer' then raise exception 'Only customer accounts can place customer orders'; end if;
  if p_type not in ('Delivery','Pickup') then raise exception 'Invalid fulfillment type'; end if;
  if p_type='Delivery' and coalesce(btrim(p_address),'')='' then raise exception 'Delivery address is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  v_method := coalesce(p_payment_method, case when p_type='Pickup' then 'Cash' else 'Cash on Delivery' end);
  if p_type='Pickup' and v_method <> 'Cash' then raise exception 'Station Pickup payment method must be Cash'; end if;
  if v_method not in ('Cash','Cash on Delivery','GCash','Bank Transfer') then raise exception 'Invalid payment method'; end if;
  if p_type='Delivery' and p_dest_lat between -90 and 90 and p_dest_lng between -180 and 180 then v_lat := p_dest_lat; v_lng := p_dest_lng; end if;
  insert into public.orders(customer_id,type,address,total,status,payment_status,dest_lat,dest_lng) values(auth.uid(),p_type,nullif(btrim(p_address),''),0,'PENDING','PENDING',v_lat,v_lng) returning * into v_order;
  for v_line in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_line->>'quantity')::integer;
    if v_qty < 1 then raise exception 'Quantity must be a positive whole number'; end if;
    select * into v_item from public.inventory where id=(v_line->>'inventory_id')::bigint for share;
    if not found then raise exception 'An inventory item is unavailable'; end if;
    if v_item.stock < v_qty then raise exception 'Insufficient stock for %',v_item.name; end if;
    insert into public.order_items(order_id,inventory_id,quantity,unit_price) values(v_order.id,v_item.id,v_qty,v_item.price);
    v_total := v_total + v_item.price*v_qty;
  end loop;
  update public.orders set total=v_total where id=v_order.id returning * into v_order;
  insert into public.payments(order_id,amount,payment_method,payment_status) values(v_order.id,v_total,v_method,'PENDING');
  insert into public.notifications(user_id,title,description,order_id) values(auth.uid(),'Order submitted','Your order has been submitted successfully and is awaiting staff confirmation. Submission does not mean it has been accepted or prepared yet.',v_order.id);
  perform public.write_audit('Placed order '||v_order.order_reference,'ORDER',auth.uid());
  return v_order;
end; $$;

revoke all on function public.set_my_delivery_pin(double precision,double precision), public.clear_my_delivery_pin(),
  public.place_customer_order(text,text,jsonb,text,double precision,double precision) from public, anon;
grant execute on function public.set_my_delivery_pin(double precision,double precision), public.clear_my_delivery_pin(),
  public.place_customer_order(text,text,jsonb,text,double precision,double precision) to authenticated;

commit;
