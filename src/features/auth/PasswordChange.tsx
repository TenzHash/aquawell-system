import React, { useState } from "react";
import { authApi, friendlyError } from "../../lib/data";
import { useConfirm } from "../../components/ui/ConfirmDialog";

export function PasswordChange({ email = "" }: { email?: string }) {
  const { confirm: askConfirm } = useConfirm();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (newPass !== confirm) {
      setMsg("New password and confirmation do not match.");
      return;
    }
    if (newPass.length < 8) {
      setMsg("Use at least 8 characters for the new password.");
      return;
    }
    if (!(await askConfirm({ title: "Change your password?", message: "You will use the new password the next time you sign in.", confirmLabel: "Update password", tone: "warning" }))) return;
    setBusy(true);
    try {
      await authApi.changePassword(oldPass, newPass, email);
      setMsg("Password updated successfully.");
      setOldPass("");
      setNewPass("");
      setConfirm("");
    } catch (e: any) {
      setMsg(friendlyError(e, "We couldn’t change your password."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="password-section">
      <h3>Change password</h3>
      <p className="muted">
        Enter your current password first, then choose a new one (at least 8 characters).
      </p>
      <form onSubmit={submit} className="password-grid">
        <label>
          Current password
          <input
            type="password"
            required
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            minLength={8}
            required
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
      {msg && (
        <p
          className={`form-feedback ${msg.includes("successfully") ? "success-text" : "error-text"}`}
          role={msg.includes("successfully") ? "status" : "alert"}
          aria-live="polite"
        >
          {msg}
        </p>
      )}
    </div>
  );
}
