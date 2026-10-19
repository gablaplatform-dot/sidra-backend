import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { getDeviceId } from "../../lib/deviceId";
import { clearInterest } from "../../lib/tracking";
import { getPreferredDistrict } from "../../lib/userLocation";
import { listingCover } from "../../lib/shopMappers";
import { formatUgx } from "../../lib/format";
import BrowseCard from "./browse/BrowseCard";
import { ForYouSkeleton } from "../Skeleton";
import { IconSearch, IconSparkles } from "../icons";

// "This can work for you": what the shopper has been looking at (categories, searches, recently
// viewed) and products picked for them from it. A brand-new visitor still gets something useful -
// popular products, arranged around their district - and it sharpens as they browse.
export default function ShopForYou() {
  const { t } = useTranslation();
  const [data, setData] = useState(null); // null = loading
  const district = getPreferredDistrict();

  const load = () => {
    const params = new URLSearchParams({ limit: "8" });
    const deviceId = getDeviceId();
    if (deviceId) params.set("deviceId", deviceId);
    if (district) params.set("district", district);
    return request(`/interest/for-you?${params.toString()}`)
      .then(setData)
      .catch(() => setData(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = async () => {
    if (!window.confirm(t("shop.forYou.clearConfirm"))) return;
    setData(null);
    await clearInterest().catch(() => {});
    load();
  };

  if (data === null) return <ForYouSkeleton />;
  if (!data || (!data.items.length && !data.recentlyViewed.length)) return null;

  const subtitle = data.headline || (district ? t("shop.forYou.popularAround", { district }) : t("shop.forYou.popularNow"));

  return (
    <section className="shop-section fy-section">
      <div className="shop-section-header fy-header">
        <div>
          <h2 className="shop-section-title fy-title">
            <IconSparkles width={22} height={22} /> {t("shop.forYou.title")}
          </h2>
          <p className="fy-sub">{subtitle}</p>
        </div>
        {data.personalized ? (
          <button type="button" className="sb-link-btn" onClick={clear}>
            {t("shop.forYou.clearHistory")}
          </button>
        ) : null}
      </div>

      {data.categories.length || data.recentSearches.length ? (
        <div className="fy-chips">
          {data.categories.map((c) => (
            <Link key={c.id} to={`/shop/${c.id}`} className="fy-chip fy-chip-cat">
              {c.name}
            </Link>
          ))}
          {data.recentSearches.map((q) => (
            <Link key={q} to={`/shop/all?q=${encodeURIComponent(q)}`} className="fy-chip fy-chip-search">
              <IconSearch width={13} height={13} /> {q}
            </Link>
          ))}
        </div>
      ) : null}

      {data.recentlyViewed.length ? (
        <div className="fy-block">
          <h3>{t("shop.forYou.continue")}</h3>
          <div className="fy-recent">
            {data.recentlyViewed.map((item) => (
              <Link key={item.id} to={`/shop/product/${item.id}`} className="fy-recent-card">
                <img src={listingCover(item)} alt="" loading="lazy" />
                <span>
                  <strong>{item.name}</strong>
                  <small>{Number(item.price) > 0 ? formatUgx(item.price) : t("shop.forYou.contactForPrice")}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {data.items.length ? (
        <div className="fy-block">
          <h3>{t("shop.forYou.picked")}</h3>
          <div className="pd-row-grid">
            {data.items.map((item) => (
              <BrowseCard key={item.id} listing={item} reason={item.reason} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
