import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import type { StationPin } from "../../config/station";
import { clearMyDeliveryPin, saveMyDeliveryPin, type Profile } from "../../lib/data";
import { DeliveryPin, type PinValue } from "../map/DeliveryPin";

/** Account page: save, move or remove the pin used for home deliveries. */
export function DeliveryPinSettings({ profile, station, hasActiveDelivery, action, busy, onProfileUpdated }: { profile: Profile; station: StationPin; hasActiveDelivery: boolean; action: any; busy: boolean; onProfileUpdated?: (p: Profile) => void }) {
  const saved: PinValue | null = profile.pin_lat != null && profile.pin_lng != null ? { lat: Number(profile.pin_lat), lng: Number(profile.pin_lng) } : null;
  const [draft, setDraft] = useState<PinValue | null>(saved);
  useEffect(() => { setDraft(saved); }, [profile.pin_lat, profile.pin_lng]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = draft && (!saved || draft.lat !== saved.lat || draft.lng !== saved.lng);

  const save = async () => {
    if (!draft) return;
    const ok = await action(() => saveMyDeliveryPin(draft.lat, draft.lng), "Delivery pin saved.", { confirm: false });
    if (ok) onProfileUpdated?.({ ...profile, pin_lat: draft.lat, pin_lng: draft.lng });
  };
  const remove = async () => {
    if (!saved) { setDraft(null); return; }
    const ok = await action(() => clearMyDeliveryPin(), "Delivery pin removed.", { confirm: { title: "Remove your pin?", message: "Your saved delivery location will be removed. You can pin it again any time.", confirmLabel: "Remove pin", tone: "warning" } });
    if (ok) onProfileUpdated?.({ ...profile, pin_lat: null, pin_lng: null });
  };

  return (
    <div className="panel account-details" style={{ display: "grid", gap: 10 }}>
      <div className="panel-heading account-form-heading"><div><h2><MapPin size={18} style={{ verticalAlign: "middle", marginRight: 6 }} />Delivery pin</h2><p>Pin your exact delivery spot so the rider can find you and you can follow your delivery on the map.</p></div></div>
      <DeliveryPin value={draft} onChange={setDraft} onRemove={remove} canRemove={!hasActiveDelivery || !saved} station={station} busy={busy} />
      <div><button className="btn primary" type="button" disabled={busy || !changed} onClick={save}>Save pin</button></div>
    </div>
  );
}
