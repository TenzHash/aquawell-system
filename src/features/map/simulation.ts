// Deterministic delivery-route simulation. Real GPS (rider_locations) wins when it is fresh;
// otherwise the rider is animated along the route from the station to the delivery pin.
import { DEFAULT_STATION_PIN, type StationPin } from "../../config/station";

export interface LatLng { lat: number; lng: number; }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Delivery pin: real coordinates if stored, else a stable pseudo-location within ~3 km of the station. */
export function destinationFor(order: any, station: StationPin = DEFAULT_STATION_PIN): LatLng {
  if (order.dest_lat != null && order.dest_lng != null) return { lat: Number(order.dest_lat), lng: Number(order.dest_lng) };
  const h = hash(String(order.address || order.id));
  const angle = ((h % 3600) / 3600) * Math.PI * 2;
  const radius = 0.006 + ((Math.floor(h / 3600) % 100) / 100) * 0.02;
  return { lat: station.lat + Math.sin(angle) * radius, lng: station.lng + Math.cos(angle) * radius * 1.05 };
}

/** Right-angle "street" route so the path looks like it follows a road grid. */
export function routePoints(a: LatLng, b: LatLng): LatLng[] {
  const mid = { lat: a.lat, lng: b.lng };
  return [a, mid, b];
}
const dist = (a: LatLng, b: LatLng) => Math.hypot(a.lat - b.lat, a.lng - b.lng);
export function pointAlong(points: LatLng[], t: number): LatLng {
  const clamped = Math.max(0, Math.min(1, t));
  const total = points.slice(1).reduce((n, p, i) => n + dist(points[i]!, p), 0) || 1;
  let want = clamped * total;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1]!, points[i]!);
    if (want <= seg || i === points.length - 1) {
      const f = seg ? Math.min(1, want / seg) : 1;
      return { lat: points[i - 1]!.lat + (points[i]!.lat - points[i - 1]!.lat) * f, lng: points[i - 1]!.lng + (points[i]!.lng - points[i - 1]!.lng) * f };
    }
    want -= seg;
  }
  return points[points.length - 1]!;
}

/** Straight-line distance in metres (haversine) — good enough for ETAs on a delivery map. */
export function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** How far along the trip a rider with a real GPS fix is: 0 at the shop, close to 1 at the customer's door. */
export function gpsProgress(station: LatLng, rider: LatLng, dest: LatLng): number {
  const total = metersBetween(station, dest) || 1;
  return Math.min(0.97, Math.max(0.03, 1 - metersBetween(rider, dest) / total));
}

export const SIM_TRIP_MS = 4 * 60 * 1000; // a simulated trip takes 4 minutes so the demo is watchable

export function tripProgress(order: any, now = Date.now()): number {
  if (order.status === "DELIVERED") return 1;
  if (order.status !== "OUT FOR-DELIVERY") return 0;
  const started = order.out_for_delivery_at ? new Date(order.out_for_delivery_at).getTime() : now - 60_000;
  return Math.min(0.97, Math.max(0.03, (now - started) / SIM_TRIP_MS));
}
