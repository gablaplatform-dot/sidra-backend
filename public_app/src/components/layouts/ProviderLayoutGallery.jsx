import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProviderListings from "../ProviderListings";
import ProviderCustomFields from "../ProviderCustomFields";
import { IconChevronLeft, IconImage, IconStar } from "../icons";

const initials = (value) => (value || "G").trim().slice(0, 1).toUpperCase();

export default function ProviderLayoutGallery({ provider, categoryId, categoryName, providerFields = [], listings, gallery, onUnlock }) {
  const { t } = useTranslation();
  return (
    <>
      <section className="provider-hero provider-hero-compact">
        <Link to={categoryId ? `/category/${categoryId}` : "/home"} className="banner-back">
          <IconChevronLeft /> {categoryId ? categoryName : t("nav.home")}
        </Link>
        <div className="provider-hero-label">
          <span className="provider-hero-icon">{initials(provider.businessName)}</span>
          <div>
            <h1>{provider.businessName}</h1>
            <p className="provider-hero-meta">
              {categoryName}
              <span className="hero-trust-dot">&middot;</span>
              <IconStar /> {provider.ratingAvg ? provider.ratingAvg.toFixed(1) : t("common.new")}
            </p>
          </div>
        </div>
      </section>

      <div className="detail-block gallery-layout-body">
        {provider.description ? <p className="provider-description gallery-layout-intro">{provider.description}</p> : null}
        <ProviderCustomFields fields={providerFields} values={provider.customFields} />

        <h2>{t("layouts.gallery")}</h2>
        {gallery.length ? (
          <div className="masonry-gallery">
            {gallery.map((url) => (
              <div key={url} className="masonry-item" style={{ backgroundImage: `url("${url}")` }} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <IconImage />
            <p>{t("layouts.noGallery")}</p>
          </div>
        )}
      </div>

      <ProviderListings provider={provider} listings={listings} />
    </>
  );
}
