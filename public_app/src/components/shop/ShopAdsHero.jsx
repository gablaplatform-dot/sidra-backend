import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const IconArrowRight = (props) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <polyline points="13 5 20 12 13 19" />
  </svg>
);

const SLIDE_INTERVAL_MS = 6000;

// Provider-created ads (image or video) for the Shop hero, nearest-shopper-first - the real
// replacement for the old static/fake hero. Reuses the exact same section/blob/copy/CTA classes
// as ShopHero (the empty-state fallback this replaces) so the two feel like one component to a
// shopper, not a redesign.
export default function ShopAdsHero({ ads = [] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [ads]);

  useEffect(() => {
    if (ads.length < 2) return undefined;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (!ads.length) return null;
  const ad = ads[index % ads.length];
  const ctaHref = ad.ctaHref || "/shop";

  return (
    <section className="shop-hero">
      <div className="shop-hero-blob shop-hero-blob-1" />
      <div className="shop-hero-blob shop-hero-blob-2" />

      <div className="shop-hero-inner">
        <div className="shop-hero-copy">
          <p className="shop-eyebrow">
            {Number.isFinite(ad.distanceKm) ? `NEAR YOU · ${Math.round(ad.distanceKm)} KM AWAY` : "FEATURED"}
          </p>
          <h1 className="shop-hero-title">{ad.title}</h1>
          {ad.subtitle ? <p className="shop-hero-subtitle">{ad.subtitle}</p> : null}
          <div className="shop-hero-actions">
            <Link to={ctaHref} className="shop-cta-primary">
              {ad.ctaLabel || "Shop Now"} <IconArrowRight />
            </Link>
          </div>
        </div>

        <div className="shop-hero-visual">
          <div className="shop-ads-hero-media-wrap">
            {ad.videoUrl ? (
              <video
                key={ad.id}
                className="shop-ads-hero-media"
                src={ad.videoUrl}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img key={ad.id} className="shop-ads-hero-media" src={ad.imageUrl} alt={ad.title} />
            )}
          </div>

          {ads.length > 1 ? (
            <div className="shop-ads-hero-dots">
              {ads.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  className={`shop-ads-hero-dot ${i === index ? "active" : ""}`}
                  aria-label={`Show ad ${i + 1}`}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
