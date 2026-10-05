import React, { useId, useMemo, useState } from "react";

import { dayLabel, todayEat, ugx } from "../../../lib/bus";
import { niceScale, ugxShort, useSize } from "./util";

// Hand-built SVG charts (no chart library). Colours come from CSS variables so they follow the theme.

// Smooth line through points (Catmull-Rom converted to cubic Beziers).
const smooth = (pts) => {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
};

export function Sparkline({ values = [], tone = "orange", width = 96, height = 38, label }) {
  const id = useId().replace(/:/g, "");
  const { line, area, end } = useMemo(() => {
    const vals = values.length > 1 ? values : [0, ...values, ...values];
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const span = max - min || 1;
    const padX = 4;
    const padY = 6;
    const pts = vals.map((v, i) => [padX + (i * (width - padX * 2 - 2)) / (vals.length - 1), padY + (1 - (v - min) / span) * (height - padY * 2)]);
    const l = smooth(pts);
    const last = pts[pts.length - 1];
    return { line: l, area: `${l} L${last[0]},${height} L${pts[0][0]},${height} Z`, end: last };
  }, [values, width, height]);
  return (
    <svg className={`bop-spark is-${tone}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label || "Trend"}>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp${id})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={end[0]} cy={end[1]} r="6" fill="currentColor" opacity="0.16" />
      <circle cx={end[0]} cy={end[1]} r="3.2" fill="#fff" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

const roundedTop = (x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
};

// Bars + line over 7 days, y axis with UGX abbreviations, hover / tap tooltip.
export function SalesChart({ trend = [], metric = "revenue" }) {
  const id = useId().replace(/:/g, "");
  const [ref, { width: W, height: H }] = useSize();
  const [active, setActive] = useState(null);
  const today = todayEat();

  const padL = metric === "revenue" ? 44 : 34;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const vals = trend.map((d) => Number(metric === "revenue" ? d.revenue : d.tickets) || 0);
  const scale = niceScale(Math.max(...vals, 1), W < 420 ? 3 : 4);
  const innerW = Math.max(10, W - padL - padR);
  const innerH = Math.max(10, H - padT - padB);
  const band = trend.length ? innerW / trend.length : innerW;
  const bw = Math.min(46, band * 0.56);
  const xOf = (i) => padL + band * i + band / 2;
  const yOf = (v) => padT + innerH - (v / scale.top) * innerH;
  const pts = vals.map((v, i) => [xOf(i), yOf(v)]);
  const fmt = (v) => (metric === "revenue" ? ugxShort(v) : String(v));
  const last = trend.length - 1;

  const tip = active !== null && trend[active] ? trend[active] : null;
  const tipX = active !== null ? xOf(active) : 0;
  const tipLeft = Math.min(Math.max(tipX, 84), Math.max(84, W - 84));

  return (
    <div className="bop-chart" ref={ref}>
      {W > 0 && H > 0 ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Last 7 days ${metric === "revenue" ? "sales in UGX" : "tickets sold"}`} onMouseLeave={() => setActive(null)}>
          <defs>
            <linearGradient id={`bar${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--bop-bar-top)" />
              <stop offset="100%" stopColor="var(--bop-bar-bot)" />
            </linearGradient>
            <linearGradient id={`barT${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8a3d" />
              <stop offset="100%" stopColor="#f26a1b" />
            </linearGradient>
          </defs>
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? "bop-chart-axis" : "bop-chart-grid"} />
              <text x={padL - 10} y={yOf(t) + 4} textAnchor="end" className="bop-chart-tick">{fmt(t)}</text>
            </g>
          ))}
          {trend.map((d, i) => {
            const v = vals[i];
            const h = Math.max(v ? 5 : 2, (v / scale.top) * innerH);
            const isToday = d.date === today;
            const on = active === i;
            return (
              <g key={d.date}>
                {on ? <rect x={padL + band * i} y={padT - 6} width={band} height={innerH + 6} rx="10" className="bop-chart-hover" /> : null}
                <path d={roundedTop(xOf(i) - bw / 2, padT + innerH - h, bw, h, 9)} fill={`url(#${isToday ? "barT" : "bar"}${id})`} opacity={active === null || on || isToday ? 1 : 0.7} />
                <text x={xOf(i)} y={H - 9} textAnchor="middle" className={`bop-chart-lbl ${isToday ? "is-today" : ""}`}>{isToday ? "Today" : dayLabel(d.date).split(" ")[0]}</text>
              </g>
            );
          })}
          {pts.length > 1 ? <path d={smooth(pts)} fill="none" className="bop-chart-line" /> : null}
          {pts.map((p, i) => (i === last ? null : <circle key={i} cx={p[0]} cy={p[1]} r={active === i ? 5 : 3.4} className="bop-chart-dot" />))}
          {pts.length ? (
            <g>
              <circle cx={pts[last][0]} cy={pts[last][1]} r="11" className="bop-chart-halo" />
              <circle cx={pts[last][0]} cy={pts[last][1]} r="5.6" className="bop-chart-end" />
            </g>
          ) : null}
          {trend.map((d, i) => (
            <rect key={`hit${d.date}`} x={padL + band * i} y={0} width={band} height={H} fill="transparent" tabIndex={0} role="img" aria-label={`${dayLabel(d.date)}: ${ugx(d.revenue)}, ${d.tickets} ticket${d.tickets === 1 ? "" : "s"}`} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(active === i ? null : i)} style={{ outline: "none", cursor: "pointer" }} />
          ))}
        </svg>
      ) : null}
      {tip ? (
        <div className="bop-chart-tip" style={{ left: tipLeft, top: Math.max(0, yOf(vals[active]) - 74) }} role="status">
          <small>{dayLabel(tip.date)}</small>
          <strong>{ugx(tip.revenue)}</strong>
          <span>{tip.tickets} ticket{tip.tickets === 1 ? "" : "s"}</span>
        </div>
      ) : null}
    </div>
  );
}
