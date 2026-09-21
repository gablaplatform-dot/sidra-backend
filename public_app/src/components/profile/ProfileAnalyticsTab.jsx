import React, { useEffect, useState } from "react";
import { request } from "../../lib/api";
import { IconBox } from "../icons";

const RANGE_OPTIONS = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" }
];

const CONTACT_LABELS = { call: "Calls", whatsapp: "WhatsApp", email: "Emails", website: "Website clicks", directions: "Directions" };

const formatNumber = (n) => Number(n ?? 0).toLocaleString();
const formatUgx = (v) => `UGX ${Number(v ?? 0).toLocaleString()}`;
const formatShortDate = (isoDay) => new Date(`${isoDay}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Hand-rolled - this app has no chart library and hand-rolls every icon/graphic as inline SVG, so
// a small dependency-free bar chart matches the codebase rather than pulling in a new package.
// Single series (profile visits), so no legend is needed - the chart title already names it.
function VisitsChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  if (!data.length) return null;

  const width = 700;
  const height = 180;
  const padding = { top: 12, right: 4, bottom: 24, left: 4 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...data.map((d) => d.count));
  const barGap = Math.min(6, plotWidth / data.length / 3);
  const barWidth = Math.max(2, plotWidth / data.length - barGap);
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="analytics-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-chart-svg" role="img" aria-label={`Profile visits per day over the last ${data.length} days, from 0 up to ${maxValue}`}>
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--gabla-border)" strokeWidth="1" />
        {data.map((d, i) => {
          const x = padding.left + i * (barWidth + barGap);
          const barHeight = (d.count / maxValue) * plotHeight;
          const y = height - padding.bottom - barHeight;
          const isHover = hoverIndex === i;
          return (
            <g key={d.date}>
              <rect
                x={x - barGap / 2}
                y={padding.top}
                width={barWidth + barGap}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              <rect
                x={x}
                y={d.count > 0 ? y : height - padding.bottom - 2}
                width={barWidth}
                height={d.count > 0 ? Math.max(barHeight, 3) : 2}
                rx={Math.min(3, barWidth / 2)}
                fill={isHover ? "var(--gabla-accent-dark)" : "var(--gabla-accent)"}
                opacity={d.count > 0 ? 1 : 0.25}
              />
              {i % labelEvery === 0 ? (
                <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fontSize="9" fill="var(--gabla-text-faint)">
                  {formatShortDate(d.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null ? (
        <div className="analytics-chart-tooltip" style={{ left: `${((hoverIndex + 0.5) / data.length) * 100}%` }}>
          <strong>{data[hoverIndex].count}</strong> visit{data[hoverIndex].count === 1 ? "" : "s"}
          <span>{formatShortDate(data[hoverIndex].date)}</span>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>Profile visits by day</caption>
        <thead><tr><th>Date</th><th>Visits</th></tr></thead>
        <tbody>
          {data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function ProfileAnalyticsTab() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    request(`/engagement/provider/analytics?days=${days}`)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load your analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  if (loading && !data) return <p className="home-empty page-loading">Loading your analytics…</p>;

  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h2>Analytics</h2>
        <div className="analytics-range-toggle">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={days === opt.key ? "is-active" : ""}
              onClick={() => setDays(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="error-message home-error">{error}</div> : null}

      {data ? (
        <>
          {data.totals.profileViews === 0 && data.totals.contactUnlocks === 0 && data.totals.listingViews === 0 && data.totals.orders === 0 ? (
            <div className="empty-state" style={{ marginBottom: 20 }}>
              <IconBox />
              <p>No activity yet. Once people start viewing your profile and reaching out, you&apos;ll see it here.</p>
            </div>
          ) : null}

          <div className="analytics-stat-grid">
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">Profile views</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.profileViews)}</strong>
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">Contact unlocks</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.contactUnlocks)}</strong>
              {Number(data.totals.contactUnlockRevenue) > 0 ? (
                <span className="analytics-stat-sub">{formatUgx(data.totals.contactUnlockRevenue)} earned</span>
              ) : null}
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">Listing views</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.listingViews)}</strong>
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">Orders</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.orders)}</strong>
              {Number(data.totals.orderRevenue) > 0 ? (
                <span className="analytics-stat-sub">{formatUgx(data.totals.orderRevenue)} fulfilled</span>
              ) : null}
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">Favorites</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.favorites)}</strong>
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">Rating</span>
              <strong className="analytics-stat-value">{data.totals.ratingCount ? Number(data.totals.ratingAvg).toFixed(1) : "New"}</strong>
              {data.totals.ratingCount ? (
                <span className="analytics-stat-sub">{data.totals.ratingCount} review{data.totals.ratingCount === 1 ? "" : "s"}</span>
              ) : null}
            </div>
          </div>

          <div className="analytics-chart-card">
            <div className="analytics-chart-header">
              <div>
                <h3>Profile visits</h3>
                <p className="provider-meta">Last {days} days</p>
              </div>
              {data.trend ? (
                <span className={`analytics-trend-badge ${data.trend.changePercent >= 0 ? "is-up" : "is-down"}`}>
                  {data.trend.changePercent >= 0 ? "▲" : "▼"} {Math.abs(data.trend.changePercent)}% vs previous week
                </span>
              ) : null}
            </div>
            <VisitsChart data={data.dailyVisits} />
          </div>

          {data.contactEventsByType.length || data.topListings.length ? (
            <div className="analytics-breakdown-grid">
              {data.contactEventsByType.length ? (
                <div className="analytics-breakdown-card">
                  <h3>How people reach out</h3>
                  <ul className="analytics-breakdown-list">
                    {data.contactEventsByType.map((row) => (
                      <li key={row.type}>
                        <span>{CONTACT_LABELS[row.type] || row.type}</span>
                        <strong>{formatNumber(row.count)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.topListings.length ? (
                <div className="analytics-breakdown-card">
                  <h3>Top viewed listings</h3>
                  <ul className="analytics-breakdown-list">
                    {data.topListings.map((listing) => (
                      <li key={listing.id}>
                        <span>{listing.name}</span>
                        <strong>{formatNumber(listing.viewCount)} view{listing.viewCount === 1 ? "" : "s"}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
