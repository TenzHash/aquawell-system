import React, { useState } from "react";
import { Search } from "lucide-react";
import { money } from "../../utils/formatters";
import { EmptyState } from "../../components/ui/EmptyState";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";

export function SalesTable({ sales }: any) {
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const filteredSales = sales.filter((sale: any) => [sale.customer_name, sale.item_name, sale.payment_method, sale.date].some((value: any) => String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  const pageCount = Math.max(1, Math.ceil(filteredSales.length / rowsPerPage));
  const visibleSales = filteredSales.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  React.useEffect(() => setPage(1), [query, rowsPerPage]);
  return (
    <>
    <TableToolbar query={query} onQueryChange={setQuery} placeholder="Search sales, customer, item, or transaction…" label="Search sales" rowsPerPage={rowsPerPage} onRowsPerPageChange={setRowsPerPage} resultCount={filteredSales.length} />
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Item summary</th>
            <th>Qty</th>
            <th>Total</th>
            <th>Method</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {visibleSales.map((s: any) => (
            <tr key={s.transaction_id}>
              <td data-label="Customer">{s.customer_name || "—"}</td>
              <td data-label="Item summary">{s.item_name || "—"}</td>
              <td data-label="Qty">{s.quantity}</td>
              <td data-label="Total" className="money">{money(s.total_amount)}</td>
              <td data-label="Method">{s.payment_method || "—"}</td>
              <td data-label="Date">{s.date || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filteredSales.length && (
        <EmptyState
          title="No recorded sales yet"
          text="A sale should be recorded once when payment is successfully verified, not on checkout or every status change."
        />
      )}
    </div>
    <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} start={filteredSales.length ? (page - 1) * rowsPerPage + 1 : 0} end={Math.min(page * rowsPerPage, filteredSales.length)} total={filteredSales.length} />
    </>
  );
}
