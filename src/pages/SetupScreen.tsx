import React from "react";
import { Droplets } from "lucide-react";
import { STATION } from "../config/station";

export function SetupScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <span className="brand-mark"><Droplets /></span>
        <p className="eyebrow">TEMPORARILY UNAVAILABLE</p>
        <h1>Online ordering is paused</h1>
        <p className="muted">We can’t connect to the ordering system right now. Please try again in a little while, or contact the station directly.</p>
        <p><strong>{STATION.phone}</strong><br />{STATION.email}</p>
        {onBack && <button className="btn primary" onClick={onBack}>Back to home</button>}
      </div>
    </div>
  );
}
