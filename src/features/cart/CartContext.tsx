import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePersistentState } from "../../utils/persist";
import type { PinValue } from "../map/DeliveryPin";

interface CartApi {
  lines: Record<string, number>;
  count: number;
  add: (id: string | number, max?: number) => void;
  setQty: (id: string | number, qty: number, max?: number) => void;
  remove: (id: string | number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  fulfillment: string; setFulfillment: (v: string) => void;
  address: string; setAddress: (v: string | ((p: string) => string)) => void;
  pin: PinValue | null; setPin: (v: PinValue | null) => void;
}
const Ctx = createContext<CartApi | null>(null);
export const useCart = () => { const c = useContext(Ctx); if (!c) throw new Error("Cart is not available here."); return c; };

/** Cart contents live in localStorage (per account) so they survive reloads, navigation and closing the tab.
 *  The checkout form (delivery option + address) lives in sessionStorage for the current visit. */
export function CartProvider({ userId, defaultAddress, defaultPin, children }: { userId: string; defaultAddress?: string; defaultPin?: PinValue | null; children: React.ReactNode }) {
  const [lines, setLines] = usePersistentState<Record<string, number>>(`aquawell-cart-${userId}`, {}, "local");
  const [fulfillment, setFulfillment] = usePersistentState<string>(`aquawell-checkout-fulfillment-${userId}`, "Pickup");
  const [address, setAddress] = usePersistentState<string>(`aquawell-checkout-address-${userId}`, defaultAddress || "");
  const [pin, setPin] = usePersistentState<PinValue | null>(`aquawell-checkout-pin-${userId}`, defaultPin || null);
  const [open, setOpen] = useState(false);

  const setQty = useCallback((id: string | number, qty: number, max?: number) => {
    setLines(prev => {
      const next = { ...prev }; const q = Math.max(0, Math.min(max ?? 999, Math.floor(qty)));
      if (q <= 0) delete next[String(id)]; else next[String(id)] = q;
      return next;
    });
  }, [setLines]);
  const add = useCallback((id: string | number, max?: number) => setLines(prev => { const q = Math.min(max ?? 999, (prev[String(id)] || 0) + 1); return { ...prev, [String(id)]: q }; }), [setLines]);
  const remove = useCallback((id: string | number) => setLines(prev => { const n = { ...prev }; delete n[String(id)]; return n; }), [setLines]);
  const clear = useCallback(() => setLines({}), [setLines]);
  const count = useMemo(() => Object.values(lines).reduce((n, q) => n + q, 0), [lines]);

  const api = useMemo<CartApi>(() => ({ lines, count, add, setQty, remove, clear, open, setOpen, fulfillment, setFulfillment, address, setAddress, pin, setPin }), [lines, count, add, setQty, remove, clear, open, fulfillment, setFulfillment, address, setAddress, pin, setPin]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
