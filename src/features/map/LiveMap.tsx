import React, { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bike, Home, MapPin, Navigation } from "lucide-react";
import { DEFAULT_STATION_PIN, STATION, type StationPin } from "../../config/station";
import { orderRef } from "../../lib/documents";
import { SIM_TRIP_MS, destinationFor, gpsProgress, metersBetween, pointAlong, routePoints, tripProgress, type LatLng } from "./simulation";
import { isDemoMode, loadRiderLocations } from "../../lib/data";
import { fetchRoadRoute, pathMeters } from "./routing";
import { EmptyState } from "../../components/ui/EmptyState";
import { Status } from "../../components/ui/Status";

// Real interactive map powered by Leaflet + OpenStreetMap tiles (no API key needed).
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
const ON_THE_WAY = "#f59e0b";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string));
const toLL = (p: LatLng): L.LatLngTuple => [p.lat, p.lng];

const stationIcon = (label: string) => L.divIcon({
  className: "lf-icon",
  html: `<div class="lf-station"><span>★</span></div><b class="lf-label">${esc(label)}</b>`,
  iconSize: [38, 38], iconAnchor: [19, 19],
});
const pinIcon = (label: string, selected: boolean) => L.divIcon({
  className: "lf-icon",
  html: `<div class="lf-pin ${selected ? "selected" : ""}"><i></i></div>${label ? `<b class="lf-label lf-pin-label">${esc(label)}</b>` : ""}`,
  iconSize: [30, 38], iconAnchor: [15, 38],
});
const riderIcon = (name: string, moving: boolean, off: boolean) => L.divIcon({
  className: "lf-icon",
  html: `<div class="lf-rider ${moving ? "moving" : ""} ${off ? "off" : ""}"><span>🛵</span></div><b class="lf-label strong">${esc(name)}</b>`,
  iconSize: [34, 34], iconAnchor: [17, 17],
});

interface Props { orders: any[]; riders?: any[]; riderLocations?: any[]; role: string; profileId: string; compact?: boolean; station?: StationPin; }

const GPS_FRESH_MS = 120_000;   // a rider position older than this is treated as "not sharing"
const POLL_MS = 8_000;          // how often rider positions are re-read while the map is open
const SIMULATE = isDemoMode(); // the demo has no real phones, so riders there are animated along the route
const RIDER_SPEED_M_PER_MIN = 330; // ~20 km/h, used for the ETA of a rider with a live GPS fix

export function LiveMap({ orders, riders = [], riderLocations = [], role, profileId, compact = false, station: stationProp }: Props) {
  const station = stationProp || DEFAULT_STATION_PIN;
  const stationLabel = station.label || `${STATION.shortName} Shop`;
  const [tick, setTick] = useState(Date.now());
  // Real road paths per order id (from the rider, or from the shop when the rider isn't sharing GPS).
  const [roads, setRoads] = useState<Record<string, LatLng[]>>({});
  const roadFetch = useRef<Map<string, { at: number; from: LatLng; to: LatLng }>>(new Map());
  // Rider positions: start from what the dashboard already loaded, then keep them fresh while the map is open.
  const [locs, setLocs] = useState<any[]>(riderLocations);
  useEffect(() => { setLocs(riderLocations); }, [riderLocations]);
  useEffect(() => {
    let alive = true;
    const poll = async () => { if (document.hidden) return; const next = await loadRiderLocations(); if (alive) setLocs(next); };
    const t = window.setInterval(() => { void poll(); }, POLL_MS);
    void poll();
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  // Only deliveries that are actually on the road are tracked on the map.
  const deliveries = useMemo(() => orders
    .filter(o => o.type === "Delivery" && o.status === "OUT FOR-DELIVERY" && !o.customer_received_at)
    .filter(o => role === "delivery" ? o.rider_id === profileId : true)
    .map(o => ({ order: o, dest: destinationFor(o, station) })), [orders, role, profileId, station]);

  // Admin/staff load every rider. Riders and customers only get their own orders, so the rider list is rebuilt from those.
  const riderList = useMemo(() => {
    if (role === "admin" || role === "staff") return riders;
    const byId = new Map<string, any>();
    if (role === "delivery") byId.set(profileId, riders.find(r => r.profile_id === profileId) || { profile_id: profileId, full_name: "You", availability: "AVAILABLE" });
    deliveries.forEach(({ order: o }) => {
      if (!o.rider_id || byId.has(o.rider_id)) return;
      byId.set(o.rider_id, riders.find(r => r.profile_id === o.rider_id) || { profile_id: o.rider_id, full_name: o.rider_name || "Your rider", availability: "AVAILABLE" });
    });
    return [...byId.values()];
  }, [riders, role, profileId, deliveries]);

  const riderMarkers = useMemo(() => {
    return riderList.map((r, index) => {
      const active = deliveries.filter(d => d.order.rider_id === r.profile_id).sort((a, b) => String(a.order.out_for_delivery_at).localeCompare(String(b.order.out_for_delivery_at)))[0];
      const gps = locs.find(l => l.rider_id === r.profile_id && tick - new Date(l.updated_at).getTime() < GPS_FRESH_MS);
      // A rider with no fresh GPS (offline / not sharing) is shown at the shop. Several offline riders are
      // spread by a few metres so their markers don't hide each other.
      let pos: LatLng = { lat: station.lat + index * 0.00007, lng: station.lng + index * 0.00007 }, source = "Offline · at the shop", progress = 0, live = false;
      if (gps) {
        pos = { lat: Number(gps.lat), lng: Number(gps.lng) }; live = true;
        const secs = Math.max(0, Math.round((tick - new Date(gps.updated_at).getTime()) / 1000));
        source = `Live GPS · ${secs < 5 ? "just now" : `${secs}s ago`}`;
        progress = active ? gpsProgress(station, pos, active.dest) : 0;
      } else if (active && SIMULATE) {
        // Offline demo only: animate along the route so the offline demo is still watchable.
        progress = tripProgress(active.order, tick); pos = pointAlong(roads[String(active.order.id)] || routePoints(station, active.dest), progress); source = "Simulated route (demo)";
      } else if (active) source = "Offline · shown at the shop";
      return { rider: r, pos, active, source, progress, live, unavailable: r.availability === "UNAVAILABLE" && !active };
    });
  }, [riderList, locs, deliveries, tick, station, roads]);

  /** Progress, ETA and (for riders with a live fix) the rider's real position for one delivery. */
  const trip = (d: { order: any; dest: LatLng }) => {
    const m = riderMarkers.find(x => x.rider.profile_id === d.order.rider_id);
    if (m?.live && m.active?.order.id === d.order.id) {
      const road = roads[String(d.order.id)];
      const meters = road ? pathMeters(road, metersBetween) : metersBetween(m.pos, d.dest) * 1.3;
      return { progress: m.progress, eta: Math.max(1, Math.ceil(meters / RIDER_SPEED_M_PER_MIN)), from: m.pos as LatLng | null };
    }
    if (SIMULATE) {
      const progress = tripProgress(d.order, tick);
      return { progress, eta: Math.max(1, Math.ceil(((1 - progress) * SIM_TRIP_MS) / 60000)), from: null as LatLng | null };
    }
    // Rider is offline: they stay at the shop, so the whole road distance is still ahead.
    const road = roads[String(d.order.id)];
    const meters = road ? pathMeters(road, metersBetween) : metersBetween(station, d.dest) * 1.3;
    return { progress: 0, eta: Math.max(1, Math.ceil(meters / RIDER_SPEED_M_PER_MIN)), from: null as LatLng | null };
  };

  const sel = selected ? deliveries.find(d => String(d.order.id) === selected) : null;
  const selRider = sel ? riderMarkers.find(m => m.rider.profile_id === sel.order.rider_id) : null;

  // Ask the routing service for a street path. Refetched when a live rider has moved ~120 m (at most every 10 s).
  useEffect(() => {
    deliveries.forEach(d => {
      const id = String(d.order.id);
      const m = riderMarkers.find(x => x.rider.profile_id === d.order.rider_id);
      const from = m?.live && m.active?.order.id === d.order.id ? m.pos : station;
      const last = roadFetch.current.get(id);
      const moved = last ? metersBetween(last.from, from) : Infinity;
      const destChanged = last ? metersBetween(last.to, d.dest) > 20 : true;
      if (last && !destChanged && (moved < 120 || Date.now() - last.at < 10_000)) return;
      roadFetch.current.set(id, { at: Date.now(), from, to: d.dest });
      void fetchRoadRoute(from, d.dest).then(pts => { if (pts) setRoads(r => ({ ...r, [id]: pts })); });
    });
  }, [deliveries, riderMarkers, station]);

  // ---- Leaflet plumbing -------------------------------------------------------------------
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const riderLayer = useRef<Map<string, { marker: L.Marker; sig: string }>>(new Map());
  const fitKey = useRef<string | null>(null);
  const stationMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const map = L.map(host, { zoomControl: true, scrollWheelZoom: !compact, attributionControl: true }).setView([station.lat, station.lng], 14);
    let errors = 0;
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION });
    tiles.on("tileerror", () => { errors += 1; if (errors >= 4) setTilesFailed(true); });
    tiles.on("tileload", () => { if (errors) { errors = 0; setTilesFailed(false); } });
    tiles.addTo(map);
    stationMarker.current = L.marker([station.lat, station.lng], { icon: stationIcon(stationLabel), zIndexOffset: 500, keyboard: false }).addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);
    pinLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize()) : null;
    ro?.observe(host);
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => { ro?.disconnect(); riderLayer.current.clear(); map.remove(); mapRef.current = null; pinLayer.current = null; routeLayer.current = null; stationMarker.current = null; fitKey.current = null; };
  }, [compact]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move the shop marker when the owner/staff pin a new location.
  useEffect(() => { stationMarker.current?.setLatLng([station.lat, station.lng]).setIcon(stationIcon(stationLabel)); }, [station.lat, station.lng, stationLabel, compact]);

  // Frame the station and every active delivery whenever the set of deliveries changes (not on every tick).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const key = `${station.lat},${station.lng}|${deliveries.map(d => String(d.order.id)).sort().join(",")}`;
    if (fitKey.current === key) return;
    fitKey.current = key;
    if (!deliveries.length) { map.setView([station.lat, station.lng], 14); return; }
    const bounds = L.latLngBounds([toLL(station), ...deliveries.map(d => toLL(d.dest))]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [deliveries, station.lat, station.lng, compact]);

  // Delivery pins (rebuilt only when deliveries or the selection change).
  useEffect(() => {
    const layer = pinLayer.current; if (!layer) return;
    layer.clearLayers();
    deliveries.forEach(d => {
      const id = String(d.order.id); const isSel = id === selected;
      const label = (isSel || !compact) ? orderRef(d.order).replace("AW-000", "#") : "";
      L.marker(toLL(d.dest), { icon: pinIcon(label, isSel), zIndexOffset: isSel ? 400 : 200, title: `Delivery ${orderRef(d.order)}` })
        .on("click", () => setSelected(cur => cur === id ? null : id))
        .addTo(layer);
    });
  }, [deliveries, selected, compact]);

  // Route lines (refreshed every tick so the line follows the rider). A rider with live GPS gets a line from
  // their real position to the door; otherwise the simulated route from the shop is drawn and filled in.
  useEffect(() => {
    const layer = routeLayer.current; if (!layer) return;
    layer.clearLayers();
    deliveries.forEach(d => {
      const isSel = String(d.order.id) === selected;
      const t = trip(d);
      if (t.from) {
        L.polyline((roads[String(d.order.id)] || [t.from, d.dest]).map(toLL), { color: ON_THE_WAY, weight: 5, opacity: isSel ? 1 : 0.75, dashArray: "3 9", lineCap: "round" }).addTo(layer);
        return;
      }
      const plan = roads[String(d.order.id)] || routePoints(station, d.dest);
      L.polyline(plan.map(toLL), { color: ON_THE_WAY, weight: 4, opacity: isSel ? 1 : 0.6, dashArray: "3 9", lineCap: "round" }).addTo(layer);
      const done = SIMULATE ? tripProgress(d.order, tick) : 0;
      if (done > 0) {
        const steps = Array.from({ length: 60 }, (_, i) => pointAlong(plan, (done * i) / 59));
        L.polyline(steps.map(toLL), { color: ON_THE_WAY, weight: 6, opacity: 0.95, lineCap: "round" }).addTo(layer);
      }
    });
  }, [deliveries, tick, selected, riderMarkers, station, roads]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rider markers are kept alive and simply moved, so their pulse animation never restarts.
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const live = riderLayer.current; const seen = new Set<string>();
    riderMarkers.forEach(m => {
      const id = String(m.rider.profile_id); seen.add(id);
      const name = String(m.rider.full_name || "Rider").split(" ")[0] || "Rider";
      const sig = `${name}|${Boolean(m.active)}|${m.unavailable}|${m.live}`;
      const existing = live.get(id);
      if (!existing) {
        const marker = L.marker(toLL(m.pos), { icon: riderIcon(name, Boolean(m.active), m.unavailable), zIndexOffset: 600, keyboard: false }).addTo(map);
        live.set(id, { marker, sig });
      } else {
        existing.marker.setLatLng(toLL(m.pos));
        if (existing.sig !== sig) { existing.marker.setIcon(riderIcon(name, Boolean(m.active), m.unavailable)); existing.sig = sig; }
      }
    });
    live.forEach((entry, id) => { if (!seen.has(id)) { entry.marker.remove(); live.delete(id); } });
  }, [riderMarkers, compact]);

  // Bring the selected delivery into view.
  useEffect(() => {
    const map = mapRef.current; if (!map || !sel) return;
    map.panTo(toLL(sel.dest), { animate: true });
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`live-map ${compact ? "compact" : ""}`}>
      <div className="map-frame">
        <div ref={hostRef} className="leaflet-host" role="application" aria-label="Delivery map showing the shop, riders and delivery addresses" />
        {tilesFailed && <div className="map-offline" role="status">Map tiles could not load. Check your internet connection.</div>}
        <div className="map-legend" aria-hidden="true">
          <span><i style={{ background: ON_THE_WAY }} />On the way</span>
          <span><i className="rider" />Rider</span>
          <span><i className="station" />Shop</span>
        </div>
      </div>

      {!compact && (
        <aside className="map-side">
          <h3>Active deliveries <span className="count-chip">{deliveries.length}</span></h3>
          {!deliveries.length && <EmptyState title="No active deliveries" text="Deliveries appear here once a rider is on the way." />}
          <ul className="map-list">
            {deliveries.map(d => {
              const m = riderMarkers.find(x => x.rider.profile_id === d.order.rider_id); const { progress: pr, eta } = trip(d);
              return (
                <li key={d.order.id} className={String(d.order.id) === selected ? "selected" : ""}>
                  <button onClick={() => setSelected(String(d.order.id) === selected ? null : String(d.order.id))}>
                    <span className="map-list-top"><strong>{orderRef(d.order)}</strong><Status status={d.order.status} /></span>
                    <small><Home size={12} /> {d.order.address || "Delivery address on file"}</small>
                    <small><Bike size={12} /> {d.order.rider_name || m?.rider.full_name || "Rider on the way"} · about {eta} min away</small>
                    <span className="map-progress"><i style={{ width: `${Math.round(pr * 100)}%` }} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          {sel && <div className="map-detail"><strong>{orderRef(sel.order)}</strong><span>{sel.order.customer_name || "Customer"}</span><span>{sel.order.address}</span>{selRider && <span><Navigation size={12} /> {selRider.source}</span>}</div>}
          <h3 style={{ marginTop: 18 }}>Riders</h3>
          <ul className="map-list riders">
            {riderMarkers.map(m => (
              <li key={m.rider.profile_id}><span className="map-list-top"><strong><Bike size={13} /> {m.rider.full_name}</strong><span className={`status ${m.active ? "warning" : m.unavailable ? "muted" : "success"}`}>{m.active ? "On delivery" : m.unavailable ? "Unavailable" : "Available"}</span></span><small><MapPin size={12} /> {m.source}</small></li>
            ))}
            {!riderMarkers.length && <li><small>No riders to show.</small></li>}
          </ul>
        </aside>
      )}
    </div>
  );
}

export { ShareLocationButton } from "./riderSharing";
