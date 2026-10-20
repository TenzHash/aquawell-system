import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Check, UserRound, UserRoundPlus } from "lucide-react";
import { money } from "../../utils/formatters";

type Line = { id: string; quantity: number };

const customerLabel = (c: any) => c.full_name || c.name || c.email || "Unnamed customer";
const idOf = (row: any) => String(row.id ?? row.inventory_id ?? row.customer_id);

/**
 * Walk-in (counter) sale. Works for:
 *  - a registered customer (picked from the list, linked to their account), or
 *  - an unregistered customer (optional name only; stored as a walk-in).
 */
export function WalkInOrderModal({ inventory = [], customers = [], isOpen, onClose, onSubmit, busy }: any) {
  const [mode, setMode] = useState<"registered" | "guest">("registered");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [guestName, setGuestName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [formError, setFormError] = useState("");

  const sellable = useMemo(() => inventory.filter((i: any) => Number(i.stock) > 0), [inventory]);
  const matches = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return customers.filter((c: any) => !q || [c.full_name, c.name, c.email, c.phone, c.company_name].some((v: any) => String(v ?? "").toLowerCase().includes(q)));
  }, [customers, customerSearch]);

  // Reset every time the dialog opens. Nothing is pre-selected so a sale is never
  // silently attributed to the first customer in the list.
  useEffect(() => {
    if (!isOpen) return;
    setMode(customers.length ? "registered" : "guest");
    setCustomerId("");
    setCustomerSearch("");
    setGuestName("");
    setLines([]);
    setQty(1);
    setFormError("");
    setProductId(sellable[0] ? idOf(sellable[0]) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !productId && sellable[0]) setProductId(idOf(sellable[0]));
  }, [isOpen, productId, sellable]);

  if (!isOpen) return null;

  const product = (id: string) => inventory.find((p: any) => idOf(p) === String(id));
  const total = lines.reduce((sum, l) => sum + Number(product(l.id)?.price || 0) * l.quantity, 0);
  const selectedCustomer = customers.find((c: any) => idOf(c) === customerId);

  const addLine = () => {
    setFormError("");
    const item = product(productId);
    if (!item) return;
    const quantity = Math.max(1, Math.floor(Number(qty) || 1));
    const already = lines.find((l) => l.id === productId)?.quantity || 0;
    if (already + quantity > Number(item.stock)) {
      setFormError(`Only ${item.stock} of ${item.name} in stock${already ? ` (${already} already added)` : ""}.`);
      return;
    }
    setLines(already ? lines.map((l) => (l.id === productId ? { ...l, quantity: l.quantity + quantity } : l)) : [...lines, { id: productId, quantity }]);
    setQty(1);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (mode === "registered" && !customerId) return setFormError("Choose a registered customer, or switch to an unregistered walk-in.");
    if (!lines.length) return setFormError("Add at least one item.");
    onSubmit({
      customer_id: mode === "registered" ? customerId : null,
      walk_in_name: mode === "guest" ? guestName.trim() : "",
      items: lines.map((l) => ({ inventory_id: Number(l.id), quantity: l.quantity })),
      total_amount: total,
      customer_label: mode === "registered" ? customerLabel(selectedCustomer || {}) : guestName.trim() || "a walk-in customer",
    });
  };

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card walkin-modal" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
        <div className="panel-heading">
          <div>
            <h2 id="walkin-title">Record walk-in order</h2>
            <p>Log a counter sale for a registered or unregistered customer.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="walkin-form">
          <div className="segmented" role="tablist" aria-label="Customer type">
            <button type="button" role="tab" aria-selected={mode === "registered"} className={mode === "registered" ? "selected" : ""} onClick={() => { setMode("registered"); setFormError(""); }}>
              <UserRound size={15} /> Registered
            </button>
            <button type="button" role="tab" aria-selected={mode === "guest"} className={mode === "guest" ? "selected" : ""} onClick={() => { setMode("guest"); setFormError(""); }}>
              <UserRoundPlus size={15} /> Unregistered
            </button>
          </div>

          {mode === "registered" ? (
            <div className="walkin-customer">
              <label>
                Find customer
                <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search by name, email, phone or company…" />
              </label>
              <label>
                Registered customer ({matches.length})
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">{customers.length ? "Select a customer…" : "No registered customers found"}</option>
                  {matches.map((c: any) => (
                    <option key={idOf(c)} value={idOf(c)}>
                      {customerLabel(c)}{c.company_name ? ` — ${c.company_name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label>
              Customer name <span className="muted">(optional)</span>
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Juan Dela Cruz — leave blank for “Walk-in Customer”" maxLength={120} />
            </label>
          )}

          <div className="walkin-add">
            <label className="walkin-product">
              Product
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {!sellable.length && <option value="">No in-stock products</option>}
                {sellable.map((i: any) => (
                  <option key={idOf(i)} value={idOf(i)}>{i.name} · {money(i.price)} · {i.stock} in stock</option>
                ))}
              </select>
            </label>
            <label className="walkin-qty">
              Qty
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </label>
            <button type="button" className="btn secondary walkin-add-btn" onClick={addLine} disabled={!sellable.length}>
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="walkin-items">
            <strong>Order items ({lines.length})</strong>
            {!lines.length ? (
              <p className="muted">No items added yet.</p>
            ) : (
              lines.map((l) => {
                const item = product(l.id);
                return (
                  <div className="walkin-line" key={l.id}>
                    <span>{item?.name || "Item"} × <strong>{l.quantity}</strong></span>
                    <span className="walkin-line-total">
                      <strong>{money(Number(item?.price || 0) * l.quantity)}</strong>
                      <button type="button" className="text-button danger-text" onClick={() => setLines(lines.filter((x) => x.id !== l.id))}>Remove</button>
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="cart-total"><span>Total (cash)</span><strong>{money(total)}</strong></div>
          {formError && <p className="form-feedback error-text" role="alert">{formError}</p>}

          <div className="walkin-actions">
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy || !lines.length}><Check size={16} /> Review &amp; record sale</button>
          </div>
        </form>
      </div>
    </div>
  );
}
