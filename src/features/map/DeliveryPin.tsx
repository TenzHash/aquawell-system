import React, { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPinOff } from "lucide-react";
import type { StationPin } from "../../config/station";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";
const pinIcon = L.divIcon({ className: "lf-icon", html: `<div class="lf-pin selected"><i></i></div>`, iconSize: [30, 38], iconAnchor: [15, 38] });
const round = (n: number) => Math.round(n * 1e6) / 1e6;

export interface PinValue { lat: number; lng: number; }

/** Best-effort street address for a pin (OpenStreetMap Nominatim). Returns null if unavailable. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" } });
    const json = await res.json();
    return typeof json?.display_name === "string" ? json.display_name.split(", ").slice(0, 4).join(", ") : null;
  } catch { return null; }
}

interface Props {
  value: PinValue | null;
  onChange: (pin: PinValue) => void;
  onRemove: () => void;
  /** False while the customer has an active delivery: the pin can still be moved, but not removed. */
  canRemove: boolean;
  station: StationPin;
  busy?: boolean;
}

/** Map for choosing where the delivery goes: tap the map, drag the pin, or use the current location. */
export function DeliveryPin({ value, onChange, onRemove, canRemove, station, busy = false }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const [note, setNote] = useState("");

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const start = value || station;
    const map = L.map(host, { zoomControl: true, scrollWheelZoom: false }).setView([start.lat, start.lng], value ? 17 : 14);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
    const place = (lat: number, lng: number) => {
      if (!markerRef.current) {
        const m = L.marker([lat, lng], { icon: pinIcon, draggable: true, title: "Drag to adjust your delivery pin" }).addTo(map);
        m.on("dragend", () => { const p = m.getLatLng(); onChangeRef.current({ lat: round(p.lat), lng: round(p.lng) }); });
        markerRef.current = m;
      } else markerRef.current.setLatLng([lat, lng]);
    };
    (map as any)._place = place;
    if (value) place(value.lat, value.lng);
    map.on("click", (e: L.LeafletMouseEvent) => { place(e.latlng.lat, e.latlng.lng); onChangeRef.current({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) }); });
    mapRef.current = map;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => map.invalidateSize()) : null;
    ro?.observe(host); window.setTimeout(() => map.invalidateSize(), 0);
    return () => { ro?.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow outside changes (saved pin loaded, pin removed).
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return; }
    (map as any)._place(value.lat, value.lng);
    if (!map.getBounds().contains([value.lat, value.lng])) map.setView([value.lat, value.lng], 17);
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) { setNote("This device can’t share its location. Tap the map to place your pin."); return; }
    setNote("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      p => { const lat = round(p.coords.latitude), lng = round(p.coords.longitude); mapRef.current?.setView([lat, lng], 17); onChange({ lat, lng }); setNote("Pin placed where you are. Drag it to fine-tune."); },
      () => setNote("We couldn’t get your location. Allow location access, or tap the map to place your pin."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="delivery-pin">
      <div className="delivery-pin-actions">
        <button type="button" className="btn small secondary" onClick={useMyLocation}><LocateFixed size={14} /> Use my current location</button>
        <button type="button" className="btn small secondary" disabled={!value || !canRemove || busy} onClick={onRemove}
          title={!canRemove ? "You can remove your pin once your active delivery is completed." : undefined}><MapPinOff size={14} /> Remove pin</button>
      </div>
      <div className="delivery-pin-map"><div ref={hostRef} className="leaflet-host" role="application" aria-label="Map for pinning your delivery location. Tap the map or drag the pin." /></div>
      <small className="muted">{value ? "Drag the pin or tap the map to move it." : "Tap the map to drop a pin on your delivery location, or use your current location."}</small>
      {!canRemove && value && <small className="muted">You have an active delivery, so the pin can’t be removed until it is completed.</small>}
      {note && <small role="status">{note}</small>}
    </div>
  );
}
