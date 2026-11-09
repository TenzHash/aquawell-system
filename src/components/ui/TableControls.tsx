import React from "react";
import { Search } from "lucide-react";

type TableToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  label: string;
  rowsPerPage: number;
  onRowsPerPageChange: (value: number) => void;
  resultCount: number;
  sortOrder?: "newest" | "oldest";
  onSortOrderChange?: (value: "newest" | "oldest") => void;
};

export function TableToolbar({ query, onQueryChange, placeholder, label, rowsPerPage, onRowsPerPageChange, resultCount, sortOrder, onSortOrderChange }: TableToolbarProps) {
  return <div className="shared-table-toolbar">
    <label className="search-box shared-table-search"><Search size={16} /><input value={query} onChange={e => onQueryChange(e.target.value)} placeholder={placeholder} aria-label={label} /></label>
    {sortOrder && onSortOrderChange && <label className="rows-per-page-control rows-per-page-control--inline"><span>Sort</span><select value={sortOrder} onChange={e => onSortOrderChange(e.target.value as "newest" | "oldest")} aria-label="Sort newest or oldest"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>}
    <label className="rows-per-page-control rows-per-page-control--inline"><span>Rows</span><select value={rowsPerPage} onChange={e => onRowsPerPageChange(Number(e.target.value))} aria-label="Rows per page"><option value={5}>5</option><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
    <span className="shared-table-count">{resultCount} results</span>
  </div>;
}

export function TablePagination({ page, pageCount, onPageChange, start, end, total }: { page: number; pageCount: number; onPageChange: (page: number) => void; start: number; end: number; total: number }) {
  return <nav className="orders-pagination shared-table-pagination" aria-label="Table pagination"><span className="orders-pagination-summary">Showing {total === 0 ? 0 : start}–{end} of {total} results · Page {page} of {pageCount}</span><div className="orders-pagination-buttons"><button type="button" className="btn secondary small" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>Previous</button><button type="button" className="btn secondary small" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>Next</button></div></nav>;
}
