import { useCallback, useEffect, useRef, useState } from "react";

type Kind = "local" | "session";
const store = (kind: Kind): Storage | null => { try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; } };

export function readStored<T>(key: string, fallback: T, kind: Kind = "session"): T {
  try { const raw = store(kind)?.getItem(key); return raw == null ? fallback : (JSON.parse(raw) as T); } catch { return fallback; }
}
export function writeStored(key: string, value: unknown, kind: Kind = "session") {
  try { store(kind)?.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: the app still works */ }
}
export function removeStored(key: string, kind: Kind = "session") { try { store(kind)?.removeItem(key); } catch { /* ignore */ } }

/** useState that survives reloads and page navigation. Session storage by default; pass "local" for long-lived data. */
export function usePersistentState<T>(key: string, initial: T, kind: Kind = "session"): [T, (v: T | ((p: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => readStored(key, initial, kind));
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current !== key) { keyRef.current = key; setValue(readStored(key, initial, kind)); return; }
    writeStored(key, value, kind);
  }, [key, value, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback(() => { removeStored(key, kind); setValue(initial); }, [key, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, setValue, clear];
}
