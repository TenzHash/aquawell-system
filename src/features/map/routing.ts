import type { LatLng } from "./simulation";

// Road routing through the public OSRM demo server (free, no API key). The path follows real streets.
// If the service can't be reached the caller falls back to a plain line, so the map never breaks.
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const cache = new Map<string, LatLng[]>();
const key = (a: LatLng, b: LatLng) => [a.lat, a.lng, b.lat, b.lng].map(n => n.toFixed(4)).join(",");

export async function fetchRoadRoute(from: LatLng, to: LatLng): Promise<LatLng[] | null> {
  const k = key(from, to);
  const hit = cache.get(k); if (hit) return hit;
  try {
    const res = await fetch(`${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    if (!res.ok) return null;
    const json = await res.json();
    const coords: [number, number][] | undefined = json?.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const pts = coords.map(([lng, lat]) => ({ lat, lng }));
    if (cache.size > 200) cache.clear();
    cache.set(k, pts);
    return pts;
  } catch { return null; }
}

/** Length of a path in metres. */
export function pathMeters(pts: LatLng[], dist: (a: LatLng, b: LatLng) => number): number {
  return pts.slice(1).reduce((n, p, i) => n + dist(pts[i]!, p), 0);
}
