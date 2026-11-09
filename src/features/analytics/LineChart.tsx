import React, { useMemo, useState } from "react";

export interface Series { name: string; color: string; values: (number | null)[]; dashed?: boolean; }
interface Props { labels: string[]; series: Series[]; height?: number; format?: (n: number) => string; forecastFrom?: number; ariaLabel: string; }

const nice = (max: number) => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))); const n = max / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

/** Dependency-free interactive SVG line chart with hover tooltip and keyboard-readable summary. */
export function LineChart({ labels, series, height = 300, format = n => String(Math.round(n)), forecastFrom, ariaLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900, H = height, pad = { l: 58, r: 16, t: 14, b: 34 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = useMemo(() => nice(Math.max(1, ...series.flatMap(s => s.values.map(v => v ?? 0)))), [series]);
  const x = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  const step = Math.max(1, Math.ceil(labels.length / 8));
  const path = (vals: (number | null)[]) => { let d = "", pen = false; vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; }); return d; };
  const area = (vals: (number | null)[]) => { const pts = vals.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[]; if (pts.length < 2) return ""; return `M${pts[0]![0]},${pad.t + ih} ` + pts.map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1]![0]},${pad.t + ih} Z`; };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / iw) * (labels.length - 1)); setHover(Math.max(0, Math.min(labels.length - 1, i)));
  };
  return (
    <div className="line-chart">
      <div className="chart-legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} className={s.dashed ? "dash" : ""} /> {s.name}</span>)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)} className="chart-svg">
        {ticks.map((t, i) => <g key={i}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" /><text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">{format(t)}</text></g>)}
        {labels.map((l, i) => i % step === 0 || i === labels.length - 1 ? <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="chart-axis">{l}</text> : null)}
        {forecastFrom != null && forecastFrom < labels.length && <rect x={x(forecastFrom) - 4} y={pad.t} width={W - pad.r - x(forecastFrom) + 4} height={ih} className="chart-forecast-zone" />}
        {series[0] && <path d={area(series[0].values)} fill={series[0].color} opacity="0.1" />}
        {series.map(s => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "7 5" : undefined} />)}
        {hover != null && <g>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="chart-cursor" />
          {series.map(s => s.values[hover] != null ? <circle key={s.name} cx={x(hover)} cy={y(s.values[hover]!)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" /> : null)}
        </g>}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <strong>{labels[hover]}</strong>
          {series.map(s => s.values[hover] != null && <span key={s.name}><i style={{ background: s.color }} />{s.name}: <b>{format(s.values[hover]!)}</b></span>)}
        </div>
      )}
    </div>
  );
}
