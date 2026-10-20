import React, { useState } from "react";
import { Droplets, ImagePlus, Trash2 } from "lucide-react";
import { money } from "../../utils/formatters";
import { EmptyState } from "../../components/ui/EmptyState";
import { adjustInventory, deleteInventoryImage, saveInventoryImage } from "../../lib/data";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";

export function InventoryTable({ inventory, role, action }: any) {
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const filteredInventory = inventory.filter((item: any) => [item.name, item.category, item.id, item.stock].some((value: any) => String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(filteredInventory.length / rowsPerPage));
  const visibleInventory = filteredInventory.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  React.useEffect(() => setPage(1), [query, rowsPerPage]);
  const canAdjust = ["admin", "staff"].includes(role);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Inventory overview</h2>
          <p>
            Stock values and minimum-stock indicators from public.inventory.
            Adjustments are checked server-side.
          </p>
        </div>
        <span className="count-chip">{filteredInventory.length} items</span>
      </div>
      <TableToolbar query={query} onQueryChange={setQuery} placeholder="Search inventory…" label="Search inventory" rowsPerPage={rowsPerPage} onRowsPerPageChange={setRowsPerPage} resultCount={filteredInventory.length} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Item</th>
              <th>Category</th>
              <th>Unit price</th>
              <th>Available stock</th>
              <th>Stock level</th>
              <th>Minimum</th>
              {canAdjust && <th>Adjust stock</th>}
            </tr>
          </thead>
          <tbody>
            {visibleInventory.map((item: any) => (
              <tr key={item.id}>
                <td data-label="Image">
                  <div className="inventory-image-cell">
                    {item.image_url ? <img src={item.image_url} alt={item.name} className="inventory-product-image" /> : <span className="inventory-image-placeholder"><Droplets size={20} /></span>}
                    {canAdjust && <label className="btn small secondary image-upload-button"><ImagePlus size={13} /> {item.image_url ? "Change" : "Add image"}<input type="file" accept="image/*" aria-label={`Upload image for ${item.name}`} onChange={(e) => { const file = e.target.files?.[0]; if (file) action(async () => { const image_url = await saveInventoryImage(item.id, file); item.image_url = image_url; }, "Product image saved.", { confirm: { title: "Upload this image?", message: `Use “${file.name}” as the picture for ${item.name}? It will be visible to customers.`, confirmLabel: "Upload image" } }); e.currentTarget.value = ""; }} /></label>}
                    {canAdjust && item.image_url && <button className="icon-button image-delete-button" aria-label={`Delete image for ${item.name}`} title="Delete image" onClick={() => action(async () => { await deleteInventoryImage(item.id, item.image_url); item.image_url = null; }, "Product image deleted.", { confirm: { title: "Delete this image?", message: `Remove the picture of ${item.name}? Customers will see the default icon instead.`, confirmLabel: "Delete image", tone: "danger" } })}><Trash2 size={14} /></button>}
                  </div>
                </td>
                <td data-label="Item">
                  <div className="item-cell">
                    <span className="item-icon">
                      <Droplets size={17} />
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>ID {item.id}</small>
                    </span>
                  </div>
                </td>
                <td data-label="Category">{item.category}</td>
                <td data-label="Unit price" className="money">{money(item.price)}</td>
                <td data-label="Available stock">{item.stock}</td>
                <td data-label="Stock level">
                  <span
                    className={`status ${Number(item.stock) <= Number(item.min_stock) ? "warning" : "success"}`}
                  >
                    {Number(item.stock) <= Number(item.min_stock)
                      ? "Low stock"
                      : "In stock"}
                  </span>
                </td>
                <td data-label="Minimum">{item.min_stock}</td>
                {canAdjust && (
                  <td data-label="Adjust stock">
                    <div className="stock-adjust">
                      <input
                        aria-label={`Stock adjustment for ${item.name}`}
                        type="number"
                        step="1"
                        value={deltas[item.id] ?? ""}
                        placeholder="± qty"
                        onChange={(e) =>
                          setDeltas((v) => ({
                            ...v,
                            [item.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="btn small secondary"
                        disabled={
                          !deltas[item.id] || Number(deltas[item.id]) === 0
                        }
                        onClick={() =>
                          action(async () => {
                            await adjustInventory(
                              item.id,
                              Number(deltas[item.id]),
                            );
                            setDeltas((v) => ({ ...v, [item.id]: "" }));
                          }, "Inventory stock adjusted.", { confirm: { title: "Adjust stock?", message: `Change the stock of ${item.name} by ${Number(deltas[item.id]) > 0 ? "+" : ""}${deltas[item.id]} (currently ${item.stock}).`, confirmLabel: "Apply adjustment", tone: "warning" } })
                        }
                      >
                        Apply
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredInventory.length && (
          <EmptyState
            title="No inventory records"
            text="No inventory items are currently visible to this account."
          />
        )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} start={filteredInventory.length ? (page - 1) * rowsPerPage + 1 : 0} end={Math.min(page * rowsPerPage, filteredInventory.length)} total={filteredInventory.length} />
    </section>
  );
}
