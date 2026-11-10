import React, { useMemo, useState } from "react";
import { LineChart } from "./LineChart";
import { money, moneyWhole } from "../../utils/formatters";

type Mode = "daily" | "monthly";
const key = (d: Date, mode: Mode) => mode === "daily" ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** Weighted Moving Average with weights 5:3:2 (newest first), the same rule used by the inventory forecasts. */
export const wma3 = (a: number, b: number, c: number) => (5 * a + 3 * b + 2 * c) / 10;

export function buildSalesSeries(sales: any[], mode: Mode, periods: number) {
  const now = new Date(); const buckets: { k: string; label: string; date: Date }[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    const d = new Date(now); if (mode === "daily") d.setDate(d.getDate() - i); else { d.setDate(1); d.setMonth(d.getMonth() - i); }
    buckets.push({ k: key(d, mode), date: d, label: mode === "daily" ? d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : d.toLocaleDateString("en-PH", { month: "short", year: "2-digit" }) });
  }
  const totals = new Map<string, number>(); sales.forEach(s => { const d = new Date(s.created_at || s.date); const k = key(d, mode); totals.set(k, (totals.get(k) || 0) + Number(s.total_amount || 0)); });
  const actual = buckets.map(b => totals.get(b.k) || 0);
  // WMA for period t uses the three periods before it. The final extra point is the forecast for the next period.
  // Forecast values are rounded to whole numbers (whole pesos) so no decimals appear anywhere.
  const forecast: (number | null)[] = actual.map((_, i) => i >= 3 ? Math.round(wma3(actual[i - 1]!, actual[i - 2]!, actual[i - 3]!)) : null);
  const next = Math.round(wma3(actual[actual.length - 1]!, actual[actual.length - 2]!, actual[actual.length - 3]!));
  const nextDate = new Date(now); if (mode === "daily") nextDate.setDate(nextDate.getDate() + 1); else { nextDate.setDate(1); nextDate.setMonth(nextDate.getMonth() + 1); }
  const labels = [...buckets.map(b => b.label), (mode === "daily" ? nextDate.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : nextDate.toLocaleDateString("en-PH", { month: "short", year: "2-digit" })) + " ▸"];
  return { labels, actual: [...actual, null], forecast: [...forecast, next], next, actualRaw: actual };
}

export function SalesCharts({ sales }: { sales: any[] }) {
  const [mode, setMode] = useState<Mode>("daily");
  const periods = mode === "daily" ? 30 : 12;
  const d = useMemo(() => buildSalesSeries(sales, mode, periods), [sales, mode, periods]);
  const total = d.actualRaw.reduce((n, v) => n + v, 0); const last = d.actualRaw[d.actualRaw.length - 1] || 0;
  const prev = d.actualRaw[d.actualRaw.length - 2] || 0; const delta = prev ? ((last - prev) / prev) * 100 : 0;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div><h2>Sales trend and WMA forecast</h2><p>Revenue from verified paid orders, with the weighted moving average (5 : 3 : 2) forecast for the next {mode === "daily" ? "day" : "month"}.</p></div>
        <div className="forecast-tabs compact-tabs" role="tablist">{(["daily", "monthly"] as Mode[]).map(m => <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "selected" : ""} onClick={() => setMode(m)}>{m === "daily" ? "Daily · 30 days" : "Monthly · 12 months"}</button>)}</div>
      </div>
      <div className="chart-stats">
        <div><small>Total in range</small><strong>{money(total)}</strong></div>
        <div><small>Latest {mode === "daily" ? "day" : "month"}</small><strong>{money(last)}</strong><em className={delta >= 0 ? "up" : "down"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs previous</em></div>
        <div><small>Forecast next {mode === "daily" ? "day" : "month"}</small><strong>{moneyWhole(d.next)}</strong></div>
      </div>
      <LineChart ariaLabel={`${mode} sales with weighted moving average forecast`} labels={d.labels} forecastFrom={d.labels.length - 1} format={n => n >= 1000 ? `₱${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₱${Math.round(n)}`}
        series={[{ name: "Actual sales", color: "#2563eb", values: d.actual }, { name: "WMA forecast", color: "#f59e0b", values: d.forecast, dashed: true }]} />
    </section>
  );
}

/** Per-product demand: the three most recent completed periods and the WMA prediction. */
export function DemandChart({ rows, period }: { rows: any[]; period: string }) {
  const [id, setId] = useState<string>("");
  const row = rows.find(r => String(r.inventory_id) === id) || rows[0];
  if (!row) return null;
  const labels = ["Oldest", "Previous", "Newest", "Forecast ▸"]; const unit = period === "daily" ? "day" : period === "weekly" ? "week" : "month";
  return (
    <div className="demand-chart">
      <div className="demand-chart-head"><label>Product<select value={String(row.inventory_id)} onChange={e => setId(e.target.value)}>{rows.map(r => <option key={r.inventory_id} value={r.inventory_id}>{r.item_name}</option>)}</select></label>
        <p className="muted">Units sold per {unit}, last three completed periods, and the forecast for the next one.</p></div>
      <LineChart height={220} ariaLabel={`Demand trend for ${row.item_name}`} labels={labels} forecastFrom={3} format={n => `${Math.round(n)}`}
        series={[{ name: "Units sold", color: "#2563eb", values: [Number(row.oldest_period_demand || 0), Number(row.previous_period_demand || 0), Number(row.newest_period_demand || 0), null] },
          { name: "WMA forecast", color: "#f59e0b", dashed: true, values: [null, null, Number(row.newest_period_demand || 0), Math.round(Number(row.forecast || 0))] }]} />
    </div>
  );
}
