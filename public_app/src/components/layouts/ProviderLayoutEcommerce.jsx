import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProviderCustomFields, { hasAnsweredCustomFields } from "../ProviderCustomFields";
import OrderModal from "../OrderModal";
import ProviderListings from "../ProviderListings";
import { IconBox, IconChevronLeft, IconImage, IconShield, IconStar, IconStore } from "../icons";
import { formatUgx } from "../../lib/format";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutEcommerce({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
  const { t } = useTranslation();
  const [orderingItem, setOrderingItem] = useState(null);

  const previewItems = listings.slice(0, 2);

  return (
    <>
      <section className="ecommerce-hero" style={provider.media?.coverUrl ? { backgroundImage: `url("${provider.media.coverUrl}")` } : undefined}>
        <div className="ecommerce-hero-overlay" />
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back ecommerce-back">
          <IconChevronLeft /> {categoryId ? categoryName : t("nav.home")}
        </Link>
        <div className="ecommerce-hero-grid">
          <div className="ecommerce-hero-copy">
            <p className="ecommerce-eyebrow">{categoryName}</p>
            <h1>{provider.businessName}</h1>
            {provider.description ? <p className="ecommerce-hero-desc">{provider.description}</p> : null}
            <div className="ecommerce-hero-actions">
              <a href="#shop" className="cta-button">{t("layouts.shopNow")}</a>
              <a href="#about" className="secondary-button ecommerce-ghost-button">{t("layouts.getInTouch")}</a>
            </div>
            <div className="hero-trust ecommerce-hero-trust">
              <span><IconStar /> {provider.ratingAvg ? provider.ratingAvg.toFixed(1) : t("common.new")}{provider.ratingCount ? ` (${provider.ratingCount})` : ""}</span>
              <span className="hero-trust-dot">&middot;</span>
              <span><IconShield /> {t("layouts.verified")}</span>
              <span className="hero-trust-dot">&middot;</span>
              <span><IconStore /> {t("layouts.listed", { count: listings.length })}</span>
            </div>
          </div>
          {previewItems.length ? (
            <div className="ecommerce-hero-visual">
              {previewItems.map((item, index) => (
                <div key={item.id} className={`ecommerce-floating-card ecommerce-floating-card-${index}`}>
                  <div
                    className="ecommerce-floating-thumb"
                    style={item.media?.imageUrl ? { backgroundImage: `url("${item.media.imageUrl}")` } : undefined}
                  >
                    {!item.media?.imageUrl ? <IconBox /> : null}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    {Number(item.price) > 0 ? <span>{formatUgx(item.price)}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <ProviderListings id="shop" provider={provider} listings={listings} onOrderService={setOrderingItem} />

      <div className="provider-detail-grid" id="about">
        <div className="provider-detail-main">
          {provider.description || hasAnsweredCustomFields(providerFields, provider.customFields) ? (
            <section className="detail-block">
              <h2>{t("layouts.aboutName", { name: provider.businessName })}</h2>
              {provider.description ? <p className="provider-description">{provider.description}</p> : null}
              <ProviderCustomFields fields={providerFields} values={provider.customFields} />
            </section>
          ) : null}

          <section className="detail-block">
            <h2>{t("layouts.gallery")}</h2>
            {gallery.length ? (
              <div className="gallery-grid">
                {gallery.slice(0, 6).map((url) => (
                  <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <IconImage />
                <p>{t("layouts.noGallery")}</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {orderingItem ? (
        <OrderModal listing={orderingItem} providerId={provider.id} onClose={() => setOrderingItem(null)} />
      ) : null}

    </>
  );
}
