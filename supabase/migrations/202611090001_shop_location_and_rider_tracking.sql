-- AquaWell v2.1 — pinnable shop location + rider live-location hardening.
-- Run AFTER 202611080001_v2_inventory_rbac_receipts_privacy.sql. Additive and idempotent.

begin;

-- ---------------------------------------------------------------- 1. shop location (single row)
create table if not exists public.station_settings (
  id         smallint primary key default 1 check (id = 1),
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  label      text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.station_settings enable row level security;

-- Everyone who is signed in may read it (customers need it to follow their delivery on the map).
drop policy if exists station_settings_read on public.station_settings;
create policy station_settings_read on public.station_settings for select to authenticated using (true);

-- Owner (admin) and staff pin the shop through this function; there is no direct write access.
create or replace function public.set_station_location(p_lat double precision, p_lng double precision, p_label text default null)
returns public.station_settings language plpgsql security definer set search_path = public as $$
declare r public.station_settings;
begin
  if public.current_role() not in ('admin','staff') then raise exception 'not allowed: only the owner or staff can pin the shop location'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Choose a valid location on the map.';
  end if;
  insert into public.station_settings(id, lat, lng, label, updated_by, updated_at)
  values (1, p_lat, p_lng, nullif(trim(coalesce(p_label,'')),''), auth.uid(), now())
  on conflict (id) do update set lat = excluded.lat, lng = excluded.lng, label = excluded.label,
    updated_by = auth.uid(), updated_at = now()
  returning * into r;
  perform public.write_audit(format('Pinned the shop location at %s, %s', round(p_lat::numeric, 5), round(p_lng::numeric, 5)), 'SETTINGS');
  return r;
end $$;

revoke all on function public.set_station_location(double precision, double precision, text) from public, anon;
grant execute on function public.set_station_location(double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------- 2. rider locations
-- Customers may see their rider only while the order is out for delivery (unchanged), and every
-- rider position is stamped by the server so a wrong phone clock can never hide a rider.
create index if not exists rider_locations_updated_idx on public.rider_locations(updated_at desc);

commit;
