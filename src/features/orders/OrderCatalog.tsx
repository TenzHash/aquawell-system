import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Droplets,
  Plus,
  Search,
  X,
} from "lucide-react";
import { money } from "../../utils/formatters";
import { EmptyState } from "../../components/ui/EmptyState";
import { createCustomerOrder } from "../../lib/data";

export function OrderCatalog({ inventory, profile, action, onNavigate }: any) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState("Pickup");
  const [address, setAddress] = useState(profile.address || "");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  // Shown when a customer tries to order something that is out of stock / no longer available.
  const [unavailable, setUnavailable] = useState<{ lines: string[]; removeIds: string[] } | null>(null);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set<string>(inventory.map((i: any) => String(i.category || "").trim()).filter(Boolean))).sort()],
    [inventory],
  );
  const inStockCount = inventory.filter((i: any) => Number(i.stock) > 0).length;
  // Out-of-stock products stay visible (greyed out) so a customer who tries to order one gets a clear explanation.
  const items = inventory
    .filter((i: any) => (category === "All" || i.category === category) && [i.name, i.category, i.id].some((value: any) => String(value ?? "").toLowerCase().includes(search.toLowerCase())))
    .sort((a: any, b: any) => Number(Number(b.stock) > 0) - Number(Number(a.stock) > 0));
  const cartRows = Object.entries(cart)
    .map(([id, qty]) => ({
      item: inventory.find((i: any) => String(i.id) === id),
      qty,
    }))
    .filter((x) => x.item && x.qty > 0);
  const total = cartRows.reduce((n, x) => n + Number(x.item.price) * x.qty, 0);

  function change(id: string | number, delta: number) {
    const target = inventory.find((i: any) => String(i.id) === String(id));
    if (delta > 0 && target && Number(target.stock) <= 0) {
      setUnavailable({ lines: [`${target.name} is currently out of stock.`], removeIds: [] });
      return;
    }
    setCart((prev) => {
      const next = { ...prev };
      const item = inventory.find((i: any) => String(i.id) === String(id));
      const qty = Math.max(
        0,
        Math.min(Number(item?.stock || 0), Number(prev[id] || 0) + delta),
      );
      if (qty === 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  return (
    <div className="catalog-layout">
      <section className="catalog-list">
        <div className="panel-heading catalog-heading">
          <div>
            <h2>Choose your water and supplies</h2>
            <p>
              Only in-stock items are shown. Stock is reserved and deducted
              after staff confirmation.
            </p>
          </div>
          <span className="count-chip">{inStockCount} available</span>
        </div>
        <label className="search-box catalog-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search water and supplies…" aria-label="Search products" /></label>
        <div className="category-filter" role="group" aria-label="Filter products by category">
          {categories.map((c) => (
            <button key={c} type="button" className={`category-chip ${category === c ? "selected" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
              <span>{c === "All" ? inventory.length : inventory.filter((i: any) => i.category === c).length}</span>
            </button>
          ))}
        </div>
        <div className="product-grid">
          {items.map((item: any) => (
            <article className={`product-card ${Number(item.stock) <= 0 ? "is-unavailable" : ""}`} key={item.id}>
              <div className={`product-art ${item.image_url ? "has-product-image" : ""}`}>
                {item.image_url ? <img src={item.image_url} alt={item.name} className="catalog-product-image" /> : <span className="product-watermark"><Droplets size={48} /></span>}
                <span className="product-category">{item.category}</span>
                {Number(item.stock) <= 0 && <span className="product-soldout">Out of stock</span>}
              </div>
              <div className="product-copy">
                <h3>{item.name}</h3>
                <p>
                  {Number(item.stock) > 0 ? `${item.stock} available` : "Currently unavailable"} · {item.category}
                </p>
                <div className="product-buy">
                  <strong>{money(item.price)}</strong>
                  {Number(item.stock) <= 0 ? (
                    <button className="btn small secondary" onClick={() => change(item.id, 1)}>
                      <Plus size={14} /> Add
                    </button>
                  ) : cart[item.id] ? (
                    <div className="quantity-stepper">
                      <button
                        onClick={() => change(item.id, -1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <b>{cart[item.id]}</b>
                      <button
                        onClick={() => change(item.id, 1)}
                        aria-label="Increase quantity"
                        disabled={(cart[item.id] || 0) >= item.stock}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn small primary"
                      onClick={() => change(item.id, 1)}
                    >
                      <Plus size={14} /> Add
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {!items.length && (
          <EmptyState
            title={search || category !== "All" ? "No matching products" : "No items currently available"}
            text={search || category !== "All" ? "Try another category or search term." : "Please check back later or contact the station."}
          />
        )}
      </section>
      <aside className="panel checkout-panel">
        <div className="panel-heading">
          <div>
            <h2>Your order</h2>
            <p>Payment method follows your fulfillment option and account terms.</p>
          </div>
          <span className="cart-count">
            {cartRows.reduce((n, x) => n + x.qty, 0)}
          </span>
        </div>
        {cartRows.length ? (
          <>
            <div className="cart-lines">
              {cartRows.map(({ item, qty }) => (
                <div className="cart-line" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {qty} × {money(item.price)}
                    </small>
                  </div>
                  <b>{money(qty * Number(item.price))}</b>
                  <button
                    className="icon-button"
                    onClick={() => change(item.id, -qty)}
                    aria-label="Remove item"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="checkout-form">
              <label>
                Fulfillment option
                <select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                >
                  <option value="Pickup">Pickup at station</option>
                  <option value="Delivery">Delivery</option>
                </select>
              </label>
              {fulfillment === "Delivery" && (
                <label>
                  Delivery address
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House / street / barangay / landmark"
                    required
                  />
                </label>
              )}
              <div className="payment-note">
                <CircleDollarSign size={16} />
                <span>
                  <strong>{fulfillment === "Pickup" ? "Cash at pickup" : "Cash on delivery"}</strong>
                  <small>Affiliated company accounts may be billed monthly. Payment stays pending until staff verifies collection or applies the approved company billing terms.</small>
                </span>
              </div>
              <div className="cart-total">
                <span>Order total</span>
                <strong>{money(total)}</strong>
              </div>
              <button
                className="btn primary full"
                disabled={!cartRows.length}
                onClick={() => {
                  // Re-check against the latest stock we have before bothering the server.
                  const short = cartRows.filter((x) => Number(x.item.stock) < x.qty);
                  if (short.length) {
                    setUnavailable({
                      lines: short.map((x) => Number(x.item.stock) <= 0 ? `${x.item.name} is out of stock.` : `${x.item.name}: only ${x.item.stock} left (you asked for ${x.qty}).`),
                      removeIds: short.map((x) => String(x.item.id)),
                    });
                    return;
                  }
                  void action(async () => {
                    if (fulfillment === "Delivery" && !address.trim())
                      throw new Error("Enter a delivery address before placing a delivery order.");
                    try {
                      await createCustomerOrder({
                        fulfillment,
                        address: fulfillment === "Delivery" ? address.trim() : undefined,
                        items: cartRows.map((x) => ({ inventory_id: x.item.id, quantity: x.qty })),
                      });
                    } catch (e: any) {
                      const message = String(e?.message || "");
                      if (/insufficient stock|unavailable|out of stock/i.test(message)) {
                        // Stock changed since the page loaded: explain in a dialog instead of a raw database error.
                        const name = message.match(/insufficient stock for (.+)$/i)?.[1];
                        setUnavailable({ lines: [name ? `${name} no longer has enough stock.` : "One of the items in your order is no longer available."], removeIds: [] });
                        const handled: any = new Error(message);
                        handled.silent = true;
                        throw handled;
                      }
                      throw e;
                    }
                    setCart({});
                    onNavigate("My Orders");
                  }, "Order submitted. Awaiting staff confirmation.", {
                    confirm: {
                      title: "Place this order?",
                      message: `${cartRows.reduce((n, x) => n + x.qty, 0)} item(s) · ${money(total)} · ${fulfillment === "Pickup" ? "Pickup at station" : "Delivery"}. Staff will confirm your order before it is prepared.`,
                      confirmLabel: "Place order",
                    },
                  });
                }}
              >
                <CheckCircle2 size={17} /> Place order
              </button>
              <p className="checkout-footnote">
                Your order starts as Pending. Staff confirmation validates stock
                and deducts inventory atomically.
              </p>
            </div>
          </>
        ) : (
          <div className="cart-empty">
            <span>
              <Droplets size={26} />
            </span>
            <strong>Your cart is clear</strong>
            <p>Add available items to prepare your order.</p>
          </div>
        )}
      </aside>

      {unavailable && (
        <div className="confirm-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setUnavailable(null); }}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unavailable-title">
            <div className="confirm-body">
              <span className="confirm-icon warning"><AlertTriangle size={22} /></span>
              <div className="confirm-copy">
                <h2 id="unavailable-title">Product not available</h2>
                <div className="confirm-message">
                  <p>Sorry, we can’t add this to your order right now:</p>
                  <ul className="unavailable-list">{unavailable.lines.map((line) => <li key={line}>{line}</li>)}</ul>
                  <p>Please choose another product or reduce the quantity.</p>
                </div>
              </div>
              <button type="button" className="icon-button confirm-close" aria-label="Close" onClick={() => setUnavailable(null)}><X size={18} /></button>
            </div>
            <div className="confirm-actions">
              {unavailable.removeIds.length > 0 && (
                <button type="button" className="btn secondary" onClick={() => {
                  setCart((prev) => { const next = { ...prev }; unavailable.removeIds.forEach((id) => delete next[id]); return next; });
                  setUnavailable(null);
                }}>Remove from order</button>
              )}
              <button type="button" className="btn primary" autoFocus onClick={() => setUnavailable(null)}>OK, got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
