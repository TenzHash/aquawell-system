import React from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  onText?: string;
  offText?: string;
  title?: string | undefined;
};

/** Accessible on/off switch (role="switch"). */
export function ToggleSwitch({ checked, onChange, disabled, label, onText = "On", offText = "Off", title }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      className={`toggle-switch ${checked ? "on" : "off"}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span className="toggle-text">{checked ? onText : offText}</span>
    </button>
  );
}
