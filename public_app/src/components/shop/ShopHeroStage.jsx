import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { safeHref } from "../../lib/safeHref";
import LazyImg from "../LazyImg";
import { IconArrowRight, IconChevronLeft, IconGrid, IconSparkles, IconStar, IconStore, IconWrench } from "../icons";

// The Shop's opening stage. It is deliberately still: no floating cards, no blobs, no auto-advancing slides - the
// only thing that may move is a video ad. What it shows, in order of preference:
//   1. ads that sellers placed (video or photo), picked by hand with the thumbnails or arrows;
//   2. real new products, laid out as a tile grid;
//   3. nothing at all yet: a calm panel with the ways into the shop, so the top of the page is never empty.

const AdMedia = ({ ad, active }) =>
  ad.videoUrl ? (
    <video key={ad.id} className="sh-media" src={ad.videoUrl} poster={ad.imageUrl || undefined} autoPlay={active} muted loop playsInline preload="metadata" />
  ) : (
    <img key={ad.id} className="sh-media" src={ad.imageUrl} alt={ad.title} decoding="async" />
  );

function AdsStage({ ads }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [ads]);
  const ad = ads[index % ads.length];
  const go = (delta) => setIndex((i) => (i + delta + ads.length) % ads.length);

  return (
    <div className="sh-grid">
      <div className="sh-copy">
        <span className="sh-pill">{Number.isFinite(ad.distanceKm) ? t("shop.adsHero.nearYou", { km: Math.round(ad.distanceKm) }) : t("shop.adsHero.featured")}</span>
        <h1 className="sh-title">{ad.title}</h1>
        {ad.subtitle ? <p className="sh-sub">{ad.subtitle}</p> : null}
        <Link to={safeHref(ad.ctaHref, "/shop")} className="sh-cta">{ad.ctaLabel || t("shop.adsHero.shopNow")} <IconArrowRight width={16} height={16} /></Link>
      </div>

      <div className="sh-visual">
        <div className="sh-stage">
          <AdMedia ad={ad} active />
          {ads.length > 1 ? (
            <>
              <button type="button" className="sh-arrow is-prev" onClick={() => go(-1)} aria-label={t("shop.stage.prev")}><IconChevronLeft /></button>
              <button type="button" className="sh-arrow is-next" onClick={() => go(1)} aria-label={t("shop.stage.next")}><IconChevronLeft /></button>
            </>
          ) : null}
        </div>
        {ads.length > 1 ? (
          <div className="sh-thumbs" role="tablist">
            {ads.slice(0, 8).map((a, i) => (
              <button key={a.id} type="button" role="tab" aria-selected={i === index} className={i === index ? "is-active" : ""} onClick={() => setIndex(i)} aria-label={t("shop.adsHero.showAd", { n: i + 1 })}>
                {a.videoUrl && !a.imageUrl ? <video src={`${a.videoUrl}#t=0.1`} muted preload="metadata" playsInline /> : <img src={a.imageUrl} alt="" loading="lazy" decoding="async" />}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductsStage({ products }) {
  const { t } = useTranslation();
  return (
    <div className="sh-grid">
      <div className="sh-copy">
        <span className="sh-pill">{t("shop.stage.productsEyebrow")}</span>
        <h1 className="sh-title">{t("shop.stage.productsTitle")}</h1>
        <p className="sh-sub">{t("shop.stage.productsSubtitle")}</p>
        <Link to="/shop/all" className="sh-cta">{t("shop.stage.productsCta")} <IconArrowRight width={16} height={16} /></Link>
      </div>
      <div className="sh-visual">
        <div className={`sh-bento count-${Math.min(products.length, 3)}`}>
          {products.slice(0, 3).map((p, i) => (
            <Link key={p.id} to={`/shop/product/${p.id}`} className={`sh-tile ${i === 0 ? "is-lead" : ""}`}>
              <LazyImg src={p.image} alt={p.name} loading={i === 0 ? "eager" : "lazy"} />
              <span className="sh-tile-info">
                <strong>{p.name}</strong>
                <em>{p.price}</em>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const WAYS = [
  { to: "/shop/new-arrivals", Icon: IconSparkles, key: "tileNew" },
  { to: "/shop/best-sellers", Icon: IconStar, key: "tileBest" },
  { to: "/shop/categories", Icon: IconGrid, key: "tileCats" },
  { to: "/services", Icon: IconWrench, key: "tileServices" }
];

function EmptyStage() {
  const { t } = useTranslation();
  return (
    <div className="sh-grid">
      <div className="sh-copy">
        <span className="sh-pill"><IconStore width={14} height={14} /> {t("shop.stage.emptyEyebrow")}</span>
        <h1 className="sh-title">{t("shop.stage.emptyTitle")}</h1>
        <p className="sh-sub">{t("shop.stage.emptySubtitle")}</p>
        <div className="sh-actions">
          <Link to="/shop/categories" className="sh-cta">{t("shop.stage.emptyCta")} <IconArrowRight width={16} height={16} /></Link>
          <Link to="/services" className="sh-cta-ghost">{t("shop.stage.emptyCta2")}</Link>
        </div>
      </div>
      <div className="sh-visual">
        <div className="sh-ways">
          {WAYS.map(({ to, Icon, key }) => (
            <Link key={key} to={to} className="sh-way">
              <span><Icon width={22} height={22} /></span>
              <strong>{t(`shop.stage.${key}`)}</strong>
              <small>{t(`shop.stage.${key}Sub`)}</small>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShopHeroStage({ ads = [], products = [] }) {
  return (
    <section className="sh">
      {ads.length ? <AdsStage ads={ads} /> : products.length ? <ProductsStage products={products} /> : <EmptyStage />}
    </section>
  );
}
