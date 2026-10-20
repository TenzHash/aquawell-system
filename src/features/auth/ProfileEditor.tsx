import React, { useEffect, useState } from "react";
import { updateOwnProfile, type Profile } from "../../lib/data";
import { useConfirm } from "../../components/ui/ConfirmDialog";

type Props = { profile: Profile; onSaved: (profile: Profile) => void };

export function ProfileEditor({ profile, onSaved }: Props) {
  const { confirm } = useConfirm();
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [address, setAddress] = useState(profile.address || "");
  const [barangay, setBarangay] = useState(profile.barangay || "");
  const [landmark, setLandmark] = useState(profile.landmark || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setAddress(profile.address || "");
    setBarangay(profile.barangay || "");
    setLandmark(profile.landmark || "");
  }, [profile.id, profile.full_name, profile.phone, profile.address, profile.barangay, profile.landmark]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!fullName.trim()) return setError("Please enter your full name.");
    if (phone.trim() && !/^[+()\d\s.-]{7,20}$/.test(phone.trim())) return setError("Enter a valid phone number.");
    if (profile.role === "customer" && !address.trim()) return setError("Please enter your delivery address.");
    if (!(await confirm({ title: "Save profile changes?", message: "Your contact and delivery details will be updated.", confirmLabel: "Save profile" }))) return;
    setBusy(true);
    try {
      const updated = await updateOwnProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        barangay: barangay.trim() || null,
        landmark: landmark.trim() || null,
      });
      onSaved(updated);
      setSuccess("Your profile was saved successfully.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to save your profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="profile-editor" onSubmit={submit} noValidate>
      <div className="profile-editor-grid">
        <label>Full name<input autoComplete="name" required maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label>Phone number<input autoComplete="tel" inputMode="tel" maxLength={20} value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <label>Address<input autoComplete="street-address" maxLength={150} required={profile.role === "customer"} value={address} onChange={e => setAddress(e.target.value)} /></label>
        <label>Barangay<input maxLength={100} value={barangay} onChange={e => setBarangay(e.target.value)} /></label>
        <label className="profile-editor-wide">Landmark / delivery notes<input maxLength={200} value={landmark} onChange={e => setLandmark(e.target.value)} /></label>
      </div>
      {error && <p className="form-feedback error-text" role="alert">{error}</p>}
      {success && <p className="form-feedback success-text" role="status">{success}</p>}
      <button className="btn primary" disabled={busy} type="submit">{busy ? "Saving profile…" : "Save profile"}</button>
    </form>
  );
}
