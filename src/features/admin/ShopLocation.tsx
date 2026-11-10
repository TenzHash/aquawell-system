import React, { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { STATION, type StationPin } from "../../config/station";
import { saveStationLocation } from "../../lib/data";
import { dateFmt } from "../../utils/formatters";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
const shopIcon = L.divIcon({ className: "lf-icon", html: `<div class="lf-station"><span>★</span></div>`, iconSize: [38, 38], iconAnchor: [19, 19] });
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Owner / staff drop a pin on the map to tell AquaWell where the shop is. Riders' routes and customers' tracking start from it. */
export function ShopLocation({ station, action, busy }: { station: StationPin; action: any; busy: boolean }) {
  const [pin, setPin] = useState({ lat: station.lat, lng: station.lng });
  const [label, setLabel] = useState(station.label || "");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Follow the saved location whenever it changes (e.g. after saving or a refresh).
  useEffect(() => { setPin({ lat: station.lat, lng: station.lng }); setLabel(station.label || ""); }, [station.lat, station.lng, station.label]);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const map = L.map(host, { zoomControl: true, scrollWheelZoom: true }).setView([pin.lat, pin.lng], 16);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    const marker = L.marker([pin.lat, pin.lng], { icon: shopIcon, draggable: true, keyboard: true, title: "Drag to move the shop pin" }).addTo(map);
    marker.on("dragend", () => { const p = marker.getLatLng(); setPin({ lat: round(p.lat), lng: round(p.lng) }); });
    map.on("click", (e: L.LeafletMouseEvent) => { marker.setLatLng(e.latlng); setPin({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }); });
    mapRef.current = map; markerRef.current = marker;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize()) : null;
    ro?.observe(host); window.setTimeout(() => map.invalidateSize(), 0);
    return () => { ro?.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the marker in step with the coordinates (search, "use my location", save).
  useEffect(() => {
    markerRef.current?.setLatLng([pin.lat, pin.lng]);
    const map = mapRef.current; if (map && !map.getBounds().contains([pin.lat, pin.lng])) map.panTo([pin.lat, pin.lng]);
  }, [pin.lat, pin.lng]);

  const moveTo = (lat: number, lng: number, zoom = 17) => { setPin({ lat: round(lat), lng: round(lng) }); mapRef.current?.setView([lat, lng], zoom); };

  const useMyLocation = () => {
    setNote("");
    if (!("geolocation" in navigator)) { setNote("This device can’t share its location. Click the map to place the pin instead."); return; }
    setNote("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      p => { moveTo(p.coords.latitude, p.coords.longitude); setNote("Pin moved to where you are now. Adjust it if needed, then save."); },
      () => setNote("We couldn’t get your location. Allow location access, or click the map to place the pin."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const findAddress = async (e: React.FormEvent) => {
    e.preventDefault(); const q = query.trim(); if (!q) return;
    setSearching(true); setNote("");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      const hits = await res.json();
      if (Array.isArray(hits) && hits[0]) { moveTo(Number(hits[0].lat), Number(hits[0].lon)); setNote("Found it. Fine-tune the pin by dragging it, then save."); }
      else setNote("No match for that address. Try a nearby landmark, or click the map to place the pin.");
    } catch { setNote("Address search isn’t available right now. Click the map to place the pin instead."); }
    finally { setSearching(false); }
  };

  const changed = round(pin.lat) !== round(station.lat) || round(pin.lng) !== round(station.lng) || label.trim() !== (station.label || "");
  const save = () => action(() => saveStationLocation(pin.lat, pin.lng, label.trim() || null), "Shop location saved.",
    { confirm: { title: "Save shop location?", message: "Riders’ routes and your customers’ delivery tracking will start from this pin.", confirmLabel: "Save location" } });

  return (
    <section className="panel shop-location">
      <div className="panel-heading"><div><h2><MapPin size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Shop location</h2>
        <p>Pin where {STATION.shortName} is on the map. Delivery routes and customer tracking start from this spot.</p></div></div>
      {!station.pinned && <div className="alert info" style={{ margin: "0 16px 12px" }}>The shop has not been pinned yet, so a default position is being used. Drop the pin on your shop and save.</div>}
      <div className="shop-location-body">
        <div className="map-frame"><div ref={hostRef} className="leaflet-host" role="application" aria-label="Map for pinning the shop location. Click the map or drag the pin." /></div>
        <aside className="shop-location-side">
          <form className="shop-search" onSubmit={findAddress}>
            <label className="search-box"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your street or barangay…" aria-label="Search for an address" /></label>
            <button className="btn small secondary" type="submit" disabled={searching || !query.trim()}>{searching ? "Searching…" : "Find"}</button>
          </form>
          <button className="btn secondary" type="button" onClick={useMyLocation}><LocateFixed size={16} /> Use my current location</button>
          <label className="stack-field"><span>Pin label (optional)</span>
            <input className="field-control" value={label} maxLength={60} onChange={e => setLabel(e.target.value)} placeholder={`${STATION.shortName} Shop`} /></label>
          <dl className="coord-list"><div><dt>Latitude</dt><dd>{pin.lat.toFixed(6)}</dd></div><div><dt>Longitude</dt><dd>{pin.lng.toFixed(6)}</dd></div></dl>
          <small className="muted">Click the map or drag the star to place the pin exactly on your shop.</small>
          {note && <small role="status">{note}</small>}
          <button className="btn primary" type="button" disabled={busy || !changed} onClick={save}>Save shop location</button>
          {station.pinned && station.updated_at && <small className="muted">Last saved {dateFmt(station.updated_at)}</small>}
        </aside>
      </div>
    </section>
  );
}
