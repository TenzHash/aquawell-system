import React, { useState } from "react";
import { Download, ShieldAlert, Trash2, X } from "lucide-react";
import { deleteMyAccount, exportMyData, friendlyError } from "../../lib/data";

/** Customer privacy controls: download your data, then permanently delete your account. */
export function DeleteAccount({ email, onDeleted }: { email: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState(""); const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [info, setInfo] = useState("");

  async function download() {
    setError(""); setInfo("");
    try {
      const data = await exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "my-aquawell-data.json"; a.click(); URL.revokeObjectURL(url);
      setInfo("Your data was downloaded.");
    } catch (e) { setError(friendlyError(e, "We couldn’t prepare your data.")); }
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try { await deleteMyAccount(password, email); onDeleted(); } catch (err) { setError(friendlyError(err, "We couldn’t delete your account.")); } finally { setBusy(false); }
  }
  return (
    <section className="danger-zone" aria-labelledby="danger-title">
      <div><h3 id="danger-title"><ShieldAlert size={18} /> Privacy and account deletion</h3>
        <p>You can download a copy of your personal data at any time. Deleting your account removes your profile, saved address, notifications and company links. Past orders are kept without your name for the station’s accounting records.</p></div>
      {error && !open && <div className="alert error">{error}</div>}{info && <div className="alert info">{info}</div>}
      <div className="danger-actions">
        <button className="btn secondary" onClick={download}><Download size={15} /> Download my data</button>
        <button className="btn danger" onClick={() => { setOpen(true); setError(""); setPassword(""); setTyped(""); }}><Trash2 size={15} /> Delete my account</button>
      </div>
      {open && (
        <div className="modal-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
          <form className="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="del-title" onSubmit={remove}>
            <div className="panel-heading"><div><h2 id="del-title">Delete your account?</h2><p>This can’t be undone. You’ll be signed out immediately.</p></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setOpen(false)} disabled={busy}><X size={18} /></button></div>
            <div className="form-stack modal-body">
              {error && <div className="alert error" role="alert">{error}</div>}
              <label>Enter your password to confirm<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus /></label>
              <label>Type <b>DELETE</b> to continue<input value={typed} onChange={e => setTyped(e.target.value)} placeholder="DELETE" autoComplete="off" /></label>
            </div>
            <div className="confirm-actions"><button type="button" className="btn secondary" onClick={() => setOpen(false)} disabled={busy}>Keep my account</button>
              <button className="btn danger" disabled={busy || typed.trim() !== "DELETE" || !password}>{busy ? "Deleting…" : "Delete permanently"}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
