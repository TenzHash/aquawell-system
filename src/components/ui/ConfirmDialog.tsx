import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export type ConfirmOptions = {
  title?: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone of the confirm button / icon. */
  tone?: "primary" | "warning" | "danger";
  /** When set, the dialog also asks for a text value (e.g. a reference number). */
  input?: { label: string; placeholder?: string; required?: boolean; initialValue?: string };
};

type Pending = { options: ConfirmOptions; resolve: (value: { ok: boolean; value: string }) => void };

type ConfirmApi = {
  /** Resolves true when the user confirms, false when they cancel. */
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
  /** Resolves with the typed text when confirmed, or null when cancelled. */
  prompt: (options: ConfirmOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmApi>({
  confirm: async () => true,
  prompt: async () => "",
});

export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [text, setText] = useState("");
  const queue = useRef<Pending[]>([]);

  const currentRef = useRef<Pending | null>(null);

  const show = useCallback((options: ConfirmOptions) => {
    return new Promise<{ ok: boolean; value: string }>((resolve) => {
      const item: Pending = { options, resolve };
      if (currentRef.current) {
        queue.current.push(item);
        return;
      }
      currentRef.current = item;
      setText(options.input?.initialValue ?? "");
      setPending(item);
    });
  }, []);

  const api = useRef<ConfirmApi>({
    confirm: async (options = {}) => (await show(options)).ok,
    prompt: async (options) => {
      const result = await show(options);
      return result.ok ? result.value : null;
    },
  });

  const finish = (ok: boolean) => {
    if (!pending) return;
    const value = text.trim();
    pending.resolve({ ok, value });
    const next = queue.current.shift() || null;
    currentRef.current = next;
    setText(next?.options.input?.initialValue ?? "");
    setPending(next);
  };

  return (
    <ConfirmContext.Provider value={api.current}>
      {children}
      {pending && (
        <ConfirmDialog
          options={pending.options}
          text={text}
          setText={setText}
          onCancel={() => finish(false)}
          onConfirm={() => finish(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  options,
  text,
  setText,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  text: string;
  setText: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const tone = options.tone || "primary";
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const needsText = Boolean(options.input?.required) && !text.trim();

  useEffect(() => {
    (options.input ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = tone === "primary" ? CheckCircle2 : AlertTriangle;

  return (
    <div className="confirm-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onSubmit={(e) => { e.preventDefault(); if (!needsText) onConfirm(); }}
      >
        <div className="confirm-body">
          <span className={`confirm-icon ${tone}`}><Icon size={22} /></span>
          <div className="confirm-copy">
            <h2 id="confirm-title">{options.title || "Please confirm"}</h2>
            <div id="confirm-message" className="confirm-message">{options.message || "Are you sure you want to continue with this action?"}</div>
            {options.input && (
              <label className="confirm-input">
                {options.input.label}
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={options.input.placeholder}
                  autoComplete="off"
                />
              </label>
            )}
          </div>
          <button type="button" className="icon-button confirm-close" aria-label="Close" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn secondary" onClick={onCancel}>{options.cancelLabel || "Cancel"}</button>
          <button ref={confirmRef} type="submit" className={`btn primary confirm-${tone}`} disabled={needsText}>
            {options.confirmLabel || "Yes, continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
