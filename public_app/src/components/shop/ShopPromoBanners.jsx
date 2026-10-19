import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BannerSkeleton } from "../Skeleton";
import { safeHref } from "../../lib/safeHref";

const IconArrowRight = (props) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="13 5 20 12 13 19" />
  </svg>
);

function useCountdown(initialSecs) {
  const safeInitial = Math.max(0, Math.floor(Number(initialSecs ?? 0)));
  const [remainingMs, setRemainingMs] = useState(() => safeInitial * 1000);

  useEffect(() => {
    const resetMs = Math.max(0, Math.floor(Number(initialSecs ?? 0))) * 1000;
    setRemainingMs(resetMs);
    const target = Date.now() + resetMs;
    const timer = setInterval(() => {
      setRemainingMs(Math.max(0, target - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [initialSecs]);

  const totalSec = Math.floor(remainingMs / 1000);
  return {
    days: String(Math.floor(totalSec / 86400)).padStart(2, "0"),
    hours: String(Math.floor((totalSec % 86400) / 3600)).padStart(2, "0"),
    minutes: String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0"),
    seconds: String(totalSec % 60).padStart(2, "0")
  };
}

const TimeBox = ({ label, value }) => (
  <div className="shop-countdown-box">
    <span className="shop-countdown-value">{value}</span>
    <span className="shop-countdown-label">{label}</span>
  </div>
);

function FlashSaleBanner({ flash }) {
  const { t } = useTranslation();
  const { days, hours, minutes, seconds } = useCountdown(flash?.remainingSecs ?? 0);
  const ctaHref = safeHref(flash?.ctaHref, "/shop");
  return (
    <div className="shop-promo shop-promo-flash">
      <div className="shop-promo-flash-copy">
        <p className="shop-promo-tag">{flash?.title ?? t("shop.promo.flashSale")}</p>
        <h3 className="shop-promo-title">{flash?.subtitle ?? t("shop.promo.limitedTime")}</h3>
        <div className="shop-countdown">
          <TimeBox label={t("shop.promo.days")} value={days} />
          <span className="shop-countdown-colon">:</span>
          <TimeBox label={t("shop.promo.hours")} value={hours} />
          <span className="shop-countdown-colon">:</span>
          <TimeBox label={t("shop.promo.min")} value={minutes} />
          <span className="shop-countdown-colon">:</span>
          <TimeBox label={t("shop.promo.sec")} value={seconds} />
        </div>
        <Link to={ctaHref} className="shop-promo-cta shop-promo-cta-light">
          {flash?.cta ?? t("shop.promo.shopNow")} <IconArrowRight />
        </Link>
      </div>
      <div className="shop-promo-flash-img">
        <img src={flash?.image} alt={flash?.title ?? t("shop.promo.flashSaleAlt")} loading="lazy" />
      </div>
    </div>
  );
}

function NewCollectionBanner({ collection }) {
  const { t } = useTranslation();
  const ctaHref = safeHref(collection?.ctaHref, "/shop");
  return (
    <div className="shop-promo shop-promo-collection">
      <div className="shop-promo-collection-overlay" />
      <div className="shop-promo-collection-copy">
        <p className="shop-promo-tag shop-promo-tag-dark">{collection?.tag ?? collection?.title ?? t("shop.promo.newCollection")}</p>
        <h3 className="shop-promo-title shop-promo-title-light">{collection?.title ?? t("shop.promo.freshSeason")}</h3>
        <p className="shop-promo-subtitle">{collection?.subtitle ?? t("shop.promo.discoverTrends")}</p>
        <Link to={ctaHref} className="shop-promo-cta shop-promo-cta-solid">
          {collection?.cta ?? t("shop.promo.explore")} <IconArrowRight />
        </Link>
      </div>
      <div
        className="shop-promo-collection-img"
        style={{ backgroundImage: `url("${collection?.image}")` }}
      />
    </div>
  );
}

export default function ShopPromoBanners({ flashSale, newCollection, loaded }) {
  return (
    <section className="shop-section">
      {!loaded ? (
        <BannerSkeleton />
      ) : (
        <div className="shop-promo-grid">
          {flashSale ? <FlashSaleBanner flash={flashSale} /> : null}
          {newCollection ? <NewCollectionBanner collection={newCollection} /> : null}
        </div>
      )}
    </section>
  );
}
