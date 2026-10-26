import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { request } from "../../lib/api";
import { formatUgx } from "../../lib/format";
import { intlLocale } from "../../i18n";
import { IconBookmark, IconCart, IconImage, IconLock, IconSparkles, IconStar, IconUsers } from "../icons";
import { SectionSkeleton } from "../Skeleton";

const RANGE_OPTIONS = [7, 30, 90];

const formatNumber = (n) => Number(n ?? 0).toLocaleString(intlLocale());
const formatShortDate = (isoDay) => new Date(`${isoDay}T00:00:00`).toLocaleDateString(intlLocale(), { month: "short", day: "numeric" });

// Measures its own width so the chart is drawn in real pixels: text stays readable on a phone
// instead of shrinking with a fixed viewBox.
function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () => setWidth(Math.round(node.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Smooth line through the points (midpoint quadratic curves) - no chart library in this app.
function smoothPath(points) {
  if (points.length < 3) return points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q${points[i].x},${points[i].y} ${mx},${my}`;
  }
  const last = points[points.length - 1];
  return `${d} T${last.x},${last.y}`;
}

// Single series (profile visits), drawn as an area on the dark hero card. Touch or hover to read a day.
function VisitsChart({ data }) {
  const { t } = useTranslation();
  const [wrapRef, width] = useWidth();
  const [active, setActive] = useState(null);
  const height = 170;
  const pad = { top: 16, right: 6, bottom: 26, left: 6 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const maxValue = Math.max(1, ...data.map((d) => d.count));
  // Round the ceiling so the gridlines read as clean numbers.
  const ceil = maxValue <= 4 ? 4 : Math.ceil(maxValue / 4) * 4;
  const step = data.length > 1 ? plotW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({ x: pad.left + i * step, y: pad.top + plotH - (d.count / ceil) * plotH }));
  const line = smoothPath(points);
  const baseY = pad.top + plotH;
  const area = points.length ? `${line} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z` : "";
  const labelEvery = Math.max(1, Math.ceil(data.length / (width < 420 ? 4 : 7)));

  if (!data.length) return null;

  const pick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - pad.left) / Math.max(1, plotW);
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  };
  const tip = active !== null ? points[active] : null;
  const tipLeft = tip ? Math.min(Math.max(tip.x, 56), Math.max(56, width - 56)) : 0;

  return (
    <div className="an-chart" ref={wrapRef}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          className="an-chart-svg"
          role="img"
          aria-label={t("profile.analytics.chartAria", { days: data.length, max: maxValue })}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id="anFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((g) => {
            const y = pad.top + (plotH / 4) * g;
            return (
              <g key={g}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="an-grid" />
                {g < 4 && width > 300 ? <text x={pad.left} y={y - 4} className="an-axis">{Math.round(ceil - (ceil / 4) * g)}</text> : null}
              </g>
            );
          })}
          <path d={area} fill="url(#anFill)" />
          <path d={line} className="an-line" />
          {data.map((d, i) => (i % labelEvery === 0 ? (
            <text key={d.date} x={Math.min(Math.max(points[i].x, 22), width - 22)} y={height - 8} textAnchor="middle" className="an-axis">
              {formatShortDate(d.date)}
            </text>
          ) : null))}
          {tip ? (
            <g>
              <line x1={tip.x} x2={tip.x} y1={pad.top} y2={baseY} className="an-cursor" />
              <circle cx={tip.x} cy={tip.y} r="5" className="an-dot" />
            </g>
          ) : null}
        </svg>
      ) : null}
      {tip ? (
        <div className="an-tip" style={{ left: tipLeft }}>
          <strong>{formatNumber(data[active].count)}</strong> {t("profile.analytics.visit", { count: data[active].count })}
          <span>{formatShortDate(data[active].date)}</span>
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

function StatTile({ tone, Icon, label, value, sub }) {
  return (
    <div className={`an-tile an-${tone}`}>
      <span className="an-tile-ico" aria-hidden="true"><Icon /></span>
      <span className="an-tile-label">{label}</span>
      <strong className="an-tile-value">{value}</strong>
      {sub ? <span className="an-tile-sub">{sub}</span> : null}
    </div>
  );
}

function BarRows({ rows, ranked }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="an-rows">
      {rows.map((row, i) => (
        <li key={row.key}>
          <div className="an-row-top">
            {ranked ? <b className="an-rank">{i + 1}</b> : null}
            <span className="an-row-name">{row.label}</span>
            <strong className="an-row-value">{row.valueLabel}</strong>
          </div>
          <div className="an-bar"><i style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
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

  const totals = data?.totals;
  const quiet = totals && !totals.profileViews && !totals.contactUnlocks && !totals.listingViews && !totals.orders;

  return (
    <section className="detail-block an-page">
      <div className="detail-block-header">
        <h2>{t("profile.tabs.analytics")}</h2>
        <div className="analytics-range-toggle" role="group">
          {RANGE_OPTIONS.map((opt) => (
            <button key={opt} type="button" className={days === opt ? "is-active" : ""} aria-pressed={days === opt} onClick={() => setDays(opt)}>
              {t("profile.analytics.rangeDays", { n: opt })}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="error-message home-error">{error}</div> : null}

      {data ? (
        <div className={loading ? "an-body is-refreshing" : "an-body"}>
          <div className="an-hero">
            <div className="an-hero-top">
              <div>
                <span className="an-hero-label"><IconUsers aria-hidden="true" /> {t("profile.analytics.profileViews")}</span>
                <strong className="an-hero-value">{formatNumber(data.dailyVisits.reduce((sum, d) => sum + d.count, 0))}</strong>
                <span className="an-hero-sub">{t("profile.analytics.lastDays", { days })}</span>
              </div>
              {data.trend ? (
                <span className={`an-trend ${data.trend.changePercent >= 0 ? "is-up" : "is-down"}`}>
                  {data.trend.changePercent >= 0 ? "▲" : "▼"} {t("profile.analytics.vsPrevWeek", { percent: Math.abs(data.trend.changePercent) })}
                </span>
              ) : null}
            </div>
            <VisitsChart data={data.dailyVisits} />
          </div>

          {quiet ? (
            <div className="an-quiet">
              <IconSparkles aria-hidden="true" />
              <p>{t("profile.analytics.noActivity")}</p>
            </div>
          ) : null}

          <div className="an-grid-tiles">
            <StatTile
              tone="orange"
              Icon={IconLock}
              label={t("profile.analytics.contactUnlocks")}
              value={formatNumber(totals.contactUnlocks)}
            />
            <StatTile tone="blue" Icon={IconImage} label={t("profile.analytics.listingViews")} value={formatNumber(totals.listingViews)} />
            <StatTile
              tone="green"
              Icon={IconCart}
              label={t("profile.tabs.orders")}
              value={formatNumber(totals.orders)}
              sub={Number(totals.orderRevenue) > 0 ? t("profile.analytics.fulfilled", { amount: formatUgx(totals.orderRevenue) }) : null}
            />
            <StatTile tone="pink" Icon={IconBookmark} label={t("profile.analytics.favorites")} value={formatNumber(totals.favorites)} />
            <StatTile
              tone="amber"
              Icon={IconStar}
              label={t("profile.analytics.rating")}
              value={totals.ratingCount ? Number(totals.ratingAvg).toFixed(1) : t("common.new")}
              sub={totals.ratingCount ? t("profile.analytics.reviews", { count: totals.ratingCount }) : null}
            />
          </div>

          {data.contactEventsByType.length || data.topListings.length ? (
            <div className="an-breakdowns">
              {data.contactEventsByType.length ? (
                <div className="an-card">
                  <h3>{t("profile.analytics.howReach")}</h3>
                  <BarRows
                    rows={[...data.contactEventsByType].sort((x, y) => y.count - x.count).map((row) => ({
                      key: row.type,
                      label: t(`profile.analytics.contact.${row.type}`, { defaultValue: row.type }),
                      value: row.count,
                      valueLabel: formatNumber(row.count)
                    }))}
                  />
                </div>
              ) : null}
              {data.topListings.length ? (
                <div className="an-card">
                  <h3>{t("profile.analytics.topListings")}</h3>
                  <BarRows
                    ranked
                    rows={data.topListings.map((listing) => ({
                      key: listing.id,
                      label: listing.name,
                      value: listing.viewCount,
                      valueLabel: `${formatNumber(listing.viewCount)} ${t("profile.analytics.view", { count: listing.viewCount })}`
                    }))}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
