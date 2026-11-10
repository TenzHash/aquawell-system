import React, { useMemo, useState } from "react";
import { AlertTriangle, Droplets, Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { money } from "../../utils/formatters";
import { EmptyState } from "../../components/ui/EmptyState";
import { useCart } from "../cart/CartContext";
import { usePersistentState } from "../../utils/persist";

export function OrderCatalog({ inventory, profile }: any) {
  const cart = useCart();
  const [search, setSearch] = usePersistentState<string>(`aquawell-shop-search-${profile.id}`, "");
  const [category, setCategory] = usePersistentState<string>(`aquawell-shop-category-${profile.id}`, "All");
  const [notice, setNotice] = useState<string | null>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set<string>(inventory.map((i: any) => String(i.category || "").trim()).filter(Boolean))).sort()], [inventory]);
  const inStockCount = inventory.filter((i: any) => Number(i.stock) > 0).length;
  const items = inventory
    .filter((i: any) => (category === "All" || i.category === category) && [i.name, i.category].some((v: any) => String(v ?? "").toLowerCase().includes(search.toLowerCase())))
    .sort((a: any, b: any) => Number(Number(b.stock) > 0) - Number(Number(a.stock) > 0));
  const subtotal = Object.entries(cart.lines).reduce((n, [id, q]) => n + Number(inventory.find((i: any) => String(i.id) === id)?.price || 0) * q, 0);

  const add = (item: any) => {
    if (Number(item.stock) <= 0) { setNotice(`${item.name} is out of stock right now.`); return; }
    if ((cart.lines[String(item.id)] || 0) >= Number(item.stock)) { setNotice(`Only ${item.stock} of ${item.name} available.`); return; }
    cart.add(item.id, Number(item.stock));
  };

  return (
    <div className="catalog-layout catalog-single">
      <section className="catalog-list">
        <div className="panel-heading catalog-heading">
          <div><h2>Choose your water and supplies</h2><p>Add what you need to your cart. You can check out any time from the cart icon at the top.</p></div>
          <span className="count-chip">{inStockCount} available</span>
        </div>
        <label className="search-box catalog-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search water and supplies…" aria-label="Search products" /></label>
        <div className="category-filter" role="group" aria-label="Filter products by category">
          {categories.map(c => (
            <button key={c} type="button" className={`category-chip ${category === c ? "selected" : ""}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}<span>{c === "All" ? inventory.length : inventory.filter((i: any) => i.category === c).length}</span>
            </button>
          ))}
        </div>
        <div className="product-grid">
          {items.map((item: any) => {
            const qty = cart.lines[String(item.id)] || 0; const out = Number(item.stock) <= 0;
            return (
              <article className={`product-card ${out ? "is-unavailable" : ""}`} key={item.id}>
                <div className={`product-art ${item.image_url ? "has-product-image" : ""}`}>
                  {item.image_url ? <img src={item.image_url} alt={item.name} className="catalog-product-image" /> : <span className="product-watermark"><Droplets size={48} /></span>}
                  <span className="product-category">{item.category}</span>
                  {out && <span className="product-soldout">Out of stock</span>}
                </div>
                <div className="product-copy">
                  <h3>{item.name}</h3>
                  <p>{out ? "Currently unavailable" : Number(item.stock) <= Number(item.min_stock) ? `Only ${item.stock} left` : "In stock"}</p>
                  <div className="product-buy">
                    <strong>{money(item.price)}</strong>
                    {qty > 0 && !out ? (
                      <div className="quantity-stepper">
                        <button onClick={() => cart.setQty(item.id, qty - 1, item.stock)} aria-label={`Decrease ${item.name}`}><Minus size={13} /></button>
                        <b>{qty}</b>
                        <button onClick={() => add(item)} disabled={qty >= Number(item.stock)} aria-label={`Increase ${item.name}`}><Plus size={13} /></button>
                      </div>
                    ) : (
                      <button className={`btn small ${out ? "secondary" : "primary"}`} onClick={() => add(item)}><Plus size={14} /> Add to cart</button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!items.length && <EmptyState title={search || category !== "All" ? "No matching products" : "Nothing available right now"} text={search || category !== "All" ? "Try another category or search term." : "Please check back later or contact the station."} />}
      </section>

      {cart.count > 0 && (
        <button className="cart-sticky" onClick={() => cart.setOpen(true)}>
          <span><ShoppingCart size={18} /> {cart.count} item{cart.count === 1 ? "" : "s"} in your cart</span>
          <strong>View cart · {money(subtotal)}</strong>
        </button>
      )}

      {notice && (
        <div className="confirm-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setNotice(null); }}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true">
            <div className="confirm-body"><span className="confirm-icon warning"><AlertTriangle size={22} /></span>
              <div className="confirm-copy"><h2>Product not available</h2><div className="confirm-message"><p>{notice}</p></div></div>
              <button type="button" className="icon-button confirm-close" aria-label="Close" onClick={() => setNotice(null)}><X size={18} /></button></div>
            <div className="confirm-actions"><button className="btn primary" autoFocus onClick={() => setNotice(null)}>OK</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
