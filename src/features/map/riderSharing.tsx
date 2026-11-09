import React, { useEffect, useRef, useSyncExternalStore } from "react";
import { Radio, RadioTower } from "lucide-react";
import { shareRiderLocation } from "../../lib/data";

// One shared GPS watcher for the whole app, so a rider's position keeps flowing while they move
// between pages. It switches on by itself when a delivery is "out for delivery", and a rider can also
// turn it on by hand from the Live Map.

export type SharingStatus = "idle" | "waiting" | "sharing" | "denied" | "unsupported";
interface SharingState { manual: boolean; status: SharingStatus; lastSentAt: number; }

let state: SharingState = { manual: false, status: "idle", lastSentAt: 0 };
const listeners = new Set<() => void>();
const setState = (patch: Partial<SharingState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state;

export const setManualSharing = (on: boolean) => setState({ manual: on, ...(on ? {} : { status: state.status === "denied" ? "idle" : state.status }) });
export const useSharingState = () => useSyncExternalStore(subscribe, snapshot, snapshot);

const SEND_EVERY_MS = 10_000;

/** Render once for signed-in riders. `active` is true while any of their deliveries is out for delivery. */
export function RiderLocationBroadcaster({ active }: { active: boolean }) {
  const { manual } = useSharingState();
  const enabled = active || manual;
  const latest = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled) { latest.current = null; setState({ status: "idle", lastSentAt: 0 }); return; }
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) { setState({ status: "unsupported", manual: false }); return; }
    setState({ status: "waiting" });
    let stopped = false;
    const send = () => {
      const p = latest.current; if (!p || stopped) return;
      void shareRiderLocation(p.lat, p.lng);
      setState({ status: "sharing", lastSentAt: Date.now() });
    };
    const watchId = navigator.geolocation.watchPosition(
      pos => { const first = !latest.current; latest.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; if (first) send(); },
      err => { if (err.code === err.PERMISSION_DENIED) { setState({ status: "denied", manual: false }); } },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    // Keep the rider's screen awake during an active trip so foreground GPS sharing is less likely to pause.
    // Wake Lock is best-effort and is not a substitute for native background GPS.
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try { wakeLock = await (navigator as any).wakeLock.request("screen"); } catch { /* unsupported or denied */ }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") void requestWakeLock(); };
    void requestWakeLock();
    document.addEventListener("visibilitychange", onVisibility);
    // Heartbeat: keep sending the last known fix even when the rider is standing still.
    const timer = window.setInterval(send, SEND_EVERY_MS);
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (wakeLock) void wakeLock.release().catch(() => {});
    };
  }, [enabled]);

  return null;
}

const MESSAGES: Record<SharingStatus, string> = {
  idle: "", waiting: "Finding your location…", sharing: "Your live location is visible to the station and your customer.",
  denied: "Location permission was denied. Allow location access in your browser settings to be shown on the map.",
  unsupported: "This device can’t share its location.",
};

/** Rider control on the Live Map: automatic while out for delivery, optional otherwise. */
export function ShareLocationButton({ autoActive = false }: { autoActive?: boolean }) {
  const { manual, status } = useSharingState();
  const msg = MESSAGES[status];
  return (
    <div className="share-location">
      {autoActive
        ? <span className="status warning"><RadioTower size={14} /> Sharing automatically while out for delivery</span>
        : <button className={`btn small ${manual ? "primary" : "secondary"}`} onClick={() => setManualSharing(!manual)}><Radio size={14} /> {manual ? "Stop sharing location" : "Share my live location"}</button>}
      {msg && <small className={status === "denied" || status === "unsupported" ? "danger-text" : "muted"}>{msg}</small>}
    </div>
  );
}
