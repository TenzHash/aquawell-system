# Shop location, rider live location, rider status (2026-11-09)

## 1. Shop location pin (owner + staff)
- New page **Shop Location** (Admin and Staff sidebar). Click the map or drag the star, search an address, or use "Use my current location", then **Save shop location**.
- Stored in `public.station_settings` (single row) and written only through `set_station_location()` (admin/staff). Everyone signed in can read it, so customers' tracking maps start from the same pin. The save is written to the audit log.
- Until a pin is saved, the old default coordinates in `src/config/station.ts` are used.
- Run `supabase/migrations/202611090001_shop_location_and_rider_tracking.sql` (after the v2 migration).

## 2. Rider location on the maps
- Riders now share their GPS **automatically** while any of their deliveries is *out for delivery* (stops when it is delivered). A rider can also switch it on by hand from the Live Map.
- One shared GPS watcher lives at app level (`RiderLocationBroadcaster`), so sharing continues while the rider switches pages. A position is sent immediately, then every 10 s.
- The Live Map (staff/admin), the rider's own map and the customer's "Track your delivery" map now show the rider's real position (refreshed every 8 s). With a live fix the dashed line runs from the rider to the door and the ETA comes from the real distance; with no fix the old simulated route is used.
- Routes follow real roads (OSRM public routing service, fetched in the browser; falls back to a straight line if unreachable).
- A rider with no fresh GPS (offline or not sharing) is shown at the shop. The animated route simulation is only used in demo mode.
- Fixed: in Supabase mode, customers and riders never saw a rider marker because the rider list was only loaded for staff/admin. The marker list is now built from the orders for those roles.
- Browser must allow location access (HTTPS or localhost).

## 3. Rider Status page
- **Current stage** now shows one entry: the rider's latest delivery - the one still out for delivery if there is one, otherwise the most recently delivered - with its time.

## 4. Customer delivery pin
- Checkout (cart) now shows a map under the delivery address: tap the map, drag the pin, or "Use my current location". An empty address is filled in from the pin when possible.
- The pin is stored on the order (`dest_lat/dest_lng`), so the rider's route and the Live Map go to the exact spot. It is also saved on the profile for next time.
- Account page has a **Delivery pin** panel to save, move or **remove** the pin. Removal is refused while the customer has a pending, confirmed or out-for-delivery delivery (enforced in `clear_my_delivery_pin()`).
- Run `supabase/migrations/202611090002_customer_delivery_pin.sql` (adds `profiles.pin_lat/pin_lng`, the two pin functions, and a new `place_customer_order` that accepts the pin).
