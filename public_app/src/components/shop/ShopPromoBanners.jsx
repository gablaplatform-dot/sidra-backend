import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  const { days, hours, minutes, seconds } = useCountdown(flash?.remainingSecs ?? 0);
  const ctaHref = flash?.ctaHref ?? "/shop";
  return (
    <div className="shop-promo shop-promo-flash">
      <div className="shop-promo-flash-copy">
        <p className="shop-promo-tag">{flash?.title ?? "Flash Sale"}</p>
        <h3 className="shop-promo-title">{flash?.subtitle ?? "Limited time offer"}</h3>
        <div className="shop-countdown">
          <TimeBox label="Days" value={days} />
          <span className="shop-countdown-colon">:</span>
          <TimeBox label="Hours" value={hours} />
          <span className="shop-countdown-colon">:</span>
          <TimeBox label="Min" value={minutes} />
          <span className="shop-countdown-colon">:</span>
          <TimeBox label="Sec" value={seconds} />
        </div>
        <Link to={ctaHref} className="shop-promo-cta shop-promo-cta-light">
          {flash?.cta ?? "Shop Now"} <IconArrowRight />
        </Link>
      </div>
      <div className="shop-promo-flash-img">
        <img src={flash?.image} alt={flash?.title ?? "Flash sale"} loading="lazy" />
      </div>
    </div>
  );
}

function NewCollectionBanner({ collection }) {
  const ctaHref = collection?.ctaHref ?? "/shop";
  return (
    <div className="shop-promo shop-promo-collection">
      <div className="shop-promo-collection-overlay" />
      <div className="shop-promo-collection-copy">
        <p className="shop-promo-tag shop-promo-tag-dark">{collection?.tag ?? collection?.title ?? "New Collection"}</p>
        <h3 className="shop-promo-title shop-promo-title-light">{collection?.title ?? "Fresh new season"}</h3>
        <p className="shop-promo-subtitle">{collection?.subtitle ?? "Discover the latest trends"}</p>
        <Link to={ctaHref} className="shop-promo-cta shop-promo-cta-solid">
          {collection?.cta ?? "Explore"} <IconArrowRight />
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
      <div className="shop-promo-grid">
        {flashSale ? <FlashSaleBanner flash={flashSale} /> : null}
        {newCollection ? <NewCollectionBanner collection={newCollection} /> : null}
      </div>
    </section>
  );
}
