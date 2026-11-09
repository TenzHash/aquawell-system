import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Droplets, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { money } from "../../utils/formatters";
import { clearMyDeliveryPin, createCustomerOrder, saveMyDeliveryPin } from "../../lib/data";
import { DEFAULT_STATION_PIN, type StationPin } from "../../config/station";
import { DeliveryPin, reverseGeocode } from "../map/DeliveryPin";
import { useCart } from "./CartContext";

/** Popup cart: quantity steppers, live subtotal, delivery option and one-tap checkout. */
export function CartDrawer({ inventory, action, onNavigate, profile, station = DEFAULT_STATION_PIN, hasActiveDelivery = false, onProfileUpdated }: { inventory: any[]; action: any; onNavigate: (p: string) => void; profile?: any; station?: StationPin; hasActiveDelivery?: boolean; onProfileUpdated?: (p: any) => void }) {
  const cart = useCart();
  const [problem, setProblem] = useState<string[] | null>(null);

  const rows = useMemo(() => Object.entries(cart.lines).map(([id, qty]) => ({ item: inventory.find(i => String(i.id) === id), qty, id })), [cart.lines, inventory]);
  const valid = rows.filter(r => r.item);
  const subtotal = valid.reduce((n, r) => n + Number(r.item.price) * r.qty, 0);

  // Remove lines for products that no longer exist, and trim quantities to current stock.
  useEffect(() => {
    if (!inventory.length) return;
    rows.forEach(r => { if (!r.item) cart.remove(r.id); else if (Number(r.item.stock) > 0 && r.qty > Number(r.item.stock)) cart.setQty(r.id, Number(r.item.stock)); });
  }, [inventory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cart.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cart.setOpen(false); };
    document.addEventListener("keydown", onKey); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [cart.open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.open) return null;

  const savedPin = profile && profile.pin_lat != null && profile.pin_lng != null ? { lat: Number(profile.pin_lat), lng: Number(profile.pin_lng) } : null;

  const placeOrder = async () => {
    const short = valid.filter(r => Number(r.item.stock) < r.qty);
    if (short.length) { setProblem(short.map(r => Number(r.item.stock) <= 0 ? `${r.item.name} is out of stock.` : `${r.item.name}: only ${r.item.stock} left (you have ${r.qty} in your cart).`)); return; }
    if (cart.fulfillment === "Delivery" && !cart.address.trim()) { setProblem(["Please enter your delivery address."]); return; }
    const pin = cart.fulfillment === "Delivery" ? cart.pin : null;
    const ok = await action(async () => {
      try {
        await createCustomerOrder({ fulfillment: cart.fulfillment, address: cart.fulfillment === "Delivery" ? cart.address.trim() : undefined, items: valid.map(r => ({ inventory_id: r.item.id, quantity: r.qty })), dest_lat: pin?.lat, dest_lng: pin?.lng });
      } catch (e: any) {
        if (/not enough stock|no longer|out of stock/i.test(String(e?.message))) { setProblem([String(e.message)]); const h: any = new Error(e.message); h.silent = true; throw h; }
        throw e;
      }
      // Remember the pin for next time (the order itself is already placed, so a failure here is not fatal).
      if (pin && (!savedPin || savedPin.lat !== pin.lat || savedPin.lng !== pin.lng)) { try { await saveMyDeliveryPin(pin.lat, pin.lng); } catch { /* optional */ } }
      cart.clear(); cart.setOpen(false); onNavigate("My Orders");
    }, "Order placed! We’ll confirm it shortly.", { confirm: { title: "Place this order?", message: `${cart.count} item(s) · ${money(subtotal)} · ${cart.fulfillment === "Pickup" ? "Pick up at the station" : pin ? "Home delivery to your pinned location" : "Home delivery"}.`, confirmLabel: "Place order" } });
    if (ok && pin && profile) onProfileUpdated?.({ ...profile, pin_lat: pin.lat, pin_lng: pin.lng });
  };

  const onPinChange = (p: { lat: number; lng: number }) => {
    cart.setPin(p);
    // Fill in an empty address from the pin so the customer doesn't have to type it.
    if (!cart.address.trim()) void reverseGeocode(p.lat, p.lng).then(a => { if (a) cart.setAddress(cur => cur.trim() ? cur : a); });
  };
  const removePin = async () => {
    if (!savedPin) { cart.setPin(null); return; }
    const ok = await action(() => clearMyDeliveryPin(), "Delivery pin removed.", { confirm: { title: "Remove your pin?", message: "Your saved delivery location will be removed. You can pin it again any time.", confirmLabel: "Remove pin", tone: "warning" } });
    if (ok) { cart.setPin(null); if (profile) onProfileUpdated?.({ ...profile, pin_lat: null, pin_lng: null }); }
  };

  return (
    <div className="cart-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) cart.setOpen(false); }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <header className="cart-drawer-head">
          <h2 id="cart-title"><ShoppingCart size={19} /> Your cart <span className="cart-count">{cart.count}</span></h2>
          <button className="icon-button" aria-label="Close cart" onClick={() => cart.setOpen(false)}><X size={18} /></button>
        </header>
        {valid.length ? (
          <>
            <div className="cart-drawer-body">
              {valid.map(({ item, qty }) => (
                <div className="cart-item" key={item.id}>
                  <span className="cart-item-icon">{item.image_url ? <img src={item.image_url} alt="" /> : <Droplets size={20} />}</span>
                  <div className="cart-item-main">
                    <strong>{item.name}</strong>
                    <small>{money(item.price)} each</small>
                    <div className="quantity-stepper" aria-label={`Quantity for ${item.name}`}>
                      <button onClick={() => cart.setQty(item.id, qty - 1, item.stock)} aria-label="Decrease quantity"><Minus size={13} /></button>
                      <b>{qty}</b>
                      <button onClick={() => cart.setQty(item.id, qty + 1, item.stock)} disabled={qty >= Number(item.stock)} aria-label="Increase quantity"><Plus size={13} /></button>
                    </div>
                  </div>
                  <div className="cart-item-side">
                    <b>{money(qty * Number(item.price))}</b>
                    <button className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => cart.remove(item.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              <div className="checkout-form">
                <label>How would you like to receive your order?
                  <select value={cart.fulfillment} onChange={e => cart.setFulfillment(e.target.value)}>
                    <option value="Pickup">Pick up at the station</option>
                    <option value="Delivery">Deliver to my address</option>
                  </select>
                </label>
                {cart.fulfillment === "Delivery" && (
                  <>
                    <label>Delivery address
                      <textarea rows={3} value={cart.address} onChange={e => cart.setAddress(e.target.value)} placeholder="House no., street, barangay, landmark" />
                    </label>
                    <div className="checkout-pin"><strong>Pin your delivery location</strong>
                      <DeliveryPin value={cart.pin} onChange={onPinChange} onRemove={removePin} canRemove={!hasActiveDelivery || !savedPin} station={station} /></div>
                  </>
                )}
                <div className="payment-note"><CircleDollarSign size={16} /><span><strong>{cart.fulfillment === "Pickup" ? "Pay in cash at the station" : "Pay cash on delivery"}</strong><small>You only pay once your order is confirmed and on its way.</small></span></div>
              </div>
            </div>
            <footer className="cart-drawer-foot">
              <div className="cart-total"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
              <button className="btn primary full" onClick={placeOrder}><CheckCircle2 size={17} /> Place order · {money(subtotal)}</button>
              <button className="text-button" onClick={() => { cart.setOpen(false); onNavigate("Order Water"); }}>Keep shopping</button>
            </footer>
          </>
        ) : (
          <div className="cart-empty cart-drawer-empty"><span><Droplets size={26} /></span><strong>Your cart is empty</strong><p>Add water and supplies to get started.</p>
            <button className="btn primary" onClick={() => { cart.setOpen(false); onNavigate("Order Water"); }}>Browse products</button></div>
        )}
      </aside>
      {problem && (
        <div className="confirm-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setProblem(null); }}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true">
            <div className="confirm-body"><span className="confirm-icon warning"><AlertTriangle size={22} /></span>
              <div className="confirm-copy"><h2>We can’t place this order yet</h2><div className="confirm-message"><ul className="unavailable-list">{problem.map(l => <li key={l}>{l}</li>)}</ul></div></div></div>
            <div className="confirm-actions"><button className="btn primary" autoFocus onClick={() => setProblem(null)}>OK</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Persistent nav icon with a live counter badge. */
export function CartButton() {
  const cart = useCart();
  return (
    <button className="icon-button cart-button" onClick={() => cart.setOpen(true)} aria-label={`Open cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`} title="Your cart">
      <ShoppingCart size={19} />
      {cart.count > 0 && <span className="cart-badge" aria-hidden="true">{cart.count > 99 ? "99+" : cart.count}</span>}
    </button>
  );
}
