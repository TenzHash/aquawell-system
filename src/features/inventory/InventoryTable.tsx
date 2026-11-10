import React, { useMemo, useState } from "react";
import { AlertTriangle, Droplets, History, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { dateFmt, money } from "../../utils/formatters";
import { EmptyState } from "../../components/ui/EmptyState";
import { INVENTORY_CATEGORIES, adjustInventory, createInventoryItem, deleteInventoryImage, deleteInventoryItem, saveInventoryImage, updateInventoryItem, type InventoryInput } from "../../lib/data";
import { can, type PermissionMap } from "../../lib/permissions";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";
import { Metric } from "../../components/ui/Metric";
import { Package, TriangleAlert, PackageX } from "lucide-react";

const blank: InventoryInput = { name: "", category: "Refill", price: 0, stock: 0, min_stock: 10 };

export function InventoryTable({ inventory, role, action, permissions, movements = [] }: { inventory: any[]; role: string; action: any; permissions?: PermissionMap; movements?: any[] }) {
  const canAdjust = can(role, permissions, "adjust_inventory");
  const canManage = can(role, permissions, "manage_inventory");
  const [tab, setTab] = useState<"items" | "log">("items");
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(""); const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest"); const [rowsPerPage, setRowsPerPage] = useState(10); const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ id: number | null; values: InventoryInput } | null>(null);
  const [formError, setFormError] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  React.useEffect(() => { if (!preview) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [preview]);

  const low = useMemo(() => inventory.filter(i => Number(i.stock) <= Number(i.min_stock)), [inventory]);
  const out = inventory.filter(i => Number(i.stock) === 0).length;
  const filtered = inventory.filter(i => [i.name, i.category, i.id, i.stock].some(v => String(v ?? "").toLowerCase().includes(query.toLowerCase())));
  const sorted = [...filtered].sort((a: any, b: any) => { const aTime = Date.parse(a.created_at || a.updated_at || "") || 0; const bTime = Date.parse(b.created_at || b.updated_at || "") || 0; const diff = aTime - bTime || Number(a.id || 0) - Number(b.id || 0); return sortOrder === "newest" ? -diff : diff; });
  const pageCount = Math.max(1, Math.ceil(sorted.length / rowsPerPage));
  const visible = sorted.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  React.useEffect(() => setPage(1), [query, rowsPerPage]);
  const logPages = Math.max(1, Math.ceil(movements.length / 10)); const logRows = movements.slice((logPage - 1) * 10, logPage * 10);

  const openAdd = () => { setFormError(""); setForm({ id: null, values: { ...blank } }); };
  const openEdit = (i: any) => { setFormError(""); setForm({ id: i.id, values: { name: i.name, category: i.category, price: Number(i.price), stock: Number(i.stock), min_stock: Number(i.min_stock) } }); };
  const set = (k: keyof InventoryInput, v: string) => setForm(f => f && ({ ...f, values: { ...f.values, [k]: k === "name" || k === "category" ? v : v === "" ? ("" as any) : Number(v) } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return; setFormError("");
    const v = form.values;
    if (!v.name.trim()) return setFormError("Please enter an item name.");
    if (!(Number(v.price) >= 0)) return setFormError("Price must be zero or more.");
    if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) return setFormError("Stock must be a whole number, zero or more.");
    if (!Number.isInteger(Number(v.min_stock)) || Number(v.min_stock) < 0) return setFormError("Low-stock level must be a whole number, zero or more.");
    const ok = await action(() => form.id == null ? createInventoryItem(v) : updateInventoryItem(form.id, v), form.id == null ? "Item added to inventory." : "Item saved.", { confirm: false });
    if (ok) setForm(null);
  };

  return (
    <div className="stack-lg">
      <div className="metric-grid">
        <Metric icon={Package} label="Items" value={inventory.length} note="In your inventory" tone="blue" />
        <Metric icon={TriangleAlert} label="Low stock" value={low.length} note="At or below the alert level" tone="amber" />
        <Metric icon={PackageX} label="Out of stock" value={out} note="Hidden from ordering" tone="violet" />
      </div>
      {low.length > 0 && (
        <div className="alert warning low-stock-banner" role="status">
          <AlertTriangle size={18} /><div><strong>{low.length} item{low.length === 1 ? " needs" : "s need"} restocking</strong>
            <p>{low.slice(0, 5).map(i => `${i.name} (${i.stock} left)`).join(" · ")}{low.length > 5 ? ` · and ${low.length - 5} more` : ""}</p></div>
        </div>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Inventory</h2><p>Round and slim gallons, caps, seals and supplies. Stock updates automatically with every confirmed order.</p></div>
          <div className="heading-actions">
            <div className="forecast-tabs compact-tabs"><button className={tab === "items" ? "selected" : ""} onClick={() => setTab("items")}>Items</button><button className={tab === "log" ? "selected" : ""} onClick={() => setTab("log")}><History size={13} /> Stock history</button></div>
            {canManage && tab === "items" && <button className="btn primary" onClick={openAdd}><Plus size={16} /> Add item</button>}
          </div>
        </div>

        {tab === "items" ? (
          <>
            <TableToolbar query={query} onQueryChange={setQuery} placeholder="Search inventory…" label="Search inventory" rowsPerPage={rowsPerPage} onRowsPerPageChange={setRowsPerPage} resultCount={filtered.length} sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
            <div className="table-wrap">
              <table>
                <thead><tr><th>Image</th><th>Item</th><th>Category</th><th>Unit price</th><th>In stock</th><th>Status</th><th>Alert level</th>{canAdjust && <th>Adjust stock</th>}{canManage && <th>Manage</th>}</tr></thead>
                <tbody>
                  {visible.map(item => {
                    const lowItem = Number(item.stock) <= Number(item.min_stock); const empty = Number(item.stock) === 0;
                    return (
                      <tr key={item.id}>
                        <td data-label="Image"><div className="inventory-image-cell">
                          {item.image_url && !brokenImages[`${item.id}|${item.image_url}`]
                            ? <button type="button" className="inventory-image-button" title="View photo" aria-label={`View photo of ${item.name}`} onClick={() => setPreview({ url: item.image_url, name: item.name })}><img src={item.image_url} alt={item.name} className="inventory-product-image" loading="lazy" decoding="async" onError={() => setBrokenImages(b => ({ ...b, [`${item.id}|${item.image_url}`]: true }))} /></button>
                            : <span className="inventory-image-placeholder" title={item.image_url ? "This photo could not be loaded" : "No photo yet"}><Droplets size={20} /></span>}
                          {canManage && <div className="inventory-image-actions">
                            <label className="btn small secondary image-upload-button"><ImagePlus size={13} /> {item.image_url ? "Change" : "Add photo"}<input type="file" accept="image/*" aria-label={`Upload photo for ${item.name}`} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void action(() => saveInventoryImage(item.id, file), "Product photo saved.", { confirm: false }); }} /></label>
                            {item.image_url && <button type="button" className="icon-button image-delete-button" aria-label={`Remove photo for ${item.name}`} title="Remove photo" onClick={() => action(() => deleteInventoryImage(item.id, item.image_url), "Product photo removed.")}><Trash2 size={14} /></button>}
                          </div>}
                        </div></td>
                        <td data-label="Item"><div className="item-cell"><span className="item-icon"><Droplets size={17} /></span><span><strong>{item.name}</strong></span></div></td>
                        <td data-label="Category">{item.category}</td>
                        <td data-label="Unit price" className="money">{money(item.price)}</td>
                        <td data-label="In stock"><strong>{item.stock}</strong></td>
                        <td data-label="Status"><span className={`status ${empty ? "danger" : lowItem ? "warning" : "success"}`}>{empty ? "Out of stock" : lowItem ? "Low stock" : "In stock"}</span></td>
                        <td data-label="Alert level">{item.min_stock}</td>
                        {canAdjust && <td data-label="Adjust stock"><div className="stock-adjust">
                          <input aria-label={`Stock change for ${item.name}`} type="number" step="1" value={deltas[item.id] ?? ""} placeholder="± qty" onChange={e => setDeltas(v => ({ ...v, [item.id]: e.target.value }))} />
                          <button className="btn small secondary" disabled={!deltas[item.id] || Number(deltas[item.id]) === 0} onClick={() => action(async () => { await adjustInventory(item.id, Number(deltas[item.id])); setDeltas(v => ({ ...v, [item.id]: "" })); }, "Stock updated.", { confirm: { title: "Update stock?", message: `Change ${item.name} by ${Number(deltas[item.id]) > 0 ? "+" : ""}${deltas[item.id]} (now ${item.stock}).`, confirmLabel: "Update" } })}>Apply</button>
                        </div></td>}
                        {canManage && <td data-label="Manage"><div className="row-actions">
                          <button className="icon-button" aria-label={`Edit ${item.name}`} title="Edit" onClick={() => openEdit(item)}><Pencil size={15} /></button>
                          <button className="icon-button danger" aria-label={`Delete ${item.name}`} title="Delete" onClick={() => action(() => deleteInventoryItem(item.id), `${item.name} deleted.`, { confirm: { title: "Delete this item?", message: `${item.name} will be removed from your inventory. Items that already appear on past orders can’t be deleted.`, confirmLabel: "Delete item", tone: "danger" } })}><Trash2 size={15} /></button>
                        </div></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filtered.length && <EmptyState title="No items found" text={inventory.length ? "No items match your search." : "Add your first item to start tracking stock."} />}
            </div>
            <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} start={filtered.length ? (page - 1) * rowsPerPage + 1 : 0} end={Math.min(page * rowsPerPage, filtered.length)} total={filtered.length} />
          </>
        ) : (
          <>
            <div className="table-wrap"><table>
              <thead><tr><th>When</th><th>Item</th><th>Change</th><th>Before → After</th><th>Reason</th><th>By</th></tr></thead>
              <tbody>{logRows.map((m: any) => <tr key={m.id}><td data-label="When">{dateFmt(m.created_at)}</td><td data-label="Item"><strong>{m.item_name}</strong></td>
                <td data-label="Change"><span className={`status ${Number(m.delta) < 0 ? "warning" : "success"}`}>{Number(m.delta) > 0 ? "+" : ""}{m.delta}</span></td>
                <td data-label="Before → After">{m.stock_before} → {m.stock_after}</td><td data-label="Reason">{m.reason}</td><td data-label="By">{m.actor_name || "System"}</td></tr>)}</tbody>
            </table>{!movements.length && <EmptyState title="No stock movements yet" text="Every stock change — sales, deliveries, restocks — is recorded here automatically." />}</div>
            <TablePagination page={logPage} pageCount={logPages} onPageChange={setLogPage} start={movements.length ? (logPage - 1) * 10 + 1 : 0} end={Math.min(logPage * 10, movements.length)} total={movements.length} />
          </>
        )}
      </section>

      {preview && (
        <div className="modal-scrim image-lightbox" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setPreview(null); }}>
          <figure role="dialog" aria-modal="true" aria-label={`Photo of ${preview.name}`}>
            <button type="button" className="icon-button image-lightbox-close" aria-label="Close photo" onClick={() => setPreview(null)}><X size={18} /></button>
            <img src={preview.url} alt={preview.name} />
            <figcaption>{preview.name}</figcaption>
          </figure>
        </div>
      )}

      {form && (
        <div className="modal-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setForm(null); }}>
          <form className="modal-card" role="dialog" aria-modal="true" aria-labelledby="item-form-title" onSubmit={submit}>
            <div className="panel-heading"><div><h2 id="item-form-title">{form.id == null ? "Add inventory item" : "Edit item"}</h2><p>{form.id == null ? "Set the price, opening stock and when to be alerted." : "Changing the stock here is recorded in the stock history."}</p></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setForm(null)}><X size={18} /></button></div>
            <div className="form-stack modal-body">
              {formError && <div className="alert error" role="alert">{formError}</div>}
              <label>Item name<input autoFocus value={form.values.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Round Gallon Refill (5 gal)" required /></label>
              <label>Category<select value={form.values.category} onChange={e => set("category", e.target.value)}>{INVENTORY_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
              <div className="form-row">
                <label>Price (₱)<input type="number" min="0" step="0.01" value={form.values.price as any} onChange={e => set("price", e.target.value)} required /></label>
                <label>{form.id == null ? "Opening stock" : "Stock on hand"}<input type="number" min="0" step="1" value={form.values.stock as any} onChange={e => set("stock", e.target.value)} required /></label>
                <label>Low-stock alert at<input type="number" min="0" step="1" value={form.values.min_stock as any} onChange={e => set("min_stock", e.target.value)} required /></label>
              </div>
            </div>
            <div className="confirm-actions"><button type="button" className="btn secondary" onClick={() => setForm(null)}>Cancel</button><button className="btn primary">{form.id == null ? "Add item" : "Save changes"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
