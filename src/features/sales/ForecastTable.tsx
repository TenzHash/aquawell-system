import React, { useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { DemandChart } from "../analytics/SalesCharts";
import { TablePagination, TableToolbar } from "../../components/ui/TableControls";

/** WMA results are shown as whole units (you cannot sell or buy part of a gallon). */
const whole = (n: any) => Math.round(Number(n) || 0);

export function ForecastTable({ forecasts, error }: any) {
  const availablePeriods = ["daily", "weekly", "monthly"] as string[];
  const [period, setPeriod] = useState("daily");
  const [query, setQuery] = useState("");
  const activePeriod = availablePeriods.includes(period) ? period : (availablePeriods[0] || "daily");
  const rows = (forecasts[activePeriod] || []).filter((row: any) => [row.item_name, row.inventory_id, row.period].some((value: any) => String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  const unitLabel = (prefix: string) => `${prefix} ${activePeriod === "daily" ? "day" : activePeriod === "weekly" ? "week" : "month"}`;
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const visibleRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  React.useEffect(() => setPage(1), [query, period, rowsPerPage]);

  return (
    <>
      {error && <div className="alert error" role="alert" style={{ margin: "0 20px 14px" }}>{error}</div>}
      <div className="forecast-tabs">
        {availablePeriods.map((key) => (
          <button key={key} className={activePeriod === key ? "selected" : ""} onClick={() => setPeriod(key)}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
        <span className="forecast-period-note">{activePeriod.charAt(0).toUpperCase() + activePeriod.slice(1)} demand forecast</span>
      </div>
      <DemandChart rows={forecasts[activePeriod] || []} period={activePeriod} />
      <TableToolbar query={query} onQueryChange={setQuery} placeholder="Search forecast items…" label="Search forecast items" rowsPerPage={rowsPerPage} onRowsPerPageChange={setRowsPerPage} resultCount={rows.length} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Inventory item</th>
              <th>{unitLabel("Newest completed")}</th>
              <th>{unitLabel("Previous")}</th>
              <th>{unitLabel("Oldest")}</th>
              <th>Demand trend</th>
              <th>WMA forecast</th>
              <th>Suggested purchase qty.</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r: any) => (
              <tr key={r.inventory_id}>
                <td data-label="Inventory item">
                  <strong>{r.item_name}</strong>
                  
                </td>
                <td data-label="Newest completed">{Number(r.newest_period_demand || 0)}</td>
                <td data-label="Previous">{Number(r.previous_period_demand || 0)}</td>
                <td data-label="Oldest">{Number(r.oldest_period_demand || 0)}</td>
                <td data-label="Demand trend"><div className="forecast-demand-bars" role="img" aria-label={`Demand trend: ${r.oldest_period_demand || 0}, ${r.previous_period_demand || 0}, ${r.newest_period_demand || 0}`}>{[r.oldest_period_demand, r.previous_period_demand, r.newest_period_demand].map((value: any, i: number) => { const max = Math.max(1, Number(r.oldest_period_demand || 0), Number(r.previous_period_demand || 0), Number(r.newest_period_demand || 0)); return <span key={i} title={String(value ?? 0)} style={{ height: `${Math.max(8, Number(value || 0) / max * 100)}%` }} />; })}</div></td>
                <td data-label="WMA forecast" className="money"><span className="forecast-number">{whole(r.forecast)}</span></td>
                <td data-label="Suggested purchase qty."><span className="forecast-number">{Math.ceil(Number(r.forecast || 0))}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            title="No forecast rows returned"
            text={error ? "The forecast could not be loaded. See the message above." : "No inventory items to forecast yet. Add products in Inventory; forecasts use paid orders from the three most recent completed periods."}
          />
        )}
      </div>
      <TablePagination page={page} pageCount={pageCount} onPageChange={setPage} start={rows.length ? (page - 1) * rowsPerPage + 1 : 0} end={Math.min(page * rowsPerPage, rows.length)} total={rows.length} />
    </>
  );
}
