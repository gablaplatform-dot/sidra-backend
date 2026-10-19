import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { request } from "../../lib/api";
import { formatUgx } from "../../lib/format";
import { intlLocale } from "../../i18n";
import { IconBox } from "../icons";
import { SectionSkeleton } from "../Skeleton";

const RANGE_OPTIONS = [7, 30, 90];

const formatNumber = (n) => Number(n ?? 0).toLocaleString(intlLocale());
const formatShortDate = (isoDay) => new Date(`${isoDay}T00:00:00`).toLocaleDateString(intlLocale(), { month: "short", day: "numeric" });

// Hand-rolled - this app has no chart library and hand-rolls every icon/graphic as inline SVG, so
// a small dependency-free bar chart matches the codebase rather than pulling in a new package.
// Single series (profile visits), so no legend is needed - the chart title already names it.
function VisitsChart({ data }) {
  const { t } = useTranslation();
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
      <svg viewBox={`0 0 ${width} ${height}`} className="analytics-chart-svg" role="img" aria-label={t("profile.analytics.chartAria", { days: data.length, max: maxValue })}>
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
          <strong>{data[hoverIndex].count}</strong> {t("profile.analytics.visit", { count: data[hoverIndex].count })}
          <span>{formatShortDate(data[hoverIndex].date)}</span>
        </div>
      ) : null}

      <table className="sr-only">
        <caption>{t("profile.analytics.visitsByDay")}</caption>
        <thead><tr><th>{t("profile.analytics.date")}</th><th>{t("profile.analytics.visits")}</th></tr></thead>
        <tbody>
          {data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function ProfileAnalyticsTab() {
  const { t } = useTranslation();
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
        if (active) setError(loadError.message || t("profile.analytics.errLoad"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [days]);

  if (loading && !data) return <SectionSkeleton rows={3} label={t("profile.analytics.loading")} />;

  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h2>{t("profile.tabs.analytics")}</h2>
        <div className="analytics-range-toggle">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={days === opt ? "is-active" : ""}
              onClick={() => setDays(opt)}
            >
              {t("profile.analytics.rangeDays", { n: opt })}
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
              <p>{t("profile.analytics.noActivity")}</p>
            </div>
          ) : null}

          <div className="analytics-stat-grid">
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">{t("profile.analytics.profileViews")}</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.profileViews)}</strong>
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">{t("profile.analytics.contactUnlocks")}</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.contactUnlocks)}</strong>
              {Number(data.totals.contactUnlockRevenue) > 0 ? (
                <span className="analytics-stat-sub">{t("profile.analytics.earned", { amount: formatUgx(data.totals.contactUnlockRevenue) })}</span>
              ) : null}
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">{t("profile.analytics.listingViews")}</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.listingViews)}</strong>
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">{t("profile.tabs.orders")}</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.orders)}</strong>
              {Number(data.totals.orderRevenue) > 0 ? (
                <span className="analytics-stat-sub">{t("profile.analytics.fulfilled", { amount: formatUgx(data.totals.orderRevenue) })}</span>
              ) : null}
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">{t("profile.analytics.favorites")}</span>
              <strong className="analytics-stat-value">{formatNumber(data.totals.favorites)}</strong>
            </div>
            <div className="analytics-stat-tile">
              <span className="analytics-stat-label">{t("profile.analytics.rating")}</span>
              <strong className="analytics-stat-value">{data.totals.ratingCount ? Number(data.totals.ratingAvg).toFixed(1) : t("common.new")}</strong>
              {data.totals.ratingCount ? (
                <span className="analytics-stat-sub">{t("profile.analytics.reviews", { count: data.totals.ratingCount })}</span>
              ) : null}
            </div>
          </div>

          <div className="analytics-chart-card">
            <div className="analytics-chart-header">
              <div>
                <h3>{t("profile.analytics.visits")}</h3>
                <p className="provider-meta">{t("profile.analytics.lastDays", { days })}</p>
              </div>
              {data.trend ? (
                <span className={`analytics-trend-badge ${data.trend.changePercent >= 0 ? "is-up" : "is-down"}`}>
                  {data.trend.changePercent >= 0 ? "▲" : "▼"} {t("profile.analytics.vsPrevWeek", { percent: Math.abs(data.trend.changePercent) })}
                </span>
              ) : null}
            </div>
            <VisitsChart data={data.dailyVisits} />
          </div>

          {data.contactEventsByType.length || data.topListings.length ? (
            <div className="analytics-breakdown-grid">
              {data.contactEventsByType.length ? (
                <div className="analytics-breakdown-card">
                  <h3>{t("profile.analytics.howReach")}</h3>
                  <ul className="analytics-breakdown-list">
                    {data.contactEventsByType.map((row) => (
                      <li key={row.type}>
                        <span>{t(`profile.analytics.contact.${row.type}`, { defaultValue: row.type })}</span>
                        <strong>{formatNumber(row.count)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.topListings.length ? (
                <div className="analytics-breakdown-card">
                  <h3>{t("profile.analytics.topListings")}</h3>
                  <ul className="analytics-breakdown-list">
                    {data.topListings.map((listing) => (
                      <li key={listing.id}>
                        <span>{listing.name}</span>
                        <strong>{formatNumber(listing.viewCount)} {t("profile.analytics.view", { count: listing.viewCount })}</strong>
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
