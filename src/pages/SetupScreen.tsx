import React from "react";
import { Droplets, ShieldCheck } from "lucide-react";

export function SetupScreen({ onBack }: { onBack?: () => void }) {
  return (
    <div className="setup-page">
      <div className="setup-card">
        <span className="brand-mark">
          <Droplets />
        </span>
        {onBack && (
          <button className="btn secondary" onClick={onBack}>
            Back to landing page
          </button>
        )}
        <p className="eyebrow">FIRST-TIME SETUP</p>
        <h1>Connect AquaWell to Supabase</h1>
        <p className="muted">
          This clean implementation does not contain project credentials.
          Configure the public client key locally to enable authenticated
          database access.
        </p>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>.
          </li>
          <li>
            Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to your Supabase project values.
          </li>
          <li>
            Apply reviewed SQL migrations in order after checking your existing
            constraints and RLS policies.
          </li>
          <li>Restart the Vite development server.</li>
        </ol>
        <div className="alert info">
          <ShieldCheck size={18} /> Never place a Supabase service-role key in
          frontend environment variables.
        </div>
      </div>
    </div>
  );
}
